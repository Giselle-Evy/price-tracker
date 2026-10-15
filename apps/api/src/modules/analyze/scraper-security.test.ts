import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:dns/promises', () => ({
  default: {
    lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
  },
}));

import {
  scrape,
  SharedBadRequestError,
} from '@price-tracker/shared/scraper';

describe('scraper network safety', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('blocks a redirect to a loopback address before making the redirected request', async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'http://127.0.0.1/private' },
      })
    );

    await expect(
      scrape('https://shop.example/product', { mode: 'cheerio' })
    ).rejects.toBeInstanceOf(SharedBadRequestError);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.redirect).toBe('manual');
  });

  it('blocks an IPv6 loopback URL before making a request', async () => {
    await expect(
      scrape('http://[::1]/private', { mode: 'cheerio' })
    ).rejects.toBeInstanceOf(SharedBadRequestError);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('validates each public redirect target before continuing', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: 'https://cdn.example/product' },
        })
      )
      .mockResolvedValueOnce(
        new Response('<html><body>Product</body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        })
      );

    const result = await scrape('https://shop.example/product', {
      mode: 'cheerio',
    });

    expect(result.statusCode).toBe(200);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://shop.example/product',
      'https://cdn.example/product',
    ]);
  });

  it('reports upstream HTTP errors instead of extracting an error page', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html>Forbidden</html>', {
        status: 403,
        headers: { 'content-type': 'text/html' },
      })
    );

    await expect(
      scrape('https://shop.example/product', { mode: 'cheerio' })
    ).rejects.toMatchObject({
      statusCode: 502,
      message: 'La pagina respondio con HTTP 403',
    });
  });

  it('enforces the configured maximum redirect count', async () => {
    fetchMock.mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'https://shop.example/product' },
      })
    );

    await expect(
      scrape('https://shop.example/product', { mode: 'cheerio' })
    ).rejects.toMatchObject({
      statusCode: 502,
      message: 'La pagina excedio el limite de redirecciones',
    });
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it('rejects HTML larger than the configured response limit', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html>Too large</html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      })
    );

    await expect(
      scrape('https://shop.example/product', {
        mode: 'cheerio',
        maxBytes: 4,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('maps fetch timeouts to a gateway timeout error', async () => {
    fetchMock.mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          );
        })
    );

    await expect(
      scrape('https://shop.example/product', {
        mode: 'cheerio',
        timeoutMs: 5,
      })
    ).rejects.toMatchObject({
      statusCode: 504,
      message: 'La solicitud excedio el tiempo maximo de respuesta',
    });
  });
});
