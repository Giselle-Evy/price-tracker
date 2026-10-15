import { once } from 'node:events';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockScrape, MockSharedBadRequestError } = vi.hoisted(() => {
  class MockSharedBadRequestError extends Error {
    constructor(
      message: string,
      public readonly statusCode = 400
    ) {
      super(message);
    }
  }

  return { mockScrape: vi.fn(), MockSharedBadRequestError };
});

vi.mock('@price-tracker/shared/scraper', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@price-tracker/shared/scraper')>()),
  assertSafeUrl: vi.fn(async (url: string) => new URL(url)),
  scrape: mockScrape,
  SharedBadRequestError: MockSharedBadRequestError,
}));

vi.mock('../../lib/scrapeQueue.js', () => ({
  scrapeQueue: { add: vi.fn(), removeRepeatable: vi.fn() },
  closeApiScrapeQueue: vi.fn(),
}));

import { createApp } from '../../app.js';

describe('POST /analyze', () => {
  let server: Server;
  let baseUrl: string;

  beforeEach(() => {
    mockScrape.mockClear();
  });

  beforeAll(async () => {
    mockScrape.mockResolvedValue({
      html: `<main itemscope itemtype="https://schema.org/Product">
        <h1 itemprop="name">Widget de prueba</h1>
        <meta itemprop="price" content="19.99">
        <meta itemprop="priceCurrency" content="MXN">
        <meta itemprop="description" content="Descripción verificada">
        <div data-product-gallery data-image-count="5">
          ${Array.from(
            { length: 5 },
            (_, index) => `<img src="/images/widget-${index + 1}.jpg" alt="Vista ${index + 1}">`
          ).join('')}
        </div>
      </main>`,
      finalUrl: 'https://shop.example/products/widget',
      statusCode: 200,
      contentType: 'text/html',
      durationMs: 42,
      method: 'cheerio',
    });

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

  it('returns product fields and the complete gallery in the existing response', async () => {
    const response = await fetch(`${baseUrl}/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://shop.example/products/widget' }),
    });
    const body = (await response.json()) as {
      productImages: Array<{ url: string; order: number }>;
      detectedFields: Array<{ label: string; value: string }>;
      [key: string]: unknown;
    };

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      url: 'https://shop.example/products/widget',
      finalUrl: 'https://shop.example/products/widget',
      statusCode: 200,
      method: 'cheerio',
      imageGalleryStatus: 'found',
      expectedImageCount: 5,
      rejectedImageCount: 0,
    });
    expect(body.productImages).toHaveLength(5);
    expect(body.productImages[0]).toMatchObject({
      url: 'https://shop.example/images/widget-1.jpg',
      order: 1,
    });
    expect(body.detectedFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Nombre', value: 'Widget de prueba' }),
        expect.objectContaining({ label: 'Precio', value: '19.99' }),
        expect.objectContaining({ label: 'Moneda', value: 'MXN' }),
        expect.objectContaining({
          label: 'Descripción',
          value: 'Descripción verificada',
        }),
        expect.objectContaining({
          label: 'Imagen',
          value: 'https://shop.example/images/widget-1.jpg',
        }),
      ])
    );
  });

  it('returns a validation error for a malformed URL', async () => {
    const response = await fetch(`${baseUrl}/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'not-a-url' }),
    });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: 'Validation error',
      details: { url: expect.any(Array) },
    });
    expect(mockScrape).not.toHaveBeenCalled();
  });

  it('returns scraper validation failures with their intended HTTP status', async () => {
    mockScrape.mockRejectedValueOnce(
      new MockSharedBadRequestError('IP no permitida', 400)
    );
    const response = await fetch(`${baseUrl}/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'http://127.0.0.1/private' }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'IP no permitida' });
  });
});
