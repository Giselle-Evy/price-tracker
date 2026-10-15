import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { lookup } = vi.hoisted(() => ({
  lookup: vi.fn(),
}));

vi.mock('node:dns/promises', () => ({
  default: { lookup },
}));

import {
  assertSafeUrl,
  scrape,
} from '@price-tracker/shared/scraper';

describe('SSRF guard DNS resolution', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    lookup.mockReset().mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('retries transient DNS failures before accepting a public hostname', async () => {
    lookup
      .mockRejectedValueOnce(Object.assign(new Error('temporary DNS failure'), { code: 'EAI_AGAIN' }))
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }]);

    await expect(assertSafeUrl('https://shop.example/product')).resolves.toMatchObject({
      hostname: 'shop.example',
    });
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it('surfaces exhausted transient DNS failures as retryable upstream errors', async () => {
    lookup.mockRejectedValue(
      Object.assign(new Error('temporary DNS failure'), { code: 'EAI_AGAIN' })
    );

    await expect(assertSafeUrl('https://shop.example/product')).rejects.toMatchObject({
      name: 'SharedBadRequestError',
      statusCode: 502,
      retryable: true,
      message: 'No se pudo resolver el dominio "shop.example" (EAI_AGAIN)',
    });
    expect(lookup).toHaveBeenCalledTimes(3);
  });

  it('reports a permanently unresolvable hostname without marking it retryable', async () => {
    lookup.mockRejectedValue(
      Object.assign(new Error('name not found'), { code: 'ENOTFOUND' })
    );

    await expect(assertSafeUrl('https://missing.example/product')).rejects.toMatchObject({
      statusCode: 400,
      retryable: false,
      message: 'No se pudo resolver el dominio "missing.example" (ENOTFOUND)',
    });
    expect(lookup).toHaveBeenCalledTimes(3);
  });

  it('rejects a hostname resolving to any private address', async () => {
    lookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ]);

    await expect(assertSafeUrl('https://shop.example/product')).rejects.toMatchObject({
      message: 'El dominio resuelve a una IP no permitida (127.0.0.1)',
    });
    expect(lookup).toHaveBeenCalledOnce();
  });

  it('recovers from a transient DNS failure in the Cheerio request path', async () => {
    lookup
      .mockRejectedValueOnce(Object.assign(new Error('temporary DNS failure'), { code: 'EAI_AGAIN' }))
      .mockResolvedValueOnce([{ address: '93.184.216.34', family: 4 }]);
    fetchMock.mockResolvedValue(
      new Response('<html><body>Product</body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      })
    );

    const result = await scrape('https://shop.example/product', {
      mode: 'cheerio',
    });

    expect(result.statusCode).toBe(200);
    expect(lookup).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
