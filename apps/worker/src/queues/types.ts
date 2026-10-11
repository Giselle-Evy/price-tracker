import type { Job } from 'bullmq';

/**
 * Datos que viajan dentro de un job de scraping.
 * Es intencionalmente mínimo: el worker consulta la BD para
 * obtener el resto (config, fields, etc.).
 */
export type ScrapeJobData = {
  monitorId: string;
  userId: string;
};

/**
 * Resultado que el processor devuelve al terminar.
 * No es obligatorio pero ayuda a debug y a futuras extensiones.
 */
export type ScrapeJobResult = {
  monitorId: string;
  status: 'success' | 'partial' | 'error';
  price?: number;
  currency?: string;
  durationMs: number;
  errorMessage?: string;
};

/**
 * Alias de Job tipado, para no repetir genéricos en todos lados.
 */
export type ScrapeJob = Job<ScrapeJobData, ScrapeJobResult>;

/**
 * Nombres de los jobs que puede procesar la cola.
 * Por ahora solo hay uno, pero la idea es tener varios.
 */
export const JOB_NAMES = {
  SCRAPE_MONITOR: 'scrape-monitor',
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];