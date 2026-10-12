import {
  extractFields,
  parsePrice,
  scrape,
  type ExtractFieldInput,
} from '@price-tracker/shared/scraper';
import type { Job } from 'bullmq';

import { prisma } from '../lib/prisma.js';
import type { ScrapeJobData, ScrapeJobResult } from '../queues/types.js';

/**
 * Mapea el enum Frequency de Prisma a milisegundos.
 */
const FREQUENCY_MS: Record<'m5' | 'm15' | 'm30', number> = {
  m5: 5 * 60 * 1000,
  m15: 15 * 60 * 1000,
  m30: 30 * 60 * 1000,
};

/**
 * Processor principal. BullMQ lo llama por cada job de la cola.
 * Debe devolver un ScrapeJobResult y lanzar error solo si algo
 * catastrofico pasa (para que BullMQ haga retry).
 */
export async function processScrapeJob(
  job: Job<ScrapeJobData, ScrapeJobResult>
): Promise<ScrapeJobResult> {
  const { monitorId, userId } = job.data;
  const startTime = Date.now();

  console.log(`\n🔍 Procesando job para monitor ${monitorId}`);

  // ─────────────────────────────────────────────────────────
  // 1. Cargar monitor + config + fields
  // ─────────────────────────────────────────────────────────
  const monitor = await prisma.monitor.findUnique({
    where: { id: monitorId },
    include: {
      config: {
        include: {
          fields: {
            orderBy: { orderIndex: 'asc' },
          },
        },
      },
    },
  });

  if (!monitor) {
    console.error(`❌ Monitor ${monitorId} no encontrado`);
    throw new Error(`Monitor ${monitorId} not found`);
  }

  if (monitor.userId !== userId) {
    console.error(`❌ Monitor ${monitorId} no pertenece al user ${userId}`);
    throw new Error('Monitor/user mismatch');
  }

  if (monitor.status !== 'active') {
    console.log(
      `⏸️ Monitor ${monitorId} esta en status "${monitor.status}". Saltando.`
    );
    return {
      monitorId,
      status: 'partial',
      durationMs: Date.now() - startTime,
      errorMessage: `Monitor no activo (status=${monitor.status})`,
    };
  }

  const fields = monitor.config.fields;

  if (fields.length === 0) {
    console.error(`❌ Config ${monitor.configId} sin fields`);
    throw new Error('Config has no fields');
  }

  // ─────────────────────────────────────────────────────────
  // 2. Crear ScrapeRun en estado inicial
  // ─────────────────────────────────────────────────────────
  const run = await prisma.scrapeRun.create({
    data: {
      monitorId,
      status: 'error', // Se actualiza al final
      startedAt: new Date(),
    },
  });

  console.log(`📝 ScrapeRun creado: ${run.id}`);

  // ─────────────────────────────────────────────────────────
  // 3. Scrapear la URL
  // ─────────────────────────────────────────────────────────
  let scrapeResult;
  try {
    scrapeResult = await scrape(monitor.url);
    console.log(
      `📥 Scrape OK: ${scrapeResult.statusCode} en ${scrapeResult.durationMs}ms (${scrapeResult.method})`
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`❌ Scrape fallo: ${errorMessage}`);

    await prisma.scrapeRun.update({
      where: { id: run.id },
      data: {
        status: 'error',
        errorMessage,
        durationMs: Date.now() - startTime,
        finishedAt: new Date(),
      },
    });

    await prisma.monitor.update({
      where: { id: monitorId },
      data: {
        status: 'error',
        lastRunAt: new Date(),
      },
    });

    return {
      monitorId,
      status: 'error',
      durationMs: Date.now() - startTime,
      errorMessage,
    };
  }

  // ─────────────────────────────────────────────────────────
  // 4. Extraer los fields
  // ─────────────────────────────────────────────────────────
  const extractInput: ExtractFieldInput[] = fields.map((f) => ({
    label: f.label,
    selector: f.selector,
    attribute: f.attribute,
    type: f.type as ExtractFieldInput['type'],
  }));

  const { values, fieldErrors } = extractFields(
    scrapeResult.html,
    extractInput
  );

  console.log(`📊 Valores extraidos:`, values);

  if (fieldErrors.length > 0) {
    console.warn(`⚠️ Errores de extraccion:`, fieldErrors);
  }

  // ─────────────────────────────────────────────────────────
  // 5. Encontrar el precio
  // ─────────────────────────────────────────────────────────
  // Buscamos el field con type='price', o el label "Precio".
  const priceField = fields.find((f) => f.type === 'price');

  if (!priceField) {
    const errorMessage = 'Config no tiene field de tipo "price"';

    await prisma.scrapeRun.update({
      where: { id: run.id },
      data: {
        status: 'error',
        errorMessage,
        durationMs: Date.now() - startTime,
        finishedAt: new Date(),
        rawSnapshot: { values, fieldErrors },
      },
    });

    console.error(`❌ ${errorMessage}`);

    return {
      monitorId,
      status: 'error',
      durationMs: Date.now() - startTime,
      errorMessage,
    };
  }

  const priceRaw = values[priceField.label];
  const priceNumber = parsePrice(priceRaw);

  if (priceNumber === null) {
    const errorMessage = `No se pudo parsear el precio: "${priceRaw}"`;

    await prisma.scrapeRun.update({
      where: { id: run.id },
      data: {
        status: 'partial',
        errorMessage,
        durationMs: Date.now() - startTime,
        finishedAt: new Date(),
        rawSnapshot: { values, fieldErrors },
      },
    });

    console.error(`❌ ${errorMessage}`);

    return {
      monitorId,
      status: 'partial',
      durationMs: Date.now() - startTime,
      errorMessage,
    };
  }

  console.log(`💰 Precio extraido: ${priceNumber}`);

  // ─────────────────────────────────────────────────────────
  // 6. Guardar en PriceHistory
  // ─────────────────────────────────────────────────────────
  const previousPrice = monitor.currentPrice
    ? Number(monitor.currentPrice)
    : null;

  await prisma.priceHistory.create({
    data: {
      monitorId,
      runId: run.id,
      price: priceNumber,
      currency: monitor.currency ?? 'GBP', // Books to Scrape usa GBP
      observedAt: new Date(),
    },
  });

  console.log(`💾 PriceHistory guardado: ${priceNumber}`);

  // ─────────────────────────────────────────────────────────
  // 7. Actualizar Monitor y ScrapeRun
  // ─────────────────────────────────────────────────────────
  const now = new Date();
  const nextRunAt = new Date(
    now.getTime() + FREQUENCY_MS[monitor.frequencyMin]
  );

  await prisma.monitor.update({
    where: { id: monitorId },
    data: {
      currentPrice: priceNumber,
      previousPrice: previousPrice,
      lastRunAt: now,
      lastSuccessAt: now,
      nextRunAt,
      status: 'active',
      currency: monitor.currency ?? 'GBP',
    },
  });

  await prisma.scrapeRun.update({
    where: { id: run.id },
    data: {
      status: fieldErrors.length > 0 ? 'partial' : 'success',
      durationMs: Date.now() - startTime,
      httpStatus: scrapeResult.statusCode,
      finishedAt: new Date(),
      rawSnapshot: { values, fieldErrors },
    },
  });

  // ─────────────────────────────────────────────────────────
  // 8. Log de cambio de precio
  // ─────────────────────────────────────────────────────────
  if (previousPrice !== null && priceNumber < previousPrice) {
    const diff = (previousPrice - priceNumber).toFixed(2);
    console.log(`📉 PRECIO BAJO! ${previousPrice} -> ${priceNumber} (-${diff})`);
  } else if (previousPrice !== null && priceNumber > previousPrice) {
    const diff = (priceNumber - previousPrice).toFixed(2);
    console.log(`📈 Precio subio: ${previousPrice} -> ${priceNumber} (+${diff})`);
  } else if (previousPrice !== null) {
    console.log(`➡️ Precio igual: ${priceNumber}`);
  }

  const durationMs = Date.now() - startTime;
  console.log(`✅ Job completado en ${durationMs}ms\n`);

  return {
    monitorId,
    status: fieldErrors.length > 0 ? 'partial' : 'success',
    price: priceNumber,
    currency: monitor.currency ?? 'GBP',
    durationMs,
  };
}