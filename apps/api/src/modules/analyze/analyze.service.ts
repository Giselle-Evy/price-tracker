
import {
  assertSafeUrl,
  scrape,
  SharedBadRequestError,
  type ScrapeMethod,
} from '@price-tracker/shared/scraper';
import type { AnalyzeInput } from './analyze.schemas.js';
import {
  detectProductFields,
  extractProductImages,
  type ProductImage,
} from './auto-detect.js';

export type ProductImageGalleryStatus = 'found' | 'partial' | 'not_found';

export type AnalyzeResult = {
  url: string;
  finalUrl: string;
  html: string;
  statusCode: number;
  contentType: string;
  durationMs: number;
  method: ScrapeMethod;
  htmlSize: number;
  detectedFields: ReturnType<typeof detectProductFields>;
  productImages: ProductImage[];
  imageGalleryStatus: ProductImageGalleryStatus;
  expectedImageCount: number | null;
  rejectedImageCount: number;
};

async function filterSafeProductImages(
  images: ProductImage[]
): Promise<ProductImage[]> {
  const safeHosts = new Map<string, Promise<boolean>>();

  return (
    await Promise.all(
      images.map(async (image) => {
        const hostname = new URL(image.url).hostname.toLowerCase();
        let isSafe = safeHosts.get(hostname);
        if (!isSafe) {
          isSafe = assertSafeUrl(image.url)
            .then(() => true)
            .catch((error: unknown) => {
              if (error instanceof SharedBadRequestError) return false;
              throw error;
            });
          safeHosts.set(hostname, isSafe);
        }

        return (await isSafe) ? image : null;
      })
    )
  ).filter((image): image is ProductImage => image !== null);
}

export async function analyzeUrl(input: AnalyzeInput): Promise<AnalyzeResult> {
  const result = await scrape(input.url);
  const extraction = extractProductImages(result.html, result.finalUrl);
  const productImages = (await filterSafeProductImages(extraction.images)).map(
    (image, index) => ({ ...image, order: index + 1 })
  );
  const rejectedImageCount =
    extraction.rejectedCount + extraction.images.length - productImages.length;
  const imageGalleryStatus =
    productImages.length === 0
      ? 'not_found'
      : rejectedImageCount > 0 ||
          (extraction.expectedCount !== null &&
            productImages.length < extraction.expectedCount)
        ? 'partial'
        : 'found';
  const detectedFields = detectProductFields(
    result.html,
    result.finalUrl,
    productImages
  );

  return {
    url: input.url,
    finalUrl: result.finalUrl,
    html: result.html,
    statusCode: result.statusCode,
    contentType: result.contentType,
    durationMs: result.durationMs,
    method: result.method,
    htmlSize: Buffer.byteLength(result.html, 'utf-8'),
    detectedFields,
    productImages,
    imageGalleryStatus,
    expectedImageCount: extraction.expectedCount,
    rejectedImageCount,
  };
}
