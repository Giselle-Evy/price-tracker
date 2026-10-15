import { once } from 'node:events';
import type { Server } from 'node:http';
import { Prisma } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockScrape,
  findProduct,
  findConfig,
  findMonitor,
  findMonitors,
  createMonitor,
  updateMonitor,
  deleteMonitor,
  scheduleMonitor,
  unscheduleMonitor,
  rescheduleMonitor,
} = vi.hoisted(() => ({
  mockScrape: vi.fn(),
  findProduct: vi.fn(),
  findConfig: vi.fn(),
  findMonitor: vi.fn(),
  findMonitors: vi.fn(),
  createMonitor: vi.fn(),
  updateMonitor: vi.fn(),
  deleteMonitor: vi.fn(),
  scheduleMonitor: vi.fn(),
  unscheduleMonitor: vi.fn(),
  rescheduleMonitor: vi.fn(),
}));

vi.mock('@price-tracker/shared/scraper', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@price-tracker/shared/scraper')>()),
  scrape: mockScrape,
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    product: { findUnique: findProduct },
    scrapeConfig: { findFirst: findConfig },
    monitor: {
      findFirst: findMonitor,
      findMany: findMonitors,
      create: createMonitor,
      update: updateMonitor,
      delete: deleteMonitor,
    },
  },
}));

vi.mock('../../lib/scheduler.js', () => ({
  scheduleMonitor,
  unscheduleMonitor,
  rescheduleMonitor,
}));

import { createApp } from '../../app.js';
import { signAccessToken } from '../../lib/jwt.js';
import { SharedBadRequestError } from '@price-tracker/shared/scraper';

const userId = '4ae9d08e-5884-4cc2-b2f3-51a4f1577be4';
const productId = '5efce18c-6f70-4d25-a6f8-8a3e09704e40';
const configId = '87a37817-ad6b-417e-8333-1719ee5f93a9';
const monitorId = '77a37817-ad6b-417e-8333-1719ee5f93a9';

const product = {
  id: productId,
  name: 'Producto seleccionado',
  canonicalUrl: 'https://www.shop.example/product/selected',
  originalUrl: 'https://www.shop.example/product/selected?ref=builder',
  domain: 'www.shop.example',
  imageUrl: 'https://cdn.example/product.jpg',
  currency: 'MXN',
};

const config = {
  id: configId,
  userId,
  name: 'Plantilla de tienda',
  sourceUrl: 'https://shop.example/template-product',
  sourceDomain: 'shop.example',
};

function monitorRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: monitorId,
    userId,
    productId,
    configId,
    extractionMode: 'manual',
    name: 'Producto seleccionado',
    url: product.canonicalUrl,
    imageUrl: product.imageUrl,
    currency: product.currency,
    currentPrice: null,
    previousPrice: null,
    targetPrice: null,
    durationDays: null,
    status: 'paused',
    frequencyMin: 'm30',
    alertOnDrop: true,
    alertEnabled: true,
    lastRunAt: null,
    lastSuccessAt: null,
    nextRunAt: null,
    createdAt: new Date('2026-10-13T00:00:00.000Z'),
    updatedAt: new Date('2026-10-13T00:00:00.000Z'),
    config,
    product: {
      id: product.id,
      name: product.name,
      imageUrl: product.imageUrl,
      canonicalUrl: product.canonicalUrl,
      domain: product.domain,
    },
    ...overrides,
  };
}

let persistedMonitor: ReturnType<typeof monitorRecord>;

