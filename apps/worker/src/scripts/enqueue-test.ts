/**
 * Script de prueba para encolar un job de scraping manualmente.
 *
 * Uso:
 *   pnpm --filter @price-tracker/worker exec tsx src/scripts/enqueue-test.ts <monitorId> <userId>
 *
 * Ejemplo:
 *   pnpm --filter @price-tracker/worker exec tsx src/scripts/enqueue-test.ts 22222222-2222-2222-2222-222222222222 5a9ad485-a01b-4048-a142-561f4766c5c9
 */
import { enqueueScrape, closeScrapeQueue } from '../queues/scrapeQueue.js';

async function main() {
  const monitorId = process.argv[2];
  const userId = process.argv[3];

  if (!monitorId || !userId) {
    console.error(
      '❌ Uso: tsx src/scripts/enqueue-test.ts <monitorId> <userId>'
    );
    process.exit(1);
  }

  console.log(`📤 Encolando job...`);
  console.log(`   monitorId: ${monitorId}`);
  console.log(`   userId:    ${userId}`);

  const job = await enqueueScrape(monitorId, userId);

  console.log(`✅ Job encolado con id: ${job.id}`);

  // Cerrar la conexión de la cola para que el proceso termine.
  await closeScrapeQueue();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});