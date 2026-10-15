
import type { ExtractField } from '../FieldsPanel';
import { parseProductPrice } from '../../products/productFields';

export type ExtractionResultStatus = 'success' | 'warning' | 'error' | 'empty';

export type ExtractionResult = {
  fieldId: string;
  label: string;
  selector: string;
  attribute?: string;
  type: string;
  status: ExtractionResultStatus;
  value: string | null;
  values: string[];
  matchCount: number;
  message?: string;
};

export function runExtraction(
  html: string,
  fields: ExtractField[],
  baseUrl?: string,
  safeImageUrls?: string[]
): ExtractionResult[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  return fields.map((field) =>
    runSingleExtraction(doc, field, baseUrl, safeImageUrls)
  );
}

function runSingleExtraction(
  doc: Document,
  field: ExtractField,
  baseUrl?: string,
  safeImageUrls?: string[]
): ExtractionResult {
  const base: ExtractionResult = {
    fieldId: field.id,
    label: field.label,
    selector: field.selector,
    attribute: field.attribute,
    type: field.type,
    status: 'error',
    value: null,
    values: [],
    matchCount: 0,
  };

  let matches: Element[];

  try {
    matches = Array.from(doc.querySelectorAll(field.selector));
  } catch {
    return { ...base, message: 'El selector CSS no es válido' };
  }

  if (matches.length === 0) {
    return {
      ...base,
      message: 'No se encontró ningún elemento con este selector',
    };
  }

  if (field.type === 'image') {
    return runImageExtraction(field, matches, baseUrl, safeImageUrls);
  }

  const element = matches[0];
  let value: string | null;

  if (field.attribute) {
    value = element.getAttribute(field.attribute);
  } else {
    value = element.textContent?.replace(/\s+/g, ' ').trim() || '';
  }

  if (value === null || value.trim() === '') {
    return {
      ...base,
      status: 'empty',
      matchCount: matches.length,
      message: 'El elemento no contiene un valor extraíble',
    };
  }

  if (field.type === 'price') {
    value = value.replace(/\s+/g, ' ').trim();
    if (parseProductPrice(value) === null) {
      return {
        ...base,
        status: 'error',
        matchCount: matches.length,
        message: 'El valor encontrado no es un precio válido',
      };
    }
  }

  return {
    ...base,
    status: matches.length > 1 ? 'warning' : 'success',
    value,
    values: [value],
    matchCount: matches.length,
    message:
      matches.length > 1
        ? `Se encontraron ${matches.length} elementos; se utiliza el primero.`
        : undefined,
  };
}

