import { once } from 'node:events';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  findProduct,
  createOfferRecord,
  findOffers,
  countOffers,
  findOffer,
  findMonitor,
  updateOfferRecord,
  deleteOfferRecord,
} = vi.hoisted(() => ({
  findProduct: vi.fn(),
  createOfferRecord: vi.fn(),
  findOffers: vi.fn(),
  countOffers: vi.fn(),
  findOffer: vi.fn(),
  findMonitor: vi.fn(),
  updateOfferRecord: vi.fn(),
  deleteOfferRecord: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    product: { findUnique: findProduct },
    offer: {
      create: createOfferRecord,
      findMany: findOffers,
      count: countOffers,
      findUnique: findOffer,
      updateMany: updateOfferRecord,
      deleteMany: deleteOfferRecord,
    },
    monitor: { findFirst: findMonitor },
  },
}));

import { createApp } from '../../app.js';
import { signAccessToken } from '../../lib/jwt.js';

const userId = '4ae9d08e-5884-4cc2-b2f3-51a4f1577be4';
const productId = '5efce18c-6f70-4d25-a6f8-8a3e09704e40';
const offerId = '77a37817-ad6b-417e-8333-1719ee5f93a9';
const token = signAccessToken({ userId, email: 'tester@example.com' });
const otherUserId = 'a48ec9f5-c8c0-43fd-89de-37639fcb92cb';
const otherUserToken = signAccessToken({ userId: otherUserId, email: 'other@example.com' });
const decimal = (value: number) => ({
  toNumber: () => value,
  valueOf: () => value,
});

const product = {
  id: productId,
  name: 'Producto guardado',
  imageUrl: 'https://cdn.example/product.jpg',
  currentPrice: decimal(89.5),
  previousPrice: decimal(110),
  currency: 'MXN',
  originalUrl: 'https://shop.example/product?ref=saved',
};

function offerRecord() {
  return {
    id: offerId,
    userId,
    productId,
    title: 'Oferta revisada',
    description: 'Precio especial',
    price: decimal(85),
    previousPrice: decimal(110),
    url: product.originalUrl,
    sourceType: 'manual',
    verified: false,
    createdAt: new Date('2026-10-13T18:00:00.000Z'),
    product: { imageUrl: product.imageUrl, currency: product.currency },
  };
}

