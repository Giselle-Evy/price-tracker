import { Worker } from 'bullmq';

import { env } from './config/env.js';
import { prisma, disconnectPrisma } from './lib/prisma.js';
import { redis, disconnectRedis, createBullConnection } from './lib/redis.js';
import {
  scrapeQueue,
  closeScrapeQueue,
  SCRAPE_QUEUE_NAME,
} from './queues/scrapeQueue.js';
import { processScrapeJob } from './processors/scrapeProcessor.js';
import type { ScrapeJobData, ScrapeJobResult } from './queues/types.js';

let worker: Worker<ScrapeJobData, ScrapeJobResult> | null = null;

async function main() {
  console.log('🚀 Worker arrancando...');
  console.log(`   NODE_ENV: ${env.NODE_ENV}`);

  // 1. Verificar conexión a la base de datos
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Base de datos conectada');
  } catch (err) {
    console.error('❌ Error conectando a la base de datos:', err);
    process.exit(1);
  }

  // 2. Verificar conexión a Redis
  try {
    const pong = await redis.ping();
    console.log(`✅ Redis responde: ${pong}`);
  } catch (err) {
    console.error('❌ Error conectando a Redis:', err);
    process.exit(1);
  }

  // 3. Verificar que la cola esté accesible
  try {
    const counts = await scrapeQueue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed'
    );
    console.log(
      `✅ Cola "${scrapeQueue.name}" lista. Jobs: waiting=${counts.waiting}, active=${counts.active}, completed=${counts.completed}, failed=${counts.failed}`
    );
  } catch (err) {
    console.error('❌ Error accediendo a la cola:', err);
    process.exit(1);
  }

  // 4. Crear el Worker que procesa los jobs
  worker = new Worker<ScrapeJobData, ScrapeJobResult>(
    SCRAPE_QUEUE_NAME,
    processScrapeJob,
    {
      connection: createBullConnection(),
      concurrency: 2, // Maximo 2 jobs en paralelo
    }
  );

  worker.on('ready', () => {
    console.log(`👷 Worker BullMQ escuchando la cola "${SCRAPE_QUEUE_NAME}"`);
  });

  worker.on('active', (job) => {
    console.log(`⚡ Job ${job.id} activo`);
  });

  worker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completado`);
  });

  worker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} fallo:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('❌ Error en el worker BullMQ:', err);
  });

  console.log('🎉 Worker listo. Esperando jobs...');
}

// ─────────────────────────────────────────────────────────────
// SHUTDOWN GRACIOSO
// ─────────────────────────────────────────────────────────────

async function shutdown(signal: string) {
  console.log(`\n🛑 Recibido ${signal}. Cerrando...`);

  try {
    if (worker) {
      await worker.close();
      console.log('✅ Worker BullMQ cerrado');
    }
    await closeScrapeQueue();
    await disconnectRedis();
    await disconnectPrisma();
    console.log('✅ Conexiones cerradas');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error cerrando:', err);
    process.exit(1);
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

// ─────────────────────────────────────────────────────────────
// ARRANCAR
// ─────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('❌ Error fatal en main():', err);
  process.exit(1);
});