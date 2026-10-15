
import { prisma } from '../../lib/prisma.js';
import { ConflictError, NotFoundError } from '../../lib/errors.js';
import { Prisma } from '@prisma/client';
import type { CreateConfigInput, UpdateConfigInput } from './configs.schemas.js';

// ─────────────────────────────────────────────────────────────
// TIPOS DE RESPUESTA
// ─────────────────────────────────────────────────────────────

export type ConfigFieldDto = {
  id: string;
  label: string;
  selector: string;
  attribute: string | null;
  type: 'text' | 'price' | 'image' | 'url';
  transform: Prisma.JsonValue;
  isPrimary: boolean;
  orderIndex: number;
};

export type ConfigDto = {
  id: string;
  userId: string;
  name: string;
  sourceUrl: string;
  sourceDomain: string;
  status: 'draft' | 'active' | 'error' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  fields: ConfigFieldDto[];
};

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return 'unknown';
  }
}

// ─────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────

export async function createConfig(
  userId: string,
  input: CreateConfigInput
): Promise<ConfigDto> {
  const sourceDomain = extractDomain(input.sourceUrl);

  const config = await prisma.scrapeConfig.create({
    data: {
      userId,
      name: input.name,
      sourceUrl: input.sourceUrl,
      sourceDomain,
      status: 'draft',
      fields: {
        create: input.fields.map((field, index) => ({
          label: field.label,
          selector: field.selector,
          attribute: field.attribute ?? null,
          type: field.type,
          ...(field.transform !== undefined && {
            transform:
              field.transform === null ? Prisma.DbNull : field.transform,
          }),
          isPrimary: field.isPrimary ?? false,
          orderIndex: field.orderIndex ?? index,
        })),
      },
    },
    include: {
      fields: {
        orderBy: { orderIndex: 'asc' },
      },
    },
  });

  return toConfigDto(config);
}

// ─────────────────────────────────────────────────────────────
// LIST
// ─────────────────────────────────────────────────────────────

export async function listConfigs(userId: string): Promise<ConfigDto[]> {
  const configs = await prisma.scrapeConfig.findMany({
    where: { userId },
    include: {
      fields: {
        orderBy: { orderIndex: 'asc' },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return configs.map(toConfigDto);
}

// ─────────────────────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────────────────────

export async function getConfig(
  userId: string,
  configId: string
): Promise<ConfigDto> {
  const config = await prisma.scrapeConfig.findFirst({
    where: {
      id: configId,
      userId,
    },
    include: {
      fields: {
        orderBy: { orderIndex: 'asc' },
      },
    },
  });

  if (!config) {
    throw new NotFoundError('Configuración no encontrada');
  }

  return toConfigDto(config);
}

// ─────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────

export async function updateConfig(
  userId: string,
  configId: string,
  input: UpdateConfigInput
): Promise<ConfigDto> {
  const existing = await prisma.scrapeConfig.findFirst({
    where: { id: configId, userId },
    select: { id: true },
  });

  if (!existing) {
    throw new NotFoundError('Configuración no encontrada');
  }

  const updated = await prisma.scrapeConfig.update({
    where: { id: configId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.sourceUrl !== undefined && {
        sourceUrl: input.sourceUrl,
        sourceDomain: extractDomain(input.sourceUrl),
      }),
      ...(input.fields !== undefined && {
        fields: {
          deleteMany: {},
          create: input.fields.map((field, index) => ({
            label: field.label,
            selector: field.selector,
            attribute: field.attribute ?? null,
            type: field.type,
            ...(field.transform !== undefined && {
              transform:
                field.transform === null ? Prisma.DbNull : field.transform,
            }),
            isPrimary: field.isPrimary ?? false,
            orderIndex: field.orderIndex ?? index,
          })),
        },
      }),
    },
    include: {
      fields: {
        orderBy: { orderIndex: 'asc' },
      },
    },
  });

  return toConfigDto(updated);
}

// ─────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────

export async function deleteConfig(
  userId: string,
  configId: string
): Promise<void> {
  const existing = await prisma.scrapeConfig.findFirst({
    where: {
      id: configId,
      userId,
    },
    select: {
      id: true,
    },
  });

  if (!existing) {
    throw new NotFoundError('Configuración no encontrada');
  }

  // Buscar únicamente los seguimientos propios de esta configuración.
  const monitors = await prisma.monitor.findMany({
    where: {
      configId,
      userId,
    },
    select: {
      productId: true,
    },
  });

  const productIds = [
    ...new Set(monitors.map((monitor) => monitor.productId)),
  ];

  // Las ofertas publicadas por este usuario para esos productos
  // impiden eliminar la configuración.
  if (productIds.length > 0) {
    const publishedOffer = await prisma.offer.findFirst({
      where: {
        userId,
        productId: {
          in: productIds,
        },
      },
      select: {
        id: true,
      },
    });

    if (publishedOffer) {
      throw new ConflictError(
        'No puedes eliminar esta configuración porque uno de tus productos publicados todavía la utiliza. Elimina primero esa publicación.'
      );
    }
  }

  // Desvincular los seguimientos antiguos y eliminar la configuración
  // dentro de una transacción para evitar cambios parciales.
  try {
    await prisma.$transaction(async (tx) => {
      await tx.monitor.updateMany({
        where: {
          configId,
          userId,
        },
        data: {
          configId: null,
        },
      });

      await tx.scrapeConfig.delete({
        where: {
          id: configId,
        },
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      throw new ConflictError(
        'No se puede eliminar esta configuración porque todavía tiene registros asociados. No se realizaron los cambios.'
      );
    }

    throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// DTO CONVERTER
// ─────────────────────────────────────────────────────────────

function toConfigDto(config: {
  id: string;
  userId: string;
  name: string;
  sourceUrl: string;
  sourceDomain: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  fields: Array<{
    id: string;
    label: string;
    selector: string;
    attribute: string | null;
    type: string;
    transform: Prisma.JsonValue;
    isPrimary: boolean;
    orderIndex: number;
  }>;
}): ConfigDto {
  return {
    id: config.id,
    userId: config.userId,
    name: config.name,
    sourceUrl: config.sourceUrl,
    sourceDomain: config.sourceDomain,
    status: config.status as ConfigDto['status'],
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
    fields: config.fields.map((field) => ({
      id: field.id,
      label: field.label,
      selector: field.selector,
      attribute: field.attribute,
      type: field.type as ConfigFieldDto['type'],
      transform: field.transform,
      isPrimary: field.isPrimary,
      orderIndex: field.orderIndex,
    })),
  };
}
