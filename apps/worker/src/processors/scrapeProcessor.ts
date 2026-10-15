import {
  detectAutomaticPrice,
  extractFields,
  parsePrice,
  scrape,
  SharedBadRequestError,
  type ExtractFieldInput,
} from '@price-tracker/shared/scraper';
import type { Job } from 'bullmq';

import { prisma } from '../lib/prisma.js';
import type { ScrapeJobData, ScrapeJobResult } from '../queues/types.js';

/**
 * Mapea el enum Frequency de Prisma a milisegundos.
 */
const FREQUENCY_MS: Record<'m5' | 'm10' | 'm15' | 'm30', number> = {
  m5: 5 * 60 * 1000,
  m10: 10 * 60 * 1000,
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
    const shouldRetry =
      err instanceof SharedBadRequestError &&
      err.retryable &&
      job.attemptsMade + 1 < (job.opts.attempts ?? 1);

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
        ...(shouldRetry ? {} : { status: 'error' as const }),
        lastRunAt: new Date(),
      },
    });

    if (err instanceof SharedBadRequestError && err.retryable) {
      throw err;
    }

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
  const fields = monitor.config?.fields ?? [];
  let values: Record<string, string | null>;
  let fieldErrors: Array<{ label: string; error: string }>;
  let priceNumber: number | null;

  if (monitor.extractionMode === 'automatic') {
    const detectedPrice = detectAutomaticPrice(scrapeResult.html);
    values = { Precio: detectedPrice?.value ?? null };
    fieldErrors = detectedPrice
      ? []
      : [{ label: 'Precio', error: 'No se detectó un precio válido automáticamente' }];
    priceNumber = detectedPrice?.price ?? null;
  } else {
    if (!monitor.config || fields.length === 0) {
      const errorMessage = 'El seguimiento manual no tiene una configuración válida';
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
        data: { status: 'error', lastRunAt: new Date() },
      });
      return {
        monitorId,
        status: 'error',
        durationMs: Date.now() - startTime,
        errorMessage,
      };
    }

    const extractInput: ExtractFieldInput[] = fields.map((field) => ({
      label: field.label,
      selector: field.selector,
      attribute: field.attribute,
      type: field.type as ExtractFieldInput['type'],
    }));
    const extraction = extractFields(scrapeResult.html, extractInput);
    values = extraction.values;
    fieldErrors = extraction.fieldErrors;
    const priceField = fields.find((field) => field.type === 'price');
    priceNumber = priceField ? parsePrice(values[priceField.label]) : null;
  }

  console.log(`📊 Valores extraidos:`, values);

  if (fieldErrors.length > 0) {
    console.warn(`⚠️ Errores de extraccion:`, fieldErrors);
  }

  if (priceNumber === null) {
    const errorMessage =
      monitor.extractionMode === 'automatic'
        ? 'No se detectó un precio válido automáticamente'
        : 'No se pudo extraer o parsear el precio configurado';

    await prisma.scrapeRun.update({
      where: { id: run.id },
      data: {
        status: monitor.extractionMode === 'automatic' ? 'error' : 'partial',
        errorMessage,
        durationMs: Date.now() - startTime,
        finishedAt: new Date(),
        rawSnapshot: { values, fieldErrors },
      },
    });
    if (monitor.extractionMode === 'automatic') {
      await prisma.monitor.update({
        where: { id: monitorId },
        data: { status: 'error', lastRunAt: new Date() },
      });
    }

    console.error(`❌ ${errorMessage}`);

    return {
      monitorId,
      status: monitor.extractionMode === 'automatic' ? 'error' : 'partial',
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

    await prisma.offer.updateMany({
    where: {
      productId: monitor.productId,
      userId: monitor.userId,
    },
    data: {
      price: priceNumber,
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