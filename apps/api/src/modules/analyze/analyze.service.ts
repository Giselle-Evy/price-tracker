import { scrape, type ScrapeMethod } from '../../services/scraper.js';
import type { AnalyzeInput } from './analyze.schemas.js';

export type AnalyzeResult = {
  url: string;
  finalUrl: string;
  html: string;
  statusCode: number;
  contentType: string;
  durationMs: number;
  method: ScrapeMethod;
  htmlSize: number;
};

export async function analyzeUrl(input: AnalyzeInput): Promise<AnalyzeResult> {
  const result = await scrape(input.url);

  return {
    url: input.url,
    finalUrl: result.finalUrl,
    html: result.html,
    statusCode: result.statusCode,
    contentType: result.contentType,
    durationMs: result.durationMs,
    method: result.method,
    htmlSize: Buffer.byteLength(result.html, 'utf-8'),
  };
}