import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';

async function main() {
  // Verificar conexión a la base de datos al arrancar
  try {
    await prisma.$connect();
    console.log('✓ Database connection established');
  } catch (error) {
    console.error('✗ Failed to connect to database:', error);
    process.exit(1);
  }

  const app = createApp();

  const server = app.listen(env.API_PORT, () => {
    console.log(`✓ Server running at ${env.API_BASE_URL}`);
    console.log(`  Environment: ${env.NODE_ENV}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down...`);
    server.close(async () => {
      await prisma.$disconnect();
      console.log('✓ Shutdown complete');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('Fatal error on startup:', error);
  process.exit(1);
});