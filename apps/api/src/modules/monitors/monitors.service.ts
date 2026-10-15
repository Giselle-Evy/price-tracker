import { Prisma } from '@prisma/client';
import {
  detectAutomaticPrice,
  scrape,
  SharedBadRequestError,
} from '@price-tracker/shared/scraper';

import { prisma } from '../../lib/prisma.js';
import {
  AppError,
  NotFoundError,
  BadRequestError,
  ConflictError,
} from '../../lib/errors.js';
import {
  scheduleMonitor,
  unscheduleMonitor,
  rescheduleMonitor,
} from '../../lib/scheduler.js';
import type {
  CreateMonitorInput,
  UpdateMonitorInput,
} from './monitors.schemas.js';

// ─────────────────────────────────────────────────────────────
// TIPOS DE RESPUESTA
// ─────────────────────────────────────────────────────────────

export type MonitorDto = {
  id: string;
  userId: string;
  productId: string;
  configId: string | null;
  extractionMode: 'manual' | 'automatic';
  name: string;
  url: string;
  imageUrl: string | null;
  currency: string | null;
  currentPrice: number | null;
  previousPrice: number | null;
  targetPrice: number | null;
  durationDays: number | null;
  status: 'active' | 'paused' | 'error' | 'pending';
  frequencyMin: 'm5' | 'm10' | 'm15' | 'm30';
  alertOnDrop: boolean;
  alertEnabled: boolean;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  config: {
    id: string;
    name: string;
    sourceUrl: string;
    sourceDomain: string;
  } | null;
  product: {
    id: string;
    name: string;
    imageUrl: string | null;
    canonicalUrl: string;
    domain: string;
  };
};

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

type MonitorWithRelations = Awaited<
  ReturnType<typeof prisma.monitor.findUniqueOrThrow>
> & {
  config: { id: string; name: string; sourceUrl: string; sourceDomain: string } | null;
  product: {
    id: string;
    name: string;
    imageUrl: string | null;
    canonicalUrl: string;
    domain: string;
  };
};

function toMonitorDto(monitor: MonitorWithRelations): MonitorDto {
  return {
    id: monitor.id,
    userId: monitor.userId,
    productId: monitor.productId,
    configId: monitor.configId,
    extractionMode: monitor.extractionMode,
    name: monitor.name,
    url: monitor.url,
    imageUrl: monitor.imageUrl,
    currency: monitor.currency,
    currentPrice: monitor.currentPrice ? Number(monitor.currentPrice) : null,
    previousPrice: monitor.previousPrice ? Number(monitor.previousPrice) : null,
    targetPrice: monitor.targetPrice ? Number(monitor.targetPrice) : null,
    durationDays: monitor.durationDays,
    status: monitor.status as MonitorDto['status'],
    frequencyMin: monitor.frequencyMin as MonitorDto['frequencyMin'],
    alertOnDrop: monitor.alertOnDrop,
    alertEnabled: monitor.alertEnabled,
    lastRunAt: monitor.lastRunAt?.toISOString() ?? null,
    lastSuccessAt: monitor.lastSuccessAt?.toISOString() ?? null,
    nextRunAt: monitor.nextRunAt?.toISOString() ?? null,
    createdAt: monitor.createdAt.toISOString(),
    updatedAt: monitor.updatedAt.toISOString(),
    config: monitor.config
      ? {
          id: monitor.config.id,
          name: monitor.config.name,
          sourceUrl: monitor.config.sourceUrl,
          sourceDomain: monitor.config.sourceDomain,
        }
      : null,
    product: {
      id: monitor.product.id,
      name: monitor.product.name,
      imageUrl: monitor.product.imageUrl,
      canonicalUrl: monitor.product.canonicalUrl,
      domain: monitor.product.domain,
    },
  };
}

