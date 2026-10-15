import type { Job } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SharedBadRequestError } from '@price-tracker/shared/scraper';

const {
  mockScrape,
  mockFindMonitor,
  mockRunCreate,
  mockRunUpdate,
  mockPriceCreate,
  mockMonitorUpdate,
  mockOfferUpdateMany,
} = vi.hoisted(() => ({
  mockScrape: vi.fn(),
  mockFindMonitor: vi.fn(),
  mockRunCreate: vi.fn(),
  mockRunUpdate: vi.fn(),
  mockPriceCreate: vi.fn(),
  mockMonitorUpdate: vi.fn(),
  mockOfferUpdateMany: vi.fn(),
}));

vi.mock('@price-tracker/shared/scraper', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@price-tracker/shared/scraper')>()),
  scrape: mockScrape,
}));

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    monitor: {
      findUnique: mockFindMonitor,
      update: mockMonitorUpdate,
    },
    scrapeRun: {
      create: mockRunCreate,
      update: mockRunUpdate,
    },
    priceHistory: {
      create: mockPriceCreate,
    },
    offer: {
      updateMany: mockOfferUpdateMany,
    },
  },
}));

import { processScrapeJob } from './scrapeProcessor.js';

const automaticMonitor = {
  id: 'monitor-id',
  userId: 'user-id',
  productId: 'product-id',
  extractionMode: 'automatic',
  config: null,
  status: 'active',
  url: 'https://shop.example/product',
  frequencyMin: 'm15',
  currency: 'MXN',
  currentPrice: 100,
};

function scrapeJob(attemptsMade = 0) {
  return {
    data: { monitorId: automaticMonitor.id, userId: automaticMonitor.userId },
    attemptsMade,
    opts: { attempts: 3 },
  } as unknown as Job<{ monitorId: string; userId: string }, never>;
}

describe('processScrapeJob automatic extraction', () => {
  beforeEach(() => {
    mockScrape.mockReset().mockResolvedValue({
      html: '<meta itemprop="price" content="89.50">',
      statusCode: 200,
      durationMs: 10,
      method: 'cheerio',
    });
    mockFindMonitor.mockReset().mockResolvedValue(automaticMonitor);
    mockRunCreate.mockReset().mockResolvedValue({ id: 'run-id' });
    mockRunUpdate.mockReset().mockResolvedValue({});
    mockPriceCreate.mockReset().mockResolvedValue({});
    mockMonitorUpdate.mockReset().mockResolvedValue({});
    mockOfferUpdateMany.mockReset().mockResolvedValue({ count: 1 });
  });

  it('records a successfully auto-detected price in history', async () => {
    const result = await processScrapeJob(scrapeJob());

    expect(result).toMatchObject({
      monitorId: automaticMonitor.id,
      status: 'success',
      price: 89.5,
      currency: 'MXN',
    });
    expect(mockPriceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        monitorId: automaticMonitor.id,
        runId: 'run-id',
        price: 89.5,
        currency: 'MXN',
      }),
    });
    expect(mockOfferUpdateMany).toHaveBeenCalledWith({
  where: {
    productId: automaticMonitor.productId,
    userId: automaticMonitor.userId,
  },
  data: {
    price: 89.5,
  },
});
    expect(mockRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'success' }),
      })
    );
    expect(mockMonitorUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          currentPrice: 89.5,
          previousPrice: 100,
          status: 'active',
        }),
      })
    );
  });

  it('marks automatic monitoring errored and does not write history when no price is found', async () => {
    mockScrape.mockResolvedValue({
      html: '<html><body><h1>Product without price</h1></body></html>',
      statusCode: 200,
      durationMs: 10,
      method: 'cheerio',
    });

    const result = await processScrapeJob(scrapeJob());

    expect(result).toMatchObject({ status: 'error' });
    expect(mockPriceCreate).not.toHaveBeenCalled();
    expect(mockOfferUpdateMany).not.toHaveBeenCalled();
    expect(mockMonitorUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'error' }),
      })
    );
    expect(mockRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'error' }),
      })
    );
  });

  it('rethrows transient DNS failures so BullMQ can retry without disabling the monitor', async () => {
    const dnsError = new SharedBadRequestError(
      'No se pudo resolver el dominio "shop.example" (EAI_AGAIN)',
      502,
      { retryable: true }
    );
    mockScrape.mockRejectedValue(dnsError);

    await expect(processScrapeJob(scrapeJob())).rejects.toBe(dnsError);

    expect(mockRunUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'error',
          errorMessage: dnsError.message,
        }),
      })
    );
    expect(mockMonitorUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ status: 'error' }),
      })
    );
    expect(mockPriceCreate).not.toHaveBeenCalled();
  });

  it('marks the monitor errored after the final transient DNS retry fails', async () => {
    const dnsError = new SharedBadRequestError(
      'No se pudo resolver el dominio "shop.example" (EAI_AGAIN)',
      502,
      { retryable: true }
    );
    mockScrape.mockRejectedValue(dnsError);

    await expect(processScrapeJob(scrapeJob(2))).rejects.toBe(dnsError);

    expect(mockMonitorUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'error' }),
      })
    );
    expect(mockPriceCreate).not.toHaveBeenCalled();
  });
});
