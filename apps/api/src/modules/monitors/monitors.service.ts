import { prisma } from '../../lib/prisma.js';
import { NotFoundError, BadRequestError } from '../../lib/errors.js';
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
  configId: string;
  name: string;
  url: string;
  imageUrl: string | null;
  currency: string | null;
  currentPrice: number | null;
  previousPrice: number | null;
  targetPrice: number | null;
  status: 'active' | 'paused' | 'error' | 'pending';
  frequencyMin: 'm5' | 'm15' | 'm30';
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
  };
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
  config: { id: string; name: string; sourceUrl: string; sourceDomain: string };
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
    name: monitor.name,
    url: monitor.url,
    imageUrl: monitor.imageUrl,
    currency: monitor.currency,
    currentPrice: monitor.currentPrice ? Number(monitor.currentPrice) : null,
    previousPrice: monitor.previousPrice ? Number(monitor.previousPrice) : null,
    targetPrice: monitor.targetPrice ? Number(monitor.targetPrice) : null,
    status: monitor.status as MonitorDto['status'],
    frequencyMin: monitor.frequencyMin as MonitorDto['frequencyMin'],
    alertOnDrop: monitor.alertOnDrop,
    alertEnabled: monitor.alertEnabled,
    lastRunAt: monitor.lastRunAt?.toISOString() ?? null,
    lastSuccessAt: monitor.lastSuccessAt?.toISOString() ?? null,
    nextRunAt: monitor.nextRunAt?.toISOString() ?? null,
    createdAt: monitor.createdAt.toISOString(),
    updatedAt: monitor.updatedAt.toISOString(),
    config: {
      id: monitor.config.id,
      name: monitor.config.name,
      sourceUrl: monitor.config.sourceUrl,
      sourceDomain: monitor.config.sourceDomain,
    },
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
  // 1. Verificar que la config existe y pertenece al user
  const config = await prisma.scrapeConfig.findFirst({
    where: { id: input.configId, userId },
  });

  if (!config) {
    throw new NotFoundError('Configuracion no encontrada');
  }

  // 2. Upsert del Product por canonicalUrl
  // Si ya existe un producto con esa URL, lo reutilizamos.
  const product = await prisma.product.upsert({
    where: { canonicalUrl: config.sourceUrl },
    update: {},
    create: {
      name: input.name,
      canonicalUrl: config.sourceUrl,
      originalUrl: config.sourceUrl,
      domain: config.sourceDomain,
    },
  });

  // 3. Verificar que el user no tenga ya un monitor para esa config
  const existing = await prisma.monitor.findFirst({
    where: { userId, configId: input.configId },
  });

  if (existing) {
    throw new BadRequestError(
      'Ya tenes un monitor para esta configuracion'
    );
  }

  // 4. Crear el monitor
  const monitor = await prisma.monitor.create({
    data: {
      userId,
      productId: product.id,
      configId: config.id,
      name: input.name,
      url: config.sourceUrl,
      frequencyMin: input.frequencyMin,
      alertOnDrop: input.alertOnDrop,
      alertEnabled: input.alertEnabled,
      targetPrice: input.targetPrice ?? null,
      status: 'active',
    },
    include: INCLUDE_RELATIONS,
  });

  // 5. Programar el job repetible en BullMQ
  try {
    await scheduleMonitor(monitor);
  } catch (err) {
    console.error('❌ Error programando monitor en BullMQ:', err);
    // No lanzamos error: el monitor está creado en BD.
    // Se puede reprogramar después.
  }

  return toMonitorDto(monitor);
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

  const oldFrequency = existing.frequencyMin as 'm5' | 'm15' | 'm30';
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