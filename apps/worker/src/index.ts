import { env } from './config/env.js';
import { prisma, disconnectPrisma } from './lib/prisma.js';
import { redis, disconnectRedis } from './lib/redis.js';

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

  console.log('🎉 Worker listo. Esperando jobs...');

  // TODO (FASE 10.2): definir la cola de scraping
  // TODO (FASE 10.3): agregar el procesador de jobs
  // TODO (FASE 10.4): programar jobs repetibles
}

// ─────────────────────────────────────────────────────────────
// SHUTDOWN GRACIOSO
// ─────────────────────────────────────────────────────────────

async function shutdown(signal: string) {
  console.log(`\n🛑 Recibido ${signal}. Cerrando...`);

  try {
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