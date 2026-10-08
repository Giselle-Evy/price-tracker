import { PrismaClient } from '@prisma/client';

// Singleton: evita crear múltiples instancias de PrismaClient en desarrollo
// (tsx watch recarga el módulo en cada cambio y podría agotar el pool).
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}