describe('Offers API', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(() => {
    findProduct.mockReset().mockResolvedValue(product);
    createOfferRecord.mockReset().mockImplementation(async ({ data }) => ({
      ...offerRecord(),
      ...data,
      price: decimal(data.price),
      previousPrice: decimal(data.previousPrice),
      product: { imageUrl: product.imageUrl, currency: product.currency },
    }));
    findOffers.mockReset().mockResolvedValue([offerRecord()]);
    countOffers.mockReset().mockResolvedValue(1);
    findOffer.mockReset().mockResolvedValue({
      ...offerRecord(),
      product: {
        id: productId,
        name: product.name,
        imageUrl: product.imageUrl,
        currentPrice: product.currentPrice,
        previousPrice: product.previousPrice,
        currency: product.currency,
        originalUrl: product.originalUrl,
      },
    });
    updateOfferRecord.mockReset().mockResolvedValue({ count: 1 });
    deleteOfferRecord.mockReset().mockResolvedValue({ count: 1 });
    findMonitor.mockReset().mockResolvedValue({
      id: 'private-monitor-id',
      userId,
      status: 'active',
      frequencyMin: 'm15',
      lastSuccessAt: new Date('2026-10-13T19:00:00.000Z'),
      currentPrice: decimal(85),
      priceHistory: [
        {
          price: decimal(85),
          currency: 'MXN',
          observedAt: new Date('2026-10-13T19:00:00.000Z'),
        },
        {
          price: decimal(89.5),
          currency: 'MXN',
          observedAt: new Date('2026-10-13T18:00:00.000Z'),
        },
      ],
    });
  });

  beforeAll(async () => {
    server = createApp().listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('The test API did not bind to a TCP port');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (server?.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  function postOffer(body: Record<string, unknown>, accessToken: string | null = token) {
    return fetch(`${baseUrl}/offers`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
    });
  }

  function patchOffer(
    body: Record<string, unknown>,
    accessToken: string | null = token,
    targetId = offerId
  ) {
    return fetch(`${baseUrl}/offers/${targetId}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        ...(accessToken ? { authorization: ['Bearer', accessToken].join(' ') } : {}),
      },
      body: JSON.stringify(body),
    });
  }

  function deleteOfferRequest(accessToken: string | null = token, targetId = offerId) {
    return fetch(`${baseUrl}/offers/${targetId}`, {
      method: 'DELETE',
      headers: accessToken ? { authorization: ['Bearer', accessToken].join(' ') } : {},
    });
  }

  it('requires authentication before publishing', async () => {
    const response = await postOffer({ productId, title: 'Oferta' }, null);
    expect(response.status).toBe(401);
    expect(createOfferRecord).not.toHaveBeenCalled();
  });

  it('creates an offer linked to the existing product and authenticated author', async () => {
    const response = await postOffer({
      productId,
      title: 'Oferta revisada',
      description: 'Precio especial',
      price: 85,
      previousPrice: 110,
      userId: 'attacker-controlled-id',
      url: 'https://other.example/',
    });
    const result = await response.json() as {
      offers: Array<{ title: string; originalUrl: string; userId?: string }>;
      pagination: { total: number };
    };

    expect(response.status).toBe(201);
    expect(createOfferRecord).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId,
        productId,
        title: 'Oferta revisada',
        url: product.originalUrl,
        price: 85,
        previousPrice: 110,
      }),
      include: { product: { select: { imageUrl: true, currency: true } } },
    }));
    expect(result).toMatchObject({
      title: 'Oferta revisada',
      originalUrl: product.originalUrl,
      imageUrl: product.imageUrl,
      price: 85,
    });
    expect(result).not.toHaveProperty('userId');
  });

  it('returns understandable validation errors and rejects non-positive prices', async () => {
    const response = await postOffer({ productId, title: ' ', price: -2 });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: 'Validation error',
      details: expect.objectContaining({
        title: expect.any(Array),
        price: expect.any(Array),
      }),
    });
    expect(createOfferRecord).not.toHaveBeenCalled();
  });

  it('rejects a product ID that does not resolve to a saved product', async () => {
    findProduct.mockResolvedValueOnce(null);
    const response = await postOffer({ productId, title: 'Oferta' });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: 'Producto no encontrado' });
    expect(createOfferRecord).not.toHaveBeenCalled();
  });

  it('lists published offers publicly with bounded pagination and safe DTOs', async () => {
    const response = await fetch(`${baseUrl}/offers?page=1&limit=10`);
    const result = await response.json() as {
      offers: Array<{ title: string; originalUrl: string; userId?: string }>;
      pagination: { total: number };
    };

    expect(response.status).toBe(200);
    expect(findOffers).toHaveBeenCalledWith(expect.objectContaining({ take: 10, skip: 0 }));
    expect(result.offers[0]).toMatchObject({
      title: 'Oferta revisada',
      originalUrl: product.originalUrl,
    });
    expect(result.offers[0]).not.toHaveProperty('userId');
    expect(result.pagination.total).toBe(1);
  });

  it('returns public detail, actual monitoring history, and no private monitor controls', async () => {
    const response = await fetch(`${baseUrl}/offers/${offerId}`);
    const result = await response.json() as {
      originalUrl: string;
      userId?: string;
      product: { id: string; name: string };
      monitoring: {
        status: string;
        frequencyMin: string;
        currentPrice: number;
        history: Array<{ price: number; observedAt: string }>;
        id?: string;
        userId?: string;
      };
    };

    expect(response.status).toBe(200);
    expect(findMonitor).toHaveBeenCalledWith(expect.objectContaining({
      where: { productId, userId },
    }));
    expect(result).toMatchObject({
      originalUrl: product.originalUrl,
      product: { id: productId, name: product.name },
      monitoring: {
        status: 'active',
        frequencyMin: 'm15',
        currentPrice: 85,
        history: [
          { price: 89.5, observedAt: '2026-10-13T18:00:00.000Z' },
          { price: 85, observedAt: '2026-10-13T19:00:00.000Z' },
        ],
      },
    });
    expect(result).not.toHaveProperty('userId');
    expect(result.monitoring).not.toHaveProperty('id');
    expect(result.monitoring).not.toHaveProperty('userId');
    expect(result.monitoring.history).toHaveLength(2);
    expect(result).toMatchObject({ isOwner: false });
  });

  it('marks offer ownership only for the authenticated author on public detail', async () => {
    const response = await fetch(`${baseUrl}/offers/${offerId}`, {
      headers: { authorization: ['Bearer', token].join(' ') },
    });
    const result = await response.json() as { isOwner: boolean; userId?: string };

    expect(response.status).toBe(200);
    expect(result).toMatchObject({ isOwner: true });
    expect(result).not.toHaveProperty('userId');
  });

  it('lets the author edit the existing offer without creating another one', async () => {
    findOffer.mockResolvedValueOnce({
      ...offerRecord(),
      title: 'Título actualizado',
      description: 'Descripción actualizada',
      product: { imageUrl: product.imageUrl, currency: product.currency },
    });
    const response = await patchOffer({
      title: 'Título actualizado',
      description: 'Descripción actualizada',
    });
    const result = await response.json() as { id: string; title: string };

    expect(response.status).toBe(200);
    expect(result).toMatchObject({ id: offerId, title: 'Título actualizado' });
    expect(updateOfferRecord).toHaveBeenCalledWith({
      where: { id: offerId, userId },
      data: { title: 'Título actualizado', description: 'Descripción actualizada' },
    });
    expect(createOfferRecord).not.toHaveBeenCalled();
  });

  it('rejects editing another author’s offer and unauthenticated edits', async () => {
    updateOfferRecord.mockResolvedValueOnce({ count: 0 });
    const forbiddenResponse = await patchOffer(
      { title: 'Cambio ajeno' },
      otherUserToken
    );
    const unauthenticatedResponse = await patchOffer({ title: 'Cambio sin sesión' }, null);

    expect(forbiddenResponse.status).toBe(404);
    expect(await forbiddenResponse.json()).toMatchObject({ error: 'Oferta no encontrada' });
    expect(unauthenticatedResponse.status).toBe(401);
    expect(updateOfferRecord).toHaveBeenCalledTimes(1);
  });

  it('rejects empty and protected-field offer updates', async () => {
    const emptyResponse = await patchOffer({});
    const protectedResponse = await patchOffer({ productId });

    expect(emptyResponse.status).toBe(422);
    expect(protectedResponse.status).toBe(422);
    expect(updateOfferRecord).not.toHaveBeenCalled();
  });

  it('lets the author delete only the offer record', async () => {
    const response = await deleteOfferRequest();

    expect(response.status).toBe(204);
    expect(deleteOfferRecord).toHaveBeenCalledWith({
      where: { id: offerId, userId },
    });
    expect(findProduct).not.toHaveBeenCalled();
    expect(findMonitor).not.toHaveBeenCalled();
  });

  it('rejects deleting another author’s offer and unauthenticated deletes', async () => {
    deleteOfferRecord.mockResolvedValueOnce({ count: 0 });
    const forbiddenResponse = await deleteOfferRequest(otherUserToken);
    const unauthenticatedResponse = await deleteOfferRequest(null);

    expect(forbiddenResponse.status).toBe(404);
    expect(await forbiddenResponse.json()).toMatchObject({ error: 'Oferta no encontrada' });
    expect(unauthenticatedResponse.status).toBe(401);
    expect(deleteOfferRecord).toHaveBeenCalledTimes(1);
  });
});
