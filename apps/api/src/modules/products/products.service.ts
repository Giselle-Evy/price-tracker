import { Prisma } from '@prisma/client';

import { prisma } from '../../lib/prisma.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../lib/errors.js';
import type { SaveProductInput } from './products.schemas.js';

export type ProductImageDto = {
  url: string;
  alt: string | null;
  source: string | null;
  order: number | null;
};

export type ProductDto = {
  id: string;
  name: string;
  imageUrl: string | null;
  images: ProductImageDto[];
  description: string | null;
  currentPrice: number | null;
  previousPrice: number | null;
  canonicalUrl: string;
  originalUrl: string;
  domain: string;
  currency: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function saveProduct(input: SaveProductInput): Promise<ProductDto> {
  const canonicalUrl = canonicalizeUrl(input.url);
  validateCanonicalUrl(canonicalUrl);
  const { domain, images } = getProductDetails(input);

  const product = await prisma.product.upsert({
    where: { canonicalUrl },
    create: {
      name: input.name,
      imageUrl: input.imageUrl ?? null,
      images: images as Prisma.InputJsonValue,
      description: input.description ?? null,
      currentPrice: input.currentPrice ?? null,
      previousPrice: input.previousPrice ?? null,
      canonicalUrl,
      originalUrl: input.url,
      domain,
      currency: input.currency || null,
    },
    update: {
      name: input.name,
      imageUrl: input.imageUrl ?? undefined,
      images: images.length > 0 ? (images as Prisma.InputJsonValue) : undefined,
      description: input.description?.trim() || undefined,
      currentPrice: input.currentPrice ?? undefined,
      previousPrice: input.previousPrice ?? undefined,
      originalUrl: input.url,
      domain,
      currency: input.currency || undefined,
    },
  });

  return toProductDto(product);
}

export async function updateProduct(
  productId: string,
  input: SaveProductInput
): Promise<ProductDto> {
  const existing = await prisma.product.findUnique({ where: { id: productId } });
  if (!existing) throw new NotFoundError('Producto no encontrado');

  const canonicalUrl = canonicalizeUrl(input.url);
  validateCanonicalUrl(canonicalUrl);
  const { domain, images } = getProductDetails(input);

  try {
    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        name: input.name,
        imageUrl: input.imageUrl ?? null,
        images: images as Prisma.InputJsonValue,
        description: input.description ?? null,
        currentPrice: input.currentPrice ?? null,
        previousPrice: input.previousPrice ?? null,
        canonicalUrl,
        originalUrl: input.url,
        domain,
        currency: input.currency || null,
      },
    });
    return toProductDto(product);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictError('Ya existe un producto guardado con esa URL');
    }
    throw error;
  }
}

export async function getProduct(productId: string): Promise<ProductDto> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new NotFoundError('Producto no encontrado');
  return toProductDto(product);
}

function validateCanonicalUrl(canonicalUrl: string): void {
  if (canonicalUrl.length > 768) {
    throw new BadRequestError('La URL del producto excede el máximo admitido para guardarlo');
  }
}

function getProductDetails(input: SaveProductInput) {
  return {
    domain: new URL(input.url).hostname,
    images: input.images.map((image, index) => ({
      url: image.url,
      alt: image.alt ?? null,
      source: image.source ?? null,
      order: image.order ?? index + 1,
    })),
  };
}

function canonicalizeUrl(value: string): string {
  const parsed = new URL(value);
  parsed.hash = '';
  return parsed.href;
}

function toProductDto(
  product: Awaited<ReturnType<typeof prisma.product.findUniqueOrThrow>>
): ProductDto {
  return {
    id: product.id,
    name: product.name,
    imageUrl: product.imageUrl,
    images: parseImages(product.images),
    description: product.description,
    currentPrice: product.currentPrice === null ? null : Number(product.currentPrice),
    previousPrice:
      product.previousPrice === null ? null : Number(product.previousPrice),
    canonicalUrl: product.canonicalUrl,
    originalUrl: product.originalUrl,
    domain: product.domain,
    currency: product.currency,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

function parseImages(value: Prisma.JsonValue | null): ProductImageDto[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (
      item === null ||
      Array.isArray(item) ||
      typeof item !== 'object' ||
      typeof item.url !== 'string'
    ) {
      return [];
    }

    return [{
      url: item.url,
      alt: typeof item.alt === 'string' ? item.alt : null,
      source: typeof item.source === 'string' ? item.source : null,
      order: typeof item.order === 'number' ? item.order : null,
    }];
  });
}
