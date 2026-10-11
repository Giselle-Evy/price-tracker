import { Redis } from 'ioredis';

import { env } from '../config/env.js';

/**
 * Conexión principal para operaciones normales (pub/sub, comandos).
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
});

redis.on('connect', () => {
  console.log('✅ Redis conectado');
});

redis.on('error', (err) => {
  console.error('❌ Redis error:', err.message);
});

/**
 * Conexión dedicada para BullMQ.
 * BullMQ requiere maxRetriesPerRequest: null para blocking commands.
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