describe('Monitors API product/config association', () => {
  let server: Server;
  let baseUrl: string;
  const token = signAccessToken({ userId, email: 'tester@example.com' });

  beforeEach(() => {
    findProduct.mockReset();
    findConfig.mockReset();
    findMonitor.mockReset();
    findMonitors.mockReset();
    createMonitor.mockReset();
    updateMonitor.mockReset();
    deleteMonitor.mockReset();
    scheduleMonitor.mockReset().mockResolvedValue(undefined);
    unscheduleMonitor.mockReset().mockResolvedValue(undefined);
    rescheduleMonitor.mockReset().mockResolvedValue(undefined);

    findProduct.mockResolvedValue(product);
    findConfig.mockResolvedValue(config);
    findMonitor.mockResolvedValue(null);
    findMonitors.mockResolvedValue([]);
    mockScrape.mockResolvedValue({
      html: '<meta itemprop="price" content="89.50">',
      finalUrl: product.canonicalUrl,
      statusCode: 200,
      contentType: 'text/html',
      durationMs: 1,
      method: 'cheerio',
    });
    createMonitor.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        persistedMonitor = monitorRecord({
          ...data,
          config: data.configId ? config : null,
        });
        return persistedMonitor;
      }
    );
    updateMonitor.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        persistedMonitor = {
          ...persistedMonitor,
          ...data,
          config: persistedMonitor.config,
        };
        return persistedMonitor;
      }
    );
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

  async function postMonitor(
    body: Record<string, unknown>,
    accessToken: string | null = token
  ) {
    return fetch(`${baseUrl}/monitors`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
    });
  }

  it('creates a monitor for the selected canonical product, not the config example URL', async () => {
    const response = await postMonitor({
      productId,
      configId,
      name: product.name,
      frequencyMin: 'm15',
      durationDays: 10,
    });
    const saved = await response.json();

    expect(response.status).toBe(201);
    expect(saved).toMatchObject({
      productId,
      configId,
      url: product.canonicalUrl,
      frequencyMin: 'm15',
      durationDays: 10,
      product: { canonicalUrl: product.canonicalUrl },
    });
    expect(createMonitor).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productId,
          configId,
          url: product.canonicalUrl,
          durationDays: 10,
        }),
      })
    );
    expect(scheduleMonitor).toHaveBeenCalledOnce();
  });

  it('creates an automatic monitor only after the shared extractor validates a real price', async () => {
    const response = await postMonitor({
      productId,
      name: product.name,
      frequencyMin: 'm15',
    });
    const saved = await response.json();

    expect(response.status).toBe(201);
    expect(saved).toMatchObject({
      productId,
      configId: null,
      extractionMode: 'automatic',
      currentPrice: 89.5,
      status: 'active',
      config: null,
    });
    expect(mockScrape).toHaveBeenCalledWith(product.canonicalUrl);
    expect(createMonitor).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          configId: null,
          extractionMode: 'automatic',
          currentPrice: 89.5,
          status: 'pending',
        }),
      })
    );
    expect(scheduleMonitor).toHaveBeenCalledOnce();
    expect(updateMonitor).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'active' },
      })
    );
  });

  it('does not create a monitor when automatic extraction cannot find a valid price', async () => {
    mockScrape.mockResolvedValue({
      html: '<html><body><h1>Product with no price</h1></body></html>',
      finalUrl: product.canonicalUrl,
      statusCode: 200,
      contentType: 'text/html',
      durationMs: 1,
      method: 'cheerio',
    });

    const response = await postMonitor({
      productId,
      name: product.name,
      frequencyMin: 'm15',
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining('No se detectó un precio válido'),
    });
    expect(createMonitor).not.toHaveBeenCalled();
    expect(scheduleMonitor).not.toHaveBeenCalled();
  });

  it('preserves DNS retryability and status when automatic price validation fails', async () => {
    mockScrape.mockRejectedValue(
      new SharedBadRequestError(
        'No se pudo resolver el dominio "www.shop.example" (EAI_AGAIN)',
        502,
        { retryable: true }
      )
    );

    const response = await postMonitor({
      productId,
      name: product.name,
      frequencyMin: 'm15',
    });

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining('EAI_AGAIN'),
    });
    expect(createMonitor).not.toHaveBeenCalled();
    expect(scheduleMonitor).not.toHaveBeenCalled();
  });

  it('does not report an active monitor when the scheduler rejects registration', async () => {
    scheduleMonitor.mockRejectedValue(new Error('Redis unavailable'));

    const response = await postMonitor({
      productId,
      name: product.name,
      frequencyMin: 'm15',
    });

    expect(response.status).toBe(503);
    expect(createMonitor).toHaveBeenCalledOnce();
    expect(updateMonitor).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'error' },
      })
    );
  });

  it.each(['m5', 'm15', 'm30'])('accepts new monitor frequency %s', async (frequencyMin) => {
    const response = await postMonitor({
      productId,
      configId,
      name: product.name,
      frequencyMin,
      durationDays: 5,
    });

    expect(response.status).toBe(201);
  });

  it('rejects the legacy 10-minute frequency for new monitors', async () => {
    const response = await postMonitor({
      productId,
      configId,
      name: product.name,
      frequencyMin: 'm10',
    });

    expect(response.status).toBe(422);
    expect(createMonitor).not.toHaveBeenCalled();
  });

  it('creates a monitor without a duration when no duration is selected in the UI', async () => {
    const response = await postMonitor({
      productId,
      configId,
      name: product.name,
      frequencyMin: 'm15',
    });

    expect(response.status).toBe(201);
    expect(createMonitor).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ durationDays: null }),
      })
    );
  });

  it('defaults new monitors to 15 minutes and rejects 10 minutes for creation', async () => {
    const defaultResponse = await postMonitor({
      productId,
      configId,
      name: product.name,
      durationDays: 5,
    });
    expect(defaultResponse.status).toBe(201);
    expect(createMonitor.mock.calls[0][0].data.frequencyMin).toBe('m15');

    createMonitor.mockClear();
    const legacyFrequencyResponse = await postMonitor({
      productId,
      configId,
      name: product.name,
      frequencyMin: 'm10',
      durationDays: 5,
    });
    expect(legacyFrequencyResponse.status).toBe(422);
    expect(createMonitor).not.toHaveBeenCalled();
  });

  it.each([5, 10, 15])('persists and returns a %i-day duration', async (durationDays) => {
    const response = await postMonitor({
      productId,
      configId,
      name: product.name,
      durationDays,
    });
    const saved = await response.json();

    expect(response.status).toBe(201);
    expect(saved).toMatchObject({ durationDays });
    expect(createMonitor).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ durationDays }),
      })
    );
  });

  it.each([null, 0, 7, 30, -5, '5', '10', true])(
    'rejects invalid duration %s',
    async (durationDays) => {
      const body = {
        productId,
        configId,
        name: product.name,
        ...(durationDays !== undefined ? { durationDays } : {}),
      };

      const response = await postMonitor(body);

      expect(response.status).toBe(422);
      expect(createMonitor).not.toHaveBeenCalled();
    }
  );

  it('rejects a configuration not owned by the authenticated user', async () => {
    findConfig.mockResolvedValue(null);

    const response = await postMonitor({
      productId,
      configId,
      name: product.name,
      durationDays: 5,
    });

    expect(response.status).toBe(404);
    expect(findConfig).toHaveBeenCalledWith({
      where: { id: configId, userId },
    });
    expect(createMonitor).not.toHaveBeenCalled();
  });

  it('rejects an incompatible product domain without using a loose hostname suffix', async () => {
    findProduct.mockResolvedValue({
      ...product,
      canonicalUrl: 'https://notshop.example.evil.test/item',
    });

    const response = await postMonitor({
      productId,
      configId,
      name: product.name,
      durationDays: 5,
    });

    expect(response.status).toBe(400);
    expect(createMonitor).not.toHaveBeenCalled();
  });

  it('converts a database uniqueness collision into a conflict response', async () => {
    createMonitor.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      })
    );

    const response = await postMonitor({
      productId,
      configId,
      name: product.name,
      durationDays: 5,
    });

    expect(response.status).toBe(409);
    expect(scheduleMonitor).not.toHaveBeenCalled();
  });

  it('returns the persisted duration when retrieving a monitor', async () => {
    findMonitor.mockResolvedValue(monitorRecord({ durationDays: 10 }));

    const response = await fetch(`${baseUrl}/monitors/${monitorId}`, {
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ durationDays: 10 });
  });

  it('returns null duration for a monitor created before duration tracking', async () => {
    findMonitor.mockResolvedValue(monitorRecord({ durationDays: null }));

    const response = await fetch(`${baseUrl}/monitors/${monitorId}`, {
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ durationDays: null });
  });

  it('allows an existing 30-minute monitor to retain its legacy frequency', async () => {
    findMonitor.mockResolvedValue(monitorRecord());
    updateMonitor.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) =>
        monitorRecord({ ...data, frequencyMin: 'm30' })
    );

    const response = await fetch(`${baseUrl}/monitors/${monitorId}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: 'Legacy monitor', frequencyMin: 'm30' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ frequencyMin: 'm30' });
  });

  it('allows an existing 10-minute monitor to retain its legacy frequency', async () => {
    findMonitor.mockResolvedValue(monitorRecord({ frequencyMin: 'm10' }));
    updateMonitor.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) =>
        monitorRecord({ ...data, frequencyMin: 'm10' })
    );

    const response = await fetch(`${baseUrl}/monitors/${monitorId}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: 'Legacy 10-minute monitor', frequencyMin: 'm10' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ frequencyMin: 'm10' });
  });

  it('allows changing a new-format monitor to the 30-minute frequency', async () => {
    findMonitor.mockResolvedValue(monitorRecord({ frequencyMin: 'm5' }));
    updateMonitor.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) =>
        monitorRecord({ ...data, frequencyMin: 'm30' })
    );

    const response = await fetch(`${baseUrl}/monitors/${monitorId}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ frequencyMin: 'm30' }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ frequencyMin: 'm30' });
    expect(updateMonitor).toHaveBeenCalled();
  });

  it('does not allow another user to retrieve or update a monitor', async () => {
    findMonitor.mockResolvedValue(null);
    const getResponse = await fetch(`${baseUrl}/monitors/${monitorId}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const updateResponse = await fetch(`${baseUrl}/monitors/${monitorId}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: 'Unauthorized update' }),
    });

    expect(getResponse.status).toBe(404);
    expect(updateResponse.status).toBe(404);
    expect(findMonitor).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: monitorId, userId } })
    );
    expect(updateMonitor).not.toHaveBeenCalled();
  });
});
