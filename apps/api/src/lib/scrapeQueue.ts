import { Queue } from 'bullmq';

import { createBullConnection } from './redis.js';

/**
 * Nombre de la cola. Debe ser EXACTAMENTE el mismo que usa el worker
 * (apps/worker/src/queues/scrapeQueue.ts) para que ambos procesos
 * hablen de la misma cola en Redis.
 */
export const SCRAPE_QUEUE_NAME = 'scrape-monitors';

/**
 * Tipo de datos que viajan en cada job.
 * Coincide con ScrapeJobData del worker.
 */
export type ScrapeJobData = {
  monitorId: string;
  userId: string;
};

/**
 * Cola de scraping desde el lado del API.
 * Se usa para:
 *  - Agregar jobs repetibles cuando se crea un monitor.
 *  - Quitar jobs repetibles cuando se pausa/elimina.
 *  - Actualizar la frecuencia cuando cambia.
 *
 * El worker (apps/worker) tiene su propia instancia de la misma cola
 * para consumir los jobs.
 */
export const scrapeQueue = new Queue<ScrapeJobData>(SCRAPE_QUEUE_NAME, {
  connection: createBullConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5_000,
    },
    removeOnComplete: {
      age: 24 * 3600,
      count: 1_000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600,
    },
  },
});

/**
 * Cierra la conexion de la cola. Se llama en el shutdown del API.
 */
export async function closeApiScrapeQueue(): Promise<void> {
  await scrapeQueue.close();
}