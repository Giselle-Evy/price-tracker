
import { once } from 'node:events';
import type { Server } from 'node:http';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

type StoredField = {
  id: string;
  label: string;
  selector: string;
  attribute: string | null;
  type: 'text' | 'price' | 'image' | 'url';
  transform: Record<string, unknown> | null;
  isPrimary: boolean;
  orderIndex: number;
};

type StoredConfig = {
  id: string;
  userId: string;
  name: string;
  sourceUrl: string;
  sourceDomain: string;
  status: 'draft' | 'active' | 'error' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  fields: StoredField[];
};

const {
  configs,
  findFirst,
  findMany,
  update,
  remove,
  monitorFindMany,
  offerFindFirst,
  monitorUpdateMany,
  transaction,
} = vi.hoisted(() => ({
  configs: new Map<string, StoredConfig>(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  monitorFindMany: vi.fn(),
  offerFindFirst: vi.fn(),
  monitorUpdateMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    scrapeConfig: {
      findFirst,
      findMany,
      update,
      delete: remove,
    },
    monitor: {
      findMany: monitorFindMany,
      updateMany: monitorUpdateMany,
    },
    offer: {
      findFirst: offerFindFirst,
    },
    $transaction: transaction,
  },
}));

import { createApp } from '../../app.js';
import { signAccessToken } from '../../lib/jwt.js';

const configId = '87a37817-ad6b-417e-8333-1719ee5f93a9';
const otherConfigId = '4c82f63d-40f6-4f43-bcee-a5cc6f1fe4c0';
const userId = '4ae9d08e-5884-4cc2-b2f3-51a4f1577be4';

