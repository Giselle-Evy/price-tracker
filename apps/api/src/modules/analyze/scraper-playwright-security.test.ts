import { afterEach, describe, expect, it, vi } from 'vitest';

type FakeRoute = {
  request: () => { url: () => string; isNavigationRequest: () => boolean };
  continue: () => Promise<void>;
  abort: (errorCode?: string) => Promise<void>;
};

const mocks = vi.hoisted(() => {
  let routeHandler: ((route: FakeRoute) => Promise<void>) | undefined;
  const abort = vi.fn(async () => undefined);
  const route = vi.fn(
    async (_pattern: string, handler: (route: FakeRoute) => Promise<void>) => {
      routeHandler = handler;
    }
  );
  const goto = vi.fn(async () => {
    if (!routeHandler) throw new Error('Playwright request guard was not set up');
    await routeHandler({
      request: () => ({
        url: () => 'http://127.0.0.1/private',
        isNavigationRequest: () => true,
      }),
      continue: vi.fn(async () => undefined),
      abort,
    });
    return null;
  });
  const context = {
    route,
    newPage: vi.fn(async () => ({
      goto,
      content: vi.fn(async () => ''),
      url: vi.fn(() => 'https://shop.example/product'),
    })),
    close: vi.fn(async () => undefined),
  };
  const browser = {
    isConnected: vi.fn(() => true),
    newContext: vi.fn(async () => context),
  };

  return { abort, browser, context, goto, route };
});

vi.mock('node:dns/promises', () => ({
  default: {
    lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
  },
}));

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(async () => mocks.browser),
  },
}));

import {
  scrape,
  SharedBadRequestError,
} from '@price-tracker/shared/scraper';

describe('Playwright scraper network safety', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('aborts a redirect to loopback before continuing navigation', async () => {
    await expect(
      scrape('https://shop.example/product', { mode: 'playwright' })
    ).rejects.toBeInstanceOf(SharedBadRequestError);

    expect(mocks.route).toHaveBeenCalledWith('**/*', expect.any(Function));
    expect(mocks.abort).toHaveBeenCalledWith('blockedbyclient');
    expect(mocks.goto).toHaveBeenCalledTimes(1);
  });
});
