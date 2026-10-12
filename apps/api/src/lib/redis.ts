import { Redis } from 'ioredis';

import { env } from '../config/env.js';

/**
 * Conexion principal para operaciones normales.
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
});

redis.on('connect', () => {
  console.log('✅ Redis conectado (API)');
});

redis.on('error', (err) => {
  console.error('❌ Redis error (API):', err.message);
});

/**
 * Conexion dedicada para BullMQ.
 * BullMQ requiere maxRetriesPerRequest: null.
 */
export function createBullConnection(): Redis {
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export async function disconnectRedis(): Promise<void> {
  await redis.quit();
}