describe('Configurations API edit flow', () => {
  let server: Server;
  let baseUrl: string;

  const token = signAccessToken({
    userId,
    email: 'tester@example.com',
  });

  beforeEach(() => {
    configs.clear();

    findFirst.mockReset();
    findMany.mockReset();
    update.mockReset();
    remove.mockReset();
    monitorFindMany.mockReset();
    offerFindFirst.mockReset();
    monitorUpdateMany.mockReset();
    transaction.mockReset();

    monitorFindMany.mockResolvedValue([]);
    offerFindFirst.mockResolvedValue(null);
    monitorUpdateMany.mockResolvedValue({ count: 0 });

    transaction.mockImplementation(
      async (
        callback: (tx: {
          monitor: {
            updateMany: typeof monitorUpdateMany;
          };
          scrapeConfig: {
            delete: typeof remove;
          };
        }) => Promise<void>,
      ) =>
        callback({
          monitor: {
            updateMany: monitorUpdateMany,
          },
          scrapeConfig: {
            delete: remove,
          },
        }),
    );

    const now = new Date('2026-10-13T00:00:00.000Z');

    configs.set(configId, {
      id: configId,
      userId,
      name: 'Saved config',
      sourceUrl: 'https://shop.example/product',
      sourceDomain: 'shop.example',
      status: 'active',
      createdAt: now,
      updatedAt: now,
      fields: [
        {
          id: 'saved-field-1',
          label: 'Manual title',
          selector: '.manual-title',
          attribute: null,
          type: 'text',
          transform: { trim: true },
          isPrimary: true,
          orderIndex: 0,
        },
      ],
    });

    configs.set(otherConfigId, {
      ...configs.get(configId)!,
      id: otherConfigId,
      userId: 'another-user',
      name: 'Unrelated config',
      sourceUrl: 'https://other.example/item',
      sourceDomain: 'other.example',
      fields: [],
    });

    findFirst.mockImplementation(
      async ({
        where,
      }: {
        where: { id: string; userId?: string };
      }) => {
        const config = configs.get(where.id);

        return config && (!where.userId || config.userId === where.userId)
          ? { ...config, _count: { monitors: 0 } }
          : null;
      },
    );

    findMany.mockImplementation(
      async ({
        where,
      }: {
        where: { userId: string };
      }) =>
        [...configs.values()]
          .filter((config) => config.userId === where.userId)
          .map((config) => ({ ...config })),
    );

    remove.mockImplementation(
      async ({
        where,
      }: {
        where: { id: string };
      }) => {
        configs.delete(where.id);
      },
    );

    update.mockImplementation(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const current = configs.get(where.id);

        if (!current) {
          throw new Error('Expected config to update');
        }

        const fieldsUpdate = data.fields as
          | {
              deleteMany: Record<string, never>;
              create: Array<Omit<StoredField, 'id'>>;
            }
          | undefined;

        const next: StoredConfig = {
          ...current,
          ...(typeof data.name === 'string'
            ? { name: data.name }
            : {}),
          ...(typeof data.status === 'string'
            ? { status: data.status as StoredConfig['status'] }
            : {}),
          ...(typeof data.sourceUrl === 'string'
            ? { sourceUrl: data.sourceUrl }
            : {}),
          ...(typeof data.sourceDomain === 'string'
            ? { sourceDomain: data.sourceDomain }
            : {}),
          ...(fieldsUpdate
            ? {
                fields: fieldsUpdate.create.map((field, index) => ({
                  ...field,
                  id: `updated-field-${index}`,
                })),
              }
            : {}),
          updatedAt: new Date(),
        };

        configs.set(where.id, next);

        return next;
      },
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
        server.close((error) =>
          error ? reject(error) : resolve(),
        );
      });
    }
  });

  it('lists only configurations owned by the authenticated user', async () => {
    const response = await fetch(`${baseUrl}/configs`, {
      headers: { authorization: `Bearer ${token}` },
    });

    const body = (await response.json()) as {
      configs: StoredConfig[];
    };

    expect(response.status).toBe(200);
    expect(body.configs).toHaveLength(1);

    expect(body.configs[0]).toMatchObject({
      id: configId,
      name: 'Saved config',
      sourceDomain: 'shop.example',
    });

    expect(
      body.configs.some(
        (config: StoredConfig) => config.id === otherConfigId,
      ),
    ).toBe(false);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId },
      }),
    );
  });

  it('updates persisted fields and URL on the same config, preserving other configs', async () => {
    const detailResponse = await fetch(
      `${baseUrl}/configs/${configId}`,
      {
        headers: { authorization: `Bearer ${token}` },
      },
    );

    const detail = await detailResponse.json();

    expect(detail).toMatchObject({
      id: configId,
      sourceUrl: 'https://shop.example/product',
      fields: [
        {
          selector: '.manual-title',
          transform: { trim: true },
          isPrimary: true,
        },
      ],
    });

    const updateResponse = await fetch(
      `${baseUrl}/configs/${configId}`,
      {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: 'Config corrected',
          sourceUrl: 'https://new-shop.example/item',
          fields: [
            {
              label: 'Title corrected',
              selector: '.title-corrected',
              type: 'text',
              transform: { trim: true },
              isPrimary: true,
              orderIndex: 0,
            },
            {
              label: 'Price corrected',
              selector: '[data-price="sale"]',
              attribute: 'content',
              type: 'price',
              isPrimary: false,
              orderIndex: 1,
            },
          ],
        }),
      },
    );

    const updated = await updateResponse.json();

    expect(updateResponse.status).toBe(200);

    expect(updated).toMatchObject({
      id: configId,
      name: 'Config corrected',
      sourceUrl: 'https://new-shop.example/item',
      sourceDomain: 'new-shop.example',
      fields: [
        {
          label: 'Title corrected',
          selector: '.title-corrected',
          transform: { trim: true },
          isPrimary: true,
        },
        {
          label: 'Price corrected',
          selector: '[data-price="sale"]',
          attribute: 'content',
          isPrimary: false,
        },
      ],
    });

    const reopenedResponse = await fetch(
      `${baseUrl}/configs/${configId}`,
      {
        headers: { authorization: `Bearer ${token}` },
      },
    );

    expect(await reopenedResponse.json()).toMatchObject({
      id: configId,
      name: 'Config corrected',
      sourceUrl: 'https://new-shop.example/item',
      fields: [
        { selector: '.title-corrected', transform: { trim: true } },
        { selector: '[data-price="sale"]' },
      ],
    });

    expect(configs.size).toBe(2);

    expect(configs.get(otherConfigId)).toMatchObject({
      name: 'Unrelated config',
      sourceUrl: 'https://other.example/item',
      fields: [],
    });

    expect(update).toHaveBeenCalledTimes(1);
  });

  it('physically deletes an owned config without monitors and preserves auth and ownership checks', async () => {
    const unauthenticated = await fetch(
      `${baseUrl}/configs/${configId}`,
      { method: 'DELETE' },
    );

    expect(unauthenticated.status).toBe(401);

    const foreignConfig = await fetch(
      `${baseUrl}/configs/${otherConfigId}`,
      {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
      },
    );

    expect(foreignConfig.status).toBe(404);
    expect(configs.has(otherConfigId)).toBe(true);

    const removed = await fetch(
      `${baseUrl}/configs/${configId}`,
      {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
      },
    );

    expect(removed.status).toBe(204);
    expect(configs.has(configId)).toBe(false);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('deletes a config with old monitors when the user has no published offers for those products', async () => {
    monitorFindMany.mockResolvedValueOnce([
      { productId: 'product-1' },
    ]);

    offerFindFirst.mockResolvedValueOnce(null);

    const response = await fetch(
      `${baseUrl}/configs/${configId}`,
      {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
      },
    );

    expect(response.status).toBe(204);

    expect(monitorUpdateMany).toHaveBeenCalledWith({
      where: { configId, userId },
      data: { configId: null },
    });

    expect(remove).toHaveBeenCalledWith({
      where: { id: configId },
    });
  });

  it('blocks deletion when the user has a published offer for a linked product', async () => {
    monitorFindMany.mockResolvedValueOnce([
      { productId: 'product-1' },
    ]);

    offerFindFirst.mockResolvedValueOnce({
      id: 'offer-1',
    });

    const response = await fetch(
      `${baseUrl}/configs/${configId}`,
      {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
      },
    );

    expect(response.status).toBe(409);

    expect(await response.json()).toMatchObject({
  error: expect.stringContaining('productos publicados'),
});

    expect(remove).not.toHaveBeenCalled();
    expect(monitorUpdateMany).not.toHaveBeenCalled();
  });

  it('keeps the foreign-key race failure understandable without claiming success', async () => {
    const { Prisma } = await import('@prisma/client');

    transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint failed',
        {
          code: 'P2003',
          clientVersion: 'test',
        },
      ),
    );

    const response = await fetch(
      `${baseUrl}/configs/${configId}`,
      {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token}` },
      },
    );

    expect(response.status).toBe(409);

    expect(await response.json()).toMatchObject({
  error: expect.stringContaining('registros asociados'),
});

    expect(configs.has(configId)).toBe(true);
  });
});
