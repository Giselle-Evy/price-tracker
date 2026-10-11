import { env } from './config/env.js';
import { prisma, disconnectPrisma } from './lib/prisma.js';
import { redis, disconnectRedis } from './lib/redis.js';
import {
  scrapeQueue,
  closeScrapeQueue,
} from './queues/scrapeQueue.js';

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

  console.log('🎉 Worker listo. Esperando jobs...');

  // TODO (FASE 10.3): agregar el Worker de BullMQ para procesar jobs
  // TODO (FASE 10.4): agregar el scheduler de jobs repetibles
}

// ─────────────────────────────────────────────────────────────
// SHUTDOWN GRACIOSO
// ─────────────────────────────────────────────────────────────

async function shutdown(signal: string) {
  console.log(`\n🛑 Recibido ${signal}. Cerrando...`);

  try {
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