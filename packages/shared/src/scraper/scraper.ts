import * as cheerio from 'cheerio';
import { chromium, type Browser } from 'playwright';

import {
  assertSafeUrl,
  FETCH_LIMITS,
  SharedBadRequestError,
} from './ssrf-guard.js';

export type ScrapeMethod = 'cheerio' | 'playwright';

export type ScrapeOptions = {
  mode?: 'auto' | ScrapeMethod;
  timeoutMs?: number;
  maxBytes?: number;
};

export type ScrapeResult = {
  html: string;
  finalUrl: string;
  statusCode: number;
  contentType: string;
  durationMs: number;
  method: ScrapeMethod;
};

async function fetchWithLimits(
  url: string,
  opts: { timeoutMs: number; maxBytes: number }
): Promise<{
  body: string;
  finalUrl: string;
  statusCode: number;
  contentType: string;
}> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': FETCH_LIMITS.userAgent,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
    });

    const contentType = response.headers.get('content-type') || '';

    if (
      !contentType.includes('text/html') &&
      !contentType.includes('application/xhtml') &&
      !contentType.includes('text/xml') &&
      !contentType.includes('application/xml')
    ) {
      throw new SharedBadRequestError(
        `Tipo de contenido no soportado: ${contentType || 'desconocido'}`
      );
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new SharedBadRequestError('No se pudo leer la respuesta', 500);
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.length;
      if (totalBytes > opts.maxBytes) {
        reader.cancel();
        throw new SharedBadRequestError(
          `La pagina excede el limite de ${Math.round(
            opts.maxBytes / 1024 / 1024
          )} MB`
        );
      }

      chunks.push(value);
    }

    const body = new TextDecoder('utf-8').decode(
      chunks.reduce((acc, chunk) => {
        const merged = new Uint8Array(acc.length + chunk.length);
        merged.set(acc);
        merged.set(chunk, acc.length);
        return merged;
      }, new Uint8Array())
    );

    return {
      body,
      finalUrl: response.url,
      statusCode: response.status,
      contentType,
    };
  } finally {
    clearTimeout(timer);
  }
}

function detectNeedsJs(html: string): boolean {
  const $ = cheerio.load(html);

  $('script, style, meta, link, noscript, template').remove();

  const bodyText = $('body').text().trim();

  if (html.length < 500) {
    return false;
  }

  const htmlLower = html.toLowerCase();
  const spaMarkers = [
    '<div id="root"></div>',
    '<div id="root">',
    '<div id="app"></div>',
    '<div id="app">',
    '<div id="__next"></div>',
    '<div id="__next">',
    'window.__nuxt__',
    'window.__next_data__',
    'data-reactroot',
  ];

  const hasSpaMarker = spaMarkers.some((marker) => htmlLower.includes(marker));

  if (hasSpaMarker && bodyText.length < 200) {
    return true;
  }

  if (bodyText.length < 50) {
    return true;
  }

  return false;
}

async function scrapeWithCheerio(
  url: string,
  opts: { timeoutMs: number; maxBytes: number }
): Promise<ScrapeResult> {
  const start = Date.now();

  const { body, finalUrl, statusCode, contentType } = await fetchWithLimits(
    url,
    opts
  );

  return {
    html: body,
    finalUrl,
    statusCode,
    contentType,
    durationMs: Date.now() - start,
    method: 'cheerio',
  };
}

let sharedBrowser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!sharedBrowser || !sharedBrowser.isConnected()) {
    sharedBrowser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
  }
  return sharedBrowser;
}

export async function closeBrowser(): Promise<void> {
  if (sharedBrowser) {
    await sharedBrowser.close();
    sharedBrowser = null;
  }
}

async function scrapeWithPlaywright(
  url: string,
  opts: { timeoutMs: number; maxBytes: number }
): Promise<ScrapeResult> {
  const start = Date.now();
  const browser = await getBrowser();

  const context = await browser.newContext({
    userAgent: FETCH_LIMITS.userAgent,
    viewport: { width: 1366, height: 768 },
    locale: 'es-ES',
  });

  try {
    const page = await context.newPage();

    const response = await page.goto(url, {
      timeout: opts.timeoutMs,
      waitUntil: 'networkidle',
    });

    if (!response) {
      throw new SharedBadRequestError('No se pudo cargar la pagina', 502);
    }

    const statusCode = response.status();
    const contentType = response.headers()['content-type'] || '';

    const html = await page.content();

    const bytes = Buffer.byteLength(html, 'utf-8');
    if (bytes > opts.maxBytes) {
      throw new SharedBadRequestError(
        `La pagina excede el limite de ${Math.round(
          opts.maxBytes / 1024 / 1024
        )} MB`
      );
    }

    return {
      html,
      finalUrl: page.url(),
      statusCode,
      contentType,
      durationMs: Date.now() - start,
      method: 'playwright',
    };
  } finally {
    await context.close();
  }
}

export async function scrape(
  rawUrl: string,
  options: ScrapeOptions = {}
): Promise<ScrapeResult> {
  const url = await assertSafeUrl(rawUrl);

  const opts = {
    timeoutMs: options.timeoutMs ?? FETCH_LIMITS.timeoutMs,
    maxBytes: options.maxBytes ?? FETCH_LIMITS.maxResponseBytes,
  };

  const mode = options.mode ?? 'auto';

  if (mode === 'playwright') {
    return scrapeWithPlaywright(url.toString(), opts);
  }

  if (mode === 'cheerio') {
    return scrapeWithCheerio(url.toString(), opts);
  }

  try {
    const result = await scrapeWithCheerio(url.toString(), opts);

    if (detectNeedsJs(result.html)) {
      console.log(
        `[scraper] Detectado SPA en ${url.toString()}, cayendo a Playwright`
      );
      return await scrapeWithPlaywright(url.toString(), opts);
    }

    return result;
  } catch (error) {
    console.warn(
      `[scraper] Cheerio fallo en ${url.toString()}, intentando Playwright:`,
      error instanceof Error ? error.message : error
    );
    return scrapeWithPlaywright(url.toString(), opts);
  }
}