function runImageExtraction(
  field: ExtractField,
  matches: Element[],
  baseUrl: string | undefined,
  safeImageUrls?: string[]
): ExtractionResult {
  const base: ExtractionResult = {
    fieldId: field.id,
    label: field.label,
    selector: field.selector,
    attribute: field.attribute,
    type: field.type,
    status: 'error',
    value: null,
    values: [],
    matchCount: matches.length,
  };

  const allowedImages = safeImageUrls
    ? new Map(
        safeImageUrls.flatMap((value) => {
          const normalized = normalizeImageUrl(value, baseUrl);
          return normalized ? [[imageIdentity(normalized), normalized] as const] : [];
        })
      )
    : null;
  const values = new Map<string, string>();

  for (const match of matches) {
    const targets =
      match.matches('img, source, meta, a[href]')
        ? [match, ...match.querySelectorAll('img, source, meta')]
        : Array.from(
            match.querySelectorAll('img, source, meta')
          );

    for (const element of targets) {
      const rawValues = field.attribute
        ? [
            {
              value: element.getAttribute(field.attribute),
              isSrcset: /srcset/i.test(field.attribute),
              quality: 0,
            },
          ]
        : [
          { value: element.getAttribute('data-zoom-image'), isSrcset: false, quality: 100_000 },
          { value: element.getAttribute('data-large_image'), isSrcset: false, quality: 50_000 },
          { value: element.getAttribute('data-full'), isSrcset: false, quality: 50_000 },
          { value: element.getAttribute('data-original'), isSrcset: false, quality: 0 },
          { value: element.getAttribute('data-srcset'), isSrcset: true, quality: 0 },
          { value: element.getAttribute('srcset'), isSrcset: true, quality: 0 },
          { value: element.getAttribute('data-src'), isSrcset: false, quality: 0 },
          { value: element.getAttribute('data-lazy-src'), isSrcset: false, quality: 0 },
          { value: element.getAttribute('src'), isSrcset: false, quality: 0 },
          {
            value: element.tagName.toLowerCase() === 'a'
              ? element.getAttribute('href')
              : null,
            isSrcset: false,
            quality: 75_000,
          },
          ];

      const candidates = rawValues.flatMap((raw) => {
        if (!raw.value) return [];
        return raw.isSrcset
          ? parseImageSrcset(raw.value).map((candidate) => ({
              ...candidate,
              quality: candidate.quality + raw.quality,
            }))
          : [{ url: raw.value, quality: raw.quality }];
      });
      const best = candidates
        .map((candidate) => {
          const normalized = normalizeImageUrl(candidate.url, baseUrl);
          return normalized ? { ...candidate, normalized } : null;
        })
        .filter(
          (
            candidate
          ): candidate is NonNullable<typeof candidate> => candidate !== null
        )
        .sort((left, right) => right.quality - left.quality)[0];

      if (!best) continue;

      const identity = imageIdentity(best.normalized);
      const safeUrl = allowedImages
        ? allowedImages.get(identity)
        : best.normalized;
      if (safeUrl) values.set(identity, safeUrl);
    }
  }

  const extractedValues = [...values.values()];
  if (extractedValues.length === 0) {
    return {
      ...base,
      status: 'empty',
      message: 'No se encontraron URL de imágenes válidas con este selector',
    };
  }

  return {
    ...base,
    status: extractedValues.length > 1 ? 'warning' : 'success',
    value: extractedValues[0],
    values: extractedValues,
    message:
      extractedValues.length > 1
        ? `Se encontraron ${extractedValues.length} imágenes; se conservan todas.`
        : undefined,
  };
}

function parseImageSrcset(value: string): Array<{ url: string; quality: number }> {
  return value
    .split(',')
    .map((candidate) => {
      const [url, descriptor] = candidate.trim().split(/\s+/, 2);
      if (!url) return null;
      const amount = Number.parseFloat(descriptor ?? '');
      const quality = descriptor?.endsWith('w')
        ? amount
        : descriptor?.endsWith('x')
          ? amount * 1000
          : 0;
      return { url, quality: Number.isFinite(quality) ? quality : 0 };
    })
    .filter((candidate): candidate is { url: string; quality: number } =>
      Boolean(candidate)
    );
}

function normalizeImageUrl(value: string, baseUrl?: string): string | null {
  try {
    const url = baseUrl ? new URL(value.trim(), baseUrl) : new URL(value.trim());
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.username ||
      url.password ||
      /(?:^|\.)localhost$|(?:^|\.)local$|^(?:metadata|instance-data)$/i.test(
        url.hostname
      ) ||
      /^127\.|^10\.|^192\.168\.|^169\.254\.|^0\./.test(url.hostname) ||
      /^172\.(?:1[6-9]|2\d|3[01])\./.test(url.hostname) ||
      /^\[(?:::1|fc|fd|fe80)/i.test(url.hostname)
    ) {
      return null;
    }
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

function imageIdentity(value: string): string {
  const url = new URL(value);
  for (const key of [...url.searchParams.keys()]) {
    if (
      /^(?:auto|crop|dpr|fit|format|h|height|imwidth|q|quality|resize|w|width)$/i.test(
        key
      ) ||
      key.toLowerCase().startsWith('utm_')
    ) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  return url.href;
}
