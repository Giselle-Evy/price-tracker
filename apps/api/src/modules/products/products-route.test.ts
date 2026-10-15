import { once } from 'node:events';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

type SavedProduct = {
  id: string;
  name: string;
  imageUrl: string | null;
  description: string | null;
  currentPrice: number | null;
  previousPrice: number | null;
  images: Array<{ url: string; alt: string | null; source: string | null; order: number }> | null;
  canonicalUrl: string;
  originalUrl: string;
  domain: string;
  currency: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const { products, upsertProduct, findProduct, updateProduct } = vi.hoisted(() => {
  const products = new Map<string, SavedProduct>();
  const upsertProduct = vi.fn();
  const findProduct = vi.fn();
  const updateProduct = vi.fn();
  return { products, upsertProduct, findProduct, updateProduct };
});

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    product: {
      upsert: upsertProduct,
      findUnique: findProduct,
      update: updateProduct,
    },
  },
}));

vi.mock('../../lib/scrapeQueue.js', () => ({
  scrapeQueue: { add: vi.fn(), removeRepeatable: vi.fn() },
  closeApiScrapeQueue: vi.fn(),
}));

import { createApp } from '../../app.js';
import { signAccessToken } from '../../lib/jwt.js';

describe('Products API', () => {
  let server: Server;
  let baseUrl: string;
  const userToken = signAccessToken({
    userId: '4ae9d08e-5884-4cc2-b2f3-51a4f1577be4',
    email: 'tester@example.com',
  });

  beforeEach(() => {
    products.clear();
    upsertProduct.mockReset();
    findProduct.mockReset();
    updateProduct.mockReset();

    upsertProduct.mockImplementation(
      async ({
        where,
        create,
        update,
      }: {
        where: { canonicalUrl: string };
        create: Omit<SavedProduct, 'id' | 'createdAt' | 'updatedAt'>;
        update: Partial<SavedProduct>;
      }) => {
        const current = products.get(where.canonicalUrl);
        const now = new Date();
        const saved: SavedProduct = current
          ? {
              ...current,
              ...Object.fromEntries(
                Object.entries(update).filter(([, value]) => value !== undefined)
              ),
              updatedAt: now,
            }
          : {
              ...create,
              id: '5efce18c-6f70-4d25-a6f8-8a3e09704e40',
              createdAt: now,
              updatedAt: now,
            };
        products.set(where.canonicalUrl, saved);
        return saved;
      }
    );
    findProduct.mockImplementation(async ({ where }: { where: { id: string } }) =>
      [...products.values()].find((product) => product.id === where.id) ?? null
    );
    updateProduct.mockImplementation(
      async ({ where, data }: { where: { id: string }; data: Partial<SavedProduct> }) => {
        const existing = [...products.entries()].find(([, product]) => product.id === where.id);
        if (!existing) throw new Error('Expected product for update');
        const [canonicalUrl, current] = existing;
        const updated = { ...current, ...data, updatedAt: new Date() } as SavedProduct;
        products.delete(canonicalUrl);
        products.set(updated.canonicalUrl, updated);
        return updated;
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

  async function postProduct(
    body: Record<string, unknown>,
    token: string | null = userToken
  ) {
    return fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  }

  it('persists confirmed values and retrieves the same saved product by ID', async () => {
    const response = await postProduct({
      name: 'Teclado revisado manualmente',
      url: 'https://shop.example/products/keyboard?ref=builder#details',
      description: 'Descripción corregida',
      currentPrice: 1299.5,
      previousPrice: 1599,
      currency: 'MXN',
      imageUrl: 'https://cdn.example/keyboard-main.jpg',
      images: [
        {
          url: 'https://cdn.example/keyboard-main.jpg',
          alt: 'Vista principal',
          source: 'product gallery',
          order: 1,
        },
      ],
    });
    const saved = (await response.json()) as SavedProduct;

    expect(response.status).toBe(201);
    expect(saved).toMatchObject({
      name: 'Teclado revisado manualmente',
      originalUrl: 'https://shop.example/products/keyboard?ref=builder#details',
      canonicalUrl: 'https://shop.example/products/keyboard?ref=builder',
      currentPrice: 1299.5,
      previousPrice: 1599,
      description: 'Descripción corregida',
      imageUrl: 'https://cdn.example/keyboard-main.jpg',
      currency: 'MXN',
    });
    expect(upsertProduct).toHaveBeenCalledTimes(1);

    const recoveredResponse = await fetch(`${baseUrl}/products/${saved.id}`, {
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(recoveredResponse.status).toBe(200);
    expect(await recoveredResponse.json()).toEqual(saved);
  });

  it('saves without creating or requiring a reusable scrape configuration', async () => {
    const response = await postProduct({
      name: 'Producto sin configuración',
      url: 'https://shop.example/item',
      currentPrice: null,
      previousPrice: null,
      currency: null,
      imageUrl: null,
      images: [],
    });

    expect(response.status).toBe(201);
    expect(upsertProduct).toHaveBeenCalledTimes(1);
    expect(upsertProduct.mock.calls[0][0]).not.toHaveProperty('configId');
    expect(upsertProduct.mock.calls[0][0].create).toMatchObject({
      currentPrice: null,
      previousPrice: null,
      images: [],
    });
  });

  it('upserts by canonical product URL so repeated saves return one product', async () => {
    const body = {
      name: 'Producto idempotente',
      url: 'https://shop.example/item#first',
      images: [],
    };
    const first = await postProduct(body);
    const firstProduct = (await first.json()) as SavedProduct;
    const second = await postProduct({ ...body, url: 'https://shop.example/item#second' });
    const secondProduct = (await second.json()) as SavedProduct;

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(secondProduct.id).toBe(firstProduct.id);
    expect(products.size).toBe(1);
    expect(upsertProduct).toHaveBeenCalledTimes(2);
  });

  it('updates the existing product by ID instead of creating a duplicate', async () => {
    const initialResponse = await postProduct({
      name: 'Producto guardado',
      url: 'https://shop.example/item',
      currentPrice: 99,
      previousPrice: 120,
      images: [{ url: 'https://cdn.example/main.jpg', alt: 'Main', order: 1 }],
    });
    const initial = (await initialResponse.json()) as SavedProduct;

    const updateResponse = await fetch(`${baseUrl}/products/${initial.id}`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        name: 'Producto editado',
        url: 'https://shop.example/item',
        currentPrice: 89.5,
        previousPrice: 110,
        images: [{ url: 'https://cdn.example/selected.jpg', alt: 'Selected', order: 1 }],
      }),
    });
    const updated = (await updateResponse.json()) as SavedProduct;

    expect(updateResponse.status).toBe(200);
    expect(updated).toMatchObject({
      id: initial.id,
      name: 'Producto editado',
      currentPrice: 89.5,
      previousPrice: 110,
      images: [{ url: 'https://cdn.example/selected.jpg' }],
    });
    expect(products.size).toBe(1);
    expect(updateProduct).toHaveBeenCalledTimes(1);
    expect(upsertProduct).toHaveBeenCalledTimes(1);

    const recoveredResponse = await fetch(`${baseUrl}/products/${initial.id}`, {
      headers: { authorization: `Bearer ${userToken}` },
    });
    expect(recoveredResponse.status).toBe(200);
    expect(await recoveredResponse.json()).toEqual(updated);
  });

  it('updates confirmed corrections without replacing stored values with missing data', async () => {
    const original = await postProduct({
      name: 'Producto original',
      url: 'https://shop.example/item#first',
      description: 'Descripción guardada',
      currentPrice: 99.5,
      previousPrice: 120,
      currency: 'MXN',
      imageUrl: 'https://cdn.example/main.jpg',
      images: [
        {
          url: 'https://cdn.example/main.jpg',
          alt: 'Principal',
          source: 'gallery',
          order: 1,
        },
      ],
    });
    const originalProduct = (await original.json()) as SavedProduct;

    const retried = await postProduct({
      name: 'Producto corregido',
      url: 'https://shop.example/item#second',
      description: null,
      currentPrice: null,
      previousPrice: 110.25,
      currency: null,
      imageUrl: null,
      images: [],
    });
    const updatedProduct = (await retried.json()) as SavedProduct;

    expect(updatedProduct.id).toBe(originalProduct.id);
    expect(updatedProduct).toMatchObject({
      name: 'Producto corregido',
      currentPrice: 99.5,
      previousPrice: 110.25,
      description: 'Descripción guardada',
      currency: 'MXN',
      imageUrl: 'https://cdn.example/main.jpg',
      images: [
        expect.objectContaining({
          url: 'https://cdn.example/main.jpg',
          alt: 'Principal',
        }),
      ],
    });
    expect(products.size).toBe(1);
  });

  it('rejects missing names, invalid URLs and non-positive prices', async () => {
    for (const body of [
      { name: ' ', url: 'https://shop.example/item' },
      { name: 'Producto', url: 'javascript:alert(1)' },
      { name: 'Producto', url: 'https://shop.example/item', currentPrice: 0 },
    ]) {
      const response = await postProduct(body);
      expect(response.status).toBe(422);
    }
    expect(upsertProduct).not.toHaveBeenCalled();
  });

  it('requires authentication for save and retrieval', async () => {
    const saveResponse = await postProduct(
      { name: 'Producto privado', url: 'https://shop.example/private' },
      null
    );
    const getResponse = await fetch(`${baseUrl}/products/5efce18c-6f70-4d25-a6f8-8a3e09704e40`);

    expect(saveResponse.status).toBe(401);
    expect(getResponse.status).toBe(401);
    expect(upsertProduct).not.toHaveBeenCalled();
    expect(findProduct).not.toHaveBeenCalled();
  });

  it('requires authentication to update a product', async () => {
    const response = await fetch(
      `${baseUrl}/products/5efce18c-6f70-4d25-a6f8-8a3e09704e40`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Producto',
          url: 'https://shop.example/item',
        }),
      }
    );

    expect(response.status).toBe(401);
    expect(updateProduct).not.toHaveBeenCalled();
  });
});
