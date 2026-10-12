import type { Monitor } from '@prisma/client';

import { scrapeQueue } from './scrapeQueue.js';

/**
 * Mapea el enum Frequency de Prisma a milisegundos.
 */
const FREQUENCY_MS: Record<'m5' | 'm15' | 'm30', number> = {
  m5: 5 * 60 * 1000,
  m15: 15 * 60 * 1000,
  m30: 30 * 60 * 1000,
};

/**
 * Genera el jobId unico para un monitor + frecuencia.
 * Incluye la frecuencia para que cambiar m5 -> m15 cree un jobId
 * distinto y el viejo se pueda eliminar sin pisar al nuevo.
 */
function buildRepeatJobId(
  monitorId: string,
  frequencyMin: 'm5' | 'm15' | 'm30'
): string {
  return `monitor-${monitorId}-${frequencyMin}`;
}

/**
 * Nombre del job. Coincide con el que usa el worker para procesarlo.
 */
const JOB_NAME = 'scrape-monitor';

/**
 * Programa (o re-programa) un job repetible para un monitor.
 *
 * - Si ya existe un job con el mismo jobId, BullMQ lo actualiza.
 * - La frecuencia se toma de monitor.frequencyMin.
 */
export async function scheduleMonitor(monitor: Monitor): Promise<void> {
  const frequency = monitor.frequencyMin as 'm5' | 'm15' | 'm30';
  const every = FREQUENCY_MS[frequency];
  const jobId = buildRepeatJobId(monitor.id, frequency);

  await scrapeQueue.add(
    JOB_NAME,
    {
      monitorId: monitor.id,
      userId: monitor.userId,
    },
    {
      repeat: {
        every,
      },
      jobId,
    }
  );

  console.log(
    `⏰ Monitor ${monitor.id} programado cada ${frequency} (jobId: ${jobId})`
  );
}

/**
 * Quita el job repetible de un monitor (para pausar/eliminar).
 * Necesita la frecuencia actual porque BullMQ la usa como parte
 * de la clave del job.
 */
export async function unscheduleMonitor(monitor: Monitor): Promise<void> {
  const frequency = monitor.frequencyMin as 'm5' | 'm15' | 'm30';

  const removed = await scrapeQueue.removeRepeatable(JOB_NAME, {
    every: FREQUENCY_MS[frequency],
    jobId: buildRepeatJobId(monitor.id, frequency),
  });

  if (removed) {
    console.log(
      `🛑 Monitor ${monitor.id} desprogramado (frequency: ${frequency})`
    );
  } else {
    console.log(
      `ℹ️ Monitor ${monitor.id} no estaba programado (frequency: ${frequency})`
    );
  }
}

/**
 * Cambia la frecuencia de un monitor: quita el job viejo y agrega el nuevo.
 *
 * @param monitor Monitor ya actualizado en la BD (con la nueva frecuencia)
 * @param oldFrequency La frecuencia que tenia antes en la BD
 */
export async function rescheduleMonitor(
  monitor: Monitor,
  oldFrequency: 'm5' | 'm15' | 'm30'
): Promise<void> {
  const newFrequency = monitor.frequencyMin as 'm5' | 'm15' | 'm30';

  if (oldFrequency === newFrequency) {
    console.log(
      `ℹ️ Monitor ${monitor.id} mantiene la misma frecuencia (${newFrequency})`
    );
    return;
  }

  console.log(
    `🔄 Monitor ${monitor.id}: ${oldFrequency} -> ${newFrequency}`
  );

  // Quitar el viejo
  await scrapeQueue.removeRepeatable(JOB_NAME, {
    every: FREQUENCY_MS[oldFrequency],
    jobId: buildRepeatJobId(monitor.id, oldFrequency),
  });

  // Agregar el nuevo
  await scheduleMonitor(monitor);
}