const INCLUDE_RELATIONS = {
  config: {
    select: {
      id: true,
      name: true,
      sourceUrl: true,
      sourceDomain: true,
    },
  },
  product: {
    select: {
      id: true,
      name: true,
      imageUrl: true,
      canonicalUrl: true,
      domain: true,
    },
  },
} as const;

// ─────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────

export async function createMonitor(
  userId: string,
  input: CreateMonitorInput
): Promise<MonitorDto> {
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
  });

  if (!product) {
    throw new NotFoundError('Producto no encontrado');
  }

  let config: Awaited<ReturnType<typeof prisma.scrapeConfig.findFirst>> = null;
  let initialPrice: number | null = null;
  const extractionMode = input.configId ? 'manual' : 'automatic';

  if (input.configId) {
    config = await prisma.scrapeConfig.findFirst({
      where: { id: input.configId, userId },
    });
    if (!config) {
      throw new NotFoundError('Configuracion no encontrada');
    }
    if (!areUrlsCompatible(product.canonicalUrl, config.sourceUrl)) {
      throw new BadRequestError(
        'La configuración de scraping no es compatible con la URL del producto'
      );
    }
  } else {
    const existingAutomaticMonitor = await prisma.monitor.findFirst({
      where: { userId, productId: product.id, extractionMode: 'automatic' },
    });
    if (existingAutomaticMonitor) {
      throw new ConflictError('Ya existe un seguimiento automático para este producto');
    }

    let html: string;
    try {
      ({ html } = await scrape(product.canonicalUrl));
    } catch (error) {
      if (error instanceof SharedBadRequestError) {
        throw new SharedBadRequestError(
          `No se pudo validar la extracción automática del precio: ${error.message}`,
          error.statusCode,
          { retryable: error.retryable }
        );
      }

      console.error('Error inesperado validando la extracción automática:', error);
      throw error;
    }
    initialPrice = detectAutomaticPrice(html)?.price ?? null;
    if (initialPrice === null || !Number.isFinite(initialPrice) || initialPrice <= 0) {
      throw new BadRequestError(
        'No se detectó un precio válido automáticamente. Configura la extracción desde el Builder e inténtalo de nuevo.'
      );
    }
  }

  let monitor: MonitorWithRelations;
  try {
    monitor = await prisma.monitor.create({
      data: {
        userId,
        productId: product.id,
        configId: config?.id ?? null,
        extractionMode,
        name: input.name,
        url: product.canonicalUrl,
        imageUrl: product.imageUrl,
        currency: product.currency,
        currentPrice: initialPrice,
        frequencyMin: input.frequencyMin,
        alertOnDrop: input.alertOnDrop,
        alertEnabled: input.alertEnabled,
        targetPrice: input.targetPrice ?? null,
        durationDays: input.durationDays ?? null,
        status: 'pending',
      },
      include: INCLUDE_RELATIONS,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictError(
        'Ya existe un seguimiento para este producto y configuración'
      );
    }
    throw error;
  }

  // Solo activar el monitor cuando BullMQ confirme que el trabajo repetible quedó registrado.
  try {
    await scheduleMonitor(monitor);
    monitor = await prisma.monitor.update({
      where: { id: monitor.id },
      data: { status: 'active' },
      include: INCLUDE_RELATIONS,
    });
  } catch (error) {
    console.error('Error registrando el monitor en BullMQ:', error);
    try {
      await unscheduleMonitor(monitor);
    } catch (cleanupError) {
      console.error('Error limpiando la programación parcial del monitor:', cleanupError);
    }
    await prisma.monitor.update({
      where: { id: monitor.id },
      data: { status: 'error' },
    });
    throw new AppError(
      'No se pudo registrar el seguimiento en la cola de tareas. Inténtalo de nuevo.',
      503
    );
  }

  return toMonitorDto(monitor);
}

