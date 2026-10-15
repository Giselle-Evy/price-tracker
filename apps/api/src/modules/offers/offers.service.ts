import { prisma } from '../../lib/prisma.js';
import { NotFoundError } from '../../lib/errors.js';
import type { CreateOfferInput, UpdateOfferInput } from './offers.schemas.js';

export type PublicOfferDto = {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  previousPrice: number | null;
  originalUrl: string;
  imageUrl: string | null;
  currency: string | null;
  publishedAt: string;
};

export type OfferDetailDto = PublicOfferDto & {
  isOwner: boolean;
  sourceType: 'manual' | 'scraped';
  product: {
    id: string;
    name: string;
    imageUrl: string | null;
    currentPrice: number | null;
    previousPrice: number | null;
    currency: string | null;
    originalUrl: string;
  };
  monitoring: {
    status: 'active' | 'paused' | 'error' | 'pending';
    frequencyMin: 'm5' | 'm10' | 'm15' | 'm30';
    lastSuccessAt: string | null;
    currentPrice: number | null;
    history: Array<{ price: number; currency: string | null; observedAt: string }>;
  } | null;
};

function toPublicOfferDto(offer: {
  id: string;
  title: string;
  description: string | null;
  price: { toNumber(): number } | null;
  previousPrice: { toNumber(): number } | null;
  url: string;
  createdAt: Date;
  product: {
    imageUrl: string | null;
    currency: string | null;
  };
}): PublicOfferDto {
  return {
    id: offer.id,
    title: offer.title,
    description: offer.description,
    price: offer.price?.toNumber() ?? null,
    previousPrice: offer.previousPrice?.toNumber() ?? null,
    originalUrl: offer.url,
    imageUrl: offer.product.imageUrl,
    currency: offer.product.currency,
    publishedAt: offer.createdAt.toISOString(),
  };
}

export async function createOffer(
  userId: string,
  input: CreateOfferInput
): Promise<PublicOfferDto> {
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
  });
  if (!product) throw new NotFoundError('Producto no encontrado');

  const offer = await prisma.offer.create({
    data: {
      userId,
      productId: product.id,
      title: input.title,
      description: input.description?.trim() || null,
      price:
        input.price !== undefined
          ? input.price
          : product.currentPrice === null
            ? null
            : Number(product.currentPrice),
      previousPrice:
        input.previousPrice !== undefined
          ? input.previousPrice
          : product.previousPrice === null
            ? null
            : Number(product.previousPrice),
      url: product.originalUrl,
      sourceType: 'manual',
    },
    include: { product: { select: { imageUrl: true, currency: true } } },
  });

  return toPublicOfferDto(offer);
}

export async function listOffers(page: number, limit: number) {
  const where = {};
  const [offers, total] = await Promise.all([
    prisma.offer.findMany({
      where,
      include: { product: { select: { imageUrl: true, currency: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.offer.count({ where }),
  ]);

  return {
    offers: offers.map(toPublicOfferDto),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function updateOffer(
  userId: string,
  offerId: string,
  input: UpdateOfferInput
): Promise<PublicOfferDto> {
  const result = await prisma.offer.updateMany({
    where: { id: offerId, userId },
    data: input,
  });
  if (result.count === 0) throw new NotFoundError('Oferta no encontrada');

  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: { product: { select: { imageUrl: true, currency: true } } },
  });
  if (!offer) throw new NotFoundError('Oferta no encontrada');
  return toPublicOfferDto(offer);
}

export async function deleteOffer(userId: string, offerId: string): Promise<void> {
  const result = await prisma.offer.deleteMany({
    where: { id: offerId, userId },
  });
  if (result.count === 0) throw new NotFoundError('Oferta no encontrada');
}

export async function getOffer(
  offerId: string,
  userId?: string
): Promise<OfferDetailDto> {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
          currentPrice: true,
          previousPrice: true,
          currency: true,
          originalUrl: true,
        },
      },
    },
  });
  if (!offer) throw new NotFoundError('Oferta no encontrada');

  const monitor = await prisma.monitor.findFirst({
    where: { productId: offer.productId, userId: offer.userId },
    orderBy: [{ lastSuccessAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      status: true,
      frequencyMin: true,
      lastSuccessAt: true,
      currentPrice: true,
      priceHistory: {
        orderBy: { observedAt: 'desc' },
        take: 500,
        select: { price: true, currency: true, observedAt: true },
      },
    },
  });

  const history = monitor?.priceHistory
    .slice()
    .reverse()
    .map((entry) => ({
      price: entry.price.toNumber(),
      currency: entry.currency,
      observedAt: entry.observedAt.toISOString(),
    })) ?? [];

  return {
    ...toPublicOfferDto(offer),
    isOwner: userId === offer.userId,
    sourceType: offer.sourceType,
    product: {
      ...offer.product,
      currentPrice:
        offer.product.currentPrice === null ? null : Number(offer.product.currentPrice),
      previousPrice:
        offer.product.previousPrice === null ? null : Number(offer.product.previousPrice),
    },
    monitoring: monitor
      ? {
          status: monitor.status,
          frequencyMin: monitor.frequencyMin,
          lastSuccessAt: monitor.lastSuccessAt?.toISOString() ?? null,
          currentPrice: monitor.currentPrice?.toNumber() ?? null,
          history,
        }
      : null,
  };
}
