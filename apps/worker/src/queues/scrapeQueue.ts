import { Queue, QueueEvents } from 'bullmq';

import { createBullConnection } from '../lib/redis.js';
import type { ScrapeJobData, ScrapeJobResult } from './types.js';

/**
 * Nombre de la cola. Aparece en Redis y en BullMQ dashboard.
 */
export const SCRAPE_QUEUE_NAME = 'scrape-monitors';

/**
 * Cola principal de scraping.
 * La conexión se crea con createBullConnection() porque BullMQ
 * requiere maxRetriesPerRequest: null.
 */
export const scrapeQueue = new Queue<ScrapeJobData, ScrapeJobResult>(
  SCRAPE_QUEUE_NAME,
  {
    connection: createBullConnection(),
    defaultJobOptions: {
      // Si falla, reintenta hasta 3 veces con backoff exponencial.
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5_000, // 5s, 10s, 20s
      },
      // Eliminar jobs completados después de 24h para no acumular.
      removeOnComplete: {
        age: 24 * 3600, // 24 horas
        count: 1_000,
      },
      // Eliminar jobs fallidos después de 7 días.
      removeOnFail: {
        age: 7 * 24 * 3600, // 7 días
      },
    },
  }
);

/**
 * QueueEvents permite escuchar eventos de la cola (completed, failed,
 * progress, etc.) desde este proceso. Útil para logging.
 */
export const scrapeQueueEvents = new QueueEvents(SCRAPE_QUEUE_NAME, {
  connection: createBullConnection(),
});

scrapeQueueEvents.on('completed', ({ jobId }) => {
  console.log(`✅ Job ${jobId} completado`);
});

scrapeQueueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`❌ Job ${jobId} falló: ${failedReason}`);
});

/**
 * Cierra las conexiones de la cola y sus eventos.
 * Se llama en el shutdown del worker.
 */
export async function closeScrapeQueue(): Promise<void> {
  await scrapeQueueEvents.close();
  await scrapeQueue.close();
}

/**
 * Encola un job de scraping para un monitor.
 * Por ahora se llama manualmente; en 10.4 se llamará desde el scheduler.
 */
export async function enqueueScrape(monitorId: string, userId: string) {
  return scrapeQueue.add(
    'scrape-monitor',
    { monitorId, userId },
    {
      // ID único para evitar jobs duplicados del mismo monitor.
      jobId: `monitor-${monitorId}`,
    }
  );
}