function areUrlsCompatible(productUrl: string, configUrl: string): boolean {
  try {
    const product = new URL(productUrl);
    const config = new URL(configUrl);
    if (
      !['http:', 'https:'].includes(product.protocol) ||
      !['http:', 'https:'].includes(config.protocol)
    ) {
      return false;
    }

    const productHost = product.hostname.toLowerCase();
    const configHost = config.hostname.toLowerCase();
    return (
      productHost === configHost ||
      productHost.endsWith(`.${configHost}`) ||
      configHost.endsWith(`.${productHost}`)
    );
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────────────────────

export async function listMonitors(userId: string): Promise<MonitorDto[]> {
  const monitors = await prisma.monitor.findMany({
    where: { userId },
    include: INCLUDE_RELATIONS,
    orderBy: { createdAt: 'desc' },
  });

  return monitors.map(toMonitorDto);
}

// ─────────────────────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────────────────────

export async function getMonitor(
  userId: string,
  monitorId: string
): Promise<MonitorDto> {
  const monitor = await prisma.monitor.findFirst({
    where: { id: monitorId, userId },
    include: INCLUDE_RELATIONS,
  });

  if (!monitor) {
    throw new NotFoundError('Monitor no encontrado');
  }

  return toMonitorDto(monitor);
}

// ─────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────

export async function updateMonitor(
  userId: string,
  monitorId: string,
  input: UpdateMonitorInput
): Promise<MonitorDto> {
  const existing = await prisma.monitor.findFirst({
    where: { id: monitorId, userId },
  });

  if (!existing) {
    throw new NotFoundError('Monitor no encontrado');
  }

  const oldFrequency = existing.frequencyMin as 'm5' | 'm10' | 'm15' | 'm30';
  const oldStatus = existing.status;

  // 1. Actualizar en BD
  const updated = await prisma.monitor.update({
    where: { id: monitorId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.frequencyMin !== undefined && {
        frequencyMin: input.frequencyMin,
      }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.alertOnDrop !== undefined && {
        alertOnDrop: input.alertOnDrop,
      }),
      ...(input.alertEnabled !== undefined && {
        alertEnabled: input.alertEnabled,
      }),
      ...(input.targetPrice !== undefined && {
        targetPrice: input.targetPrice,
      }),
    },
    include: INCLUDE_RELATIONS,
  });

  // 2. Sincronizar con BullMQ
  try {
    const newStatus = updated.status;
    const statusChanged = oldStatus !== newStatus;
    const frequencyChanged =
      input.frequencyMin !== undefined && oldFrequency !== input.frequencyMin;

    if (statusChanged && newStatus === 'paused') {
      // Pausado: quitar job repetible
      await unscheduleMonitor(existing);
    } else if (statusChanged && newStatus === 'active') {
      // Reactivado: agregar job repetible
      await scheduleMonitor(updated);
    } else if (frequencyChanged && newStatus === 'active') {
      // Cambió frecuencia estando activo: reprogramar
      await rescheduleMonitor(updated, oldFrequency);
    }
  } catch (err) {
    console.error('❌ Error sincronizando monitor con BullMQ:', err);
    await prisma.monitor.update({
      where: { id: monitorId },
      data: { status: 'error' },
    });
    throw new AppError(
      'No se pudo actualizar la programación del seguimiento. Inténtalo de nuevo.',
      503
    );
  }

  return toMonitorDto(updated);
}

// ─────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────

export async function deleteMonitor(
  userId: string,
  monitorId: string
): Promise<void> {
  const existing = await prisma.monitor.findFirst({
    where: { id: monitorId, userId },
  });

  if (!existing) {
    throw new NotFoundError('Monitor no encontrado');
  }

  // 1. Quitar el job repetible (si estaba activo)
  if (existing.status === 'active') {
    try {
      await unscheduleMonitor(existing);
    } catch (err) {
      console.error('❌ Error quitando job de BullMQ:', err);
    }
  }

  // 2. Eliminar de la BD
  await prisma.monitor.delete({
    where: { id: monitorId },
  });
}