
import { load } from 'cheerio';
import { isIP } from 'node:net';
import { detectAutomaticPrice, isForbiddenIp } from '@price-tracker/shared/scraper';

export type SuggestedProductField = {
  label: string;
  selector: string;
  attribute: string | null;
  type: 'text' | 'price' | 'image' | 'url';
  value: string;
};

type Candidate = {
  selector: string;
  attribute?: string;
};

export type ProductImage = {
  url: string;
  alt: string | null;
  source: string;
  order: number;
};

export type ProductImageExtraction = {
  images: ProductImage[];
  expectedCount: number | null;
  rejectedCount: number;
};

const candidates: Record<string, Candidate[]> = {
  name: [
    { selector: 'h1' },
    { selector: '[itemprop="name"]' },
    { selector: 'meta[property="og:title"]', attribute: 'content' },
    { selector: 'meta[name="twitter:title"]', attribute: 'content' },
    { selector: 'title' },
  ],
  currency: [
    { selector: '[itemprop="priceCurrency"]', attribute: 'content' },
    { selector: 'meta[property="product:price:currency"]', attribute: 'content' },
    { selector: 'meta[property="og:price:currency"]', attribute: 'content' },
  ],
  previousPrice: [
    { selector: '[class*="original-price"]' },
    { selector: '[class*="old-price"]' },
    { selector: '[class*="list-price"]' },
    { selector: 'del' },
    { selector: 's' },
  ],
  image: [
    { selector: '[itemprop="image"]', attribute: 'src' },
    { selector: 'meta[property="product:image"]', attribute: 'content' },
    { selector: 'meta[property="og:image"]', attribute: 'content' },
    { selector: 'meta[name="twitter:image"]', attribute: 'content' },
  ],
  description: [
    { selector: 'meta[itemprop="description"]', attribute: 'content' },
    { selector: 'meta[name="description"]', attribute: 'content' },
    { selector: 'meta[property="og:description"]', attribute: 'content' },
    { selector: '[itemprop="description"]' },
  ],
};

const PRODUCT_GALLERY_SELECTORS = [
  '[data-product-gallery]',
  '[data-testid*="product-gallery" i]',
  '[id*="product-gallery" i]',
  '[class*="product-gallery" i]',
  '[data-gallery*="product" i]',
];

const IMAGE_ATTRIBUTES = [
  'data-zoom-image',
  'data-large_image',
  'data-full',
  'data-original',
  'data-original-src',
  'data-image',
  'data-src',
  'data-lazy-src',
  'data-srcset',
  'srcset',
  'src',
] as const;

const EXCLUDED_CONTEXT =
  /(?:^|[-_\s])(recommend(?:ed|ation)?|related|similar|cross[-_ ]?sell|up[-_ ]?sell|sponsor(?:ed)?|advert(?:isement)?|banner|logo|brand|payment|shipping|social|avatar|review|article|blog|navigation|footer)(?:$|[-_\s])/i;

const IMAGE_TRANSFORM_PARAMETERS = new Set([
  'auto',
  'crop',
  'dpr',
  'fit',
  'format',
  'h',
  'height',
  'imwidth',
  'q',
  'quality',
  'resize',
  'w',
  'width',
]);

function tagName(element: ReturnType<ReturnType<typeof load>>): string | undefined {
  const node = element[0];
  return node && 'tagName' in node ? node.tagName.toLowerCase() : undefined;
}

type ImageCandidate = {
  url: string;
  alt: string | null;
  source: string;
  quality: number;
};

function normalizedImageKey(url: URL): string {
  const normalized = new URL(url);
  normalized.hash = '';

  for (const key of [...normalized.searchParams.keys()]) {
    if (
      key.toLowerCase().startsWith('utm_') ||
      IMAGE_TRANSFORM_PARAMETERS.has(key.toLowerCase())
    ) {
      normalized.searchParams.delete(key);
    }
  }

  normalized.searchParams.sort();
  return normalized.href;
}

function resolveImageUrl(rawUrl: string, baseUrl: string): URL | null {
  try {
    const url = new URL(rawUrl.trim(), baseUrl);
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      url.username ||
      url.password ||
      !url.hostname ||
      /(?:^|\.)localhost$|(?:^|\.)local$|^(?:metadata|instance-data)$/i.test(
        url.hostname
      ) ||
      (isIP(url.hostname) !== 0 && isForbiddenIp(url.hostname))
    ) {
      return null;
    }

    url.hash = '';
    return url;
  } catch {
    return null;
  }
}

function parseSrcset(value: string): Array<{ url: string; quality: number }> {
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

function isExcludedContext(
  element: ReturnType<ReturnType<typeof load>>
): boolean {
  let current = element;
  let depth = 0;

  while (current.length && depth < 10) {
    const tag = tagName(current);
    if (tag === 'nav' || tag === 'aside' || tag === 'footer') return true;

    const context = [
      current.attr('id'),
      current.attr('class'),
      current.attr('aria-label'),
      current.attr('data-testid'),
      current.attr('role'),
    ]
      .filter(Boolean)
      .join(' ');

    if (EXCLUDED_CONTEXT.test(context)) return true;

    current = current.parent();
    depth += 1;
  }

  return false;
}

function hasProductContext($: ReturnType<typeof load>): boolean {
  return Boolean(
    $('[itemtype*="Product" i], [itemprop="price"], meta[property^="product:price"]').length ||
      $('meta[property="og:type"]').attr('content')?.toLowerCase() === 'product' ||
      $('[class*="product-detail" i], [id*="product-detail" i]').length
  );
}

function elementAlt(
  element: ReturnType<ReturnType<typeof load>>
): string | null {
  const value =
    element.attr('alt') ||
    element.attr('title') ||
    element.closest('figure').find('figcaption').first().text();
  return value?.replace(/\s+/g, ' ').trim() || null;
}

function imageCandidateFromElement(
  element: ReturnType<ReturnType<typeof load>>,
  source: string,
  baseUrl: string
): ImageCandidate | null {
  const tag = tagName(element);
  const rawCandidates: Array<{ url: string; quality: number }> = [];

  if (tag === 'meta') {
    const content = element.attr('content');
    if (content) rawCandidates.push({ url: content, quality: 0 });
  } else {
    for (const attribute of IMAGE_ATTRIBUTES) {
      const value = element.attr(attribute);
      if (!value) continue;

      if (attribute.includes('srcset')) {
        rawCandidates.push(...parseSrcset(value));
      } else {
        const quality =
          attribute === 'data-zoom-image'
            ? 100_000
            : attribute === 'data-large_image' || attribute === 'data-full'
              ? 50_000
              : 0;
        rawCandidates.push({ url: value, quality });
      }
    }

    const anchor = element.closest('a[href]');
    const href = anchor.attr('href');
    if (href && /\.(?:avif|gif|jpe?g|png|webp)(?:$|[?#])/i.test(href)) {
      rawCandidates.push({ url: href, quality: 75_000 });
    }
  }

  const best = rawCandidates
    .map((candidate) => ({
      ...candidate,
      resolved: resolveImageUrl(candidate.url, baseUrl),
    }))
    .map((candidate) => ({
      ...candidate,
      quality: Math.max(
        candidate.quality,
        Number.parseInt(
          candidate.resolved?.searchParams.get('width') ??
            candidate.resolved?.searchParams.get('w') ??
            '0',
          10
        ) || 0
      ),
    }))
    .filter(
      (
        candidate
      ): candidate is typeof candidate & { resolved: URL } =>
        candidate.resolved !== null
    )
    .sort((left, right) => right.quality - left.quality)[0];

  if (!best) return null;

  return {
    url: best.resolved.href,
    alt: elementAlt(element),
    source,
    quality: best.quality,
  };
}

function imageElements(
  $: ReturnType<typeof load>,
  container: ReturnType<ReturnType<typeof load>>
): Array<ReturnType<ReturnType<typeof load>>> {
  const selected = new Set<unknown>();
  const elements: Array<ReturnType<ReturnType<typeof load>>> = [];

  const add = (element: ReturnType<ReturnType<typeof load>>) => {
    const node = element[0];
    if (!node || selected.has(node)) return;
    selected.add(node);
    elements.push(element);
  };

  const tag = tagName(container);
  if (tag === 'img' || tag === 'source' || tag === 'meta') add(container);

  container.find('img, source, meta[itemprop="image"]').each((_, node) => {
    add($(node));
  });

  return elements;
}

function jsonLdProductImages(
  $: ReturnType<typeof load>
): Array<{ url: string; alt: string | null; source: string }> {
  const images: Array<{ url: string; alt: string | null; source: string }> = [];
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== 'object') return;

    const object = value as Record<string, unknown>;
    const types = Array.isArray(object['@type'])
      ? object['@type']
      : [object['@type']];

    if (types.some((type) => typeof type === 'string' && /^(?:Product|ProductGroup)$/i.test(type))) {
      const addImage = (image: unknown) => {
        if (typeof image === 'string') {
          images.push({ url: image, alt: null, source: 'JSON-LD Product.image' });
        } else if (image && typeof image === 'object') {
          const imageObject = image as Record<string, unknown>;
          const url = imageObject.contentUrl ?? imageObject.url ?? imageObject['@id'];
          if (typeof url === 'string') {
            const caption = imageObject.caption ?? imageObject.name;
            images.push({
              url,
              alt: typeof caption === 'string' ? caption : null,
              source: 'JSON-LD Product.image',
            });
          }
        }
      };

      if (Array.isArray(object.image)) object.image.forEach(addImage);
      else if (object.image !== undefined) addImage(object.image);
    }

    Object.values(object).forEach(visit);
  };

  $('script[type="application/ld+json"]').each((_, script) => {
    try {
      visit(JSON.parse($(script).text()));
    } catch {
      // Invalid structured data is ignored; other page sources remain available.
    }
  });

  return images;
}

export function extractProductImages(
  html: string,
  baseUrl: string
): ProductImageExtraction {
  const $ = load(html);
  const candidatesFound: ImageCandidate[] = [];
  const expectedCounts: number[] = [];
  let rejectedCount = 0;
  const productContext = hasProductContext($);

  const addElement = (
    element: ReturnType<ReturnType<typeof load>>,
    source: string
  ) => {
    if (isExcludedContext(element)) return;
    const candidate = imageCandidateFromElement(element, source, baseUrl);
    if (candidate) candidatesFound.push(candidate);
    else if (
      IMAGE_ATTRIBUTES.some((attribute) => element.attr(attribute)) ||
      element.attr('content')
    ) {
      rejectedCount += 1;
    }
  };

  for (const selector of PRODUCT_GALLERY_SELECTORS) {
    $(selector).each((_, node) => {
      const gallery = $(node);
      const declaredCount = Number.parseInt(
        gallery.attr('data-image-count') ??
          gallery.attr('data-total-images') ??
          gallery.attr('aria-setsize') ??
          '',
        10
      );
      if (Number.isFinite(declaredCount) && declaredCount > 0) {
        expectedCounts.push(declaredCount);
      }

      for (const element of imageElements($, gallery)) {
        addElement(element, selector);
      }
    });
  }

  if (productContext) {
    $('[itemtype*="Product" i], [itemprop="image"]').each((_, node) => {
      const container = $(node);
      for (const element of imageElements($, container)) {
        addElement(element, '[itemtype*="Product"], [itemprop="image"]');
      }
    });

    $('main img, main source, main meta[itemprop="image"]').each((_, node) => {
      const element = $(node);
      const context = [
        element.attr('class'),
        element.attr('id'),
        element.parent().attr('class'),
        element.parent().attr('id'),
        element.attr('itemprop'),
      ]
        .filter(Boolean)
        .join(' ');
      if (/product|gallery|thumb|media|variant|image/i.test(context)) {
        addElement(element, 'main product image context');
      }
    });
  }

  for (const image of jsonLdProductImages($)) {
    const resolved = resolveImageUrl(image.url, baseUrl);
    if (resolved && !EXCLUDED_CONTEXT.test(image.alt ?? '')) {
      candidatesFound.push({
        url: resolved.href,
        alt: image.alt,
        source: image.source,
        quality: 0,
      });
    } else {
      rejectedCount += 1;
    }
  }

  if (candidatesFound.length === 0 && productContext) {
    $('meta[property="product:image"], meta[property="og:image"], meta[name="twitter:image"]').each(
      (_, node) =>
        addElement(
          $(node),
          $(node).attr('property') ? 'meta[property]' : 'meta[name]'
        )
    );
  }

  const deduplicated = new Map<
    string,
    { candidate: ImageCandidate; urlKey: string }
  >();
  for (const candidate of candidatesFound) {
    const resolved = resolveImageUrl(candidate.url, baseUrl);
    if (!resolved) {
      rejectedCount += 1;
      continue;
    }

    const key = normalizedImageKey(resolved);
    const existing = deduplicated.get(key);
    if (!existing) {
      deduplicated.set(key, { candidate, urlKey: key });
    } else if (candidate.quality > existing.candidate.quality) {
      deduplicated.set(key, { candidate: { ...candidate, alt: candidate.alt ?? existing.candidate.alt }, urlKey: key });
    }
  }

  const images = [...deduplicated.values()].map(({ candidate }, index) => ({
    url: candidate.url,
    alt: candidate.alt,
    source: candidate.source,
    order: index + 1,
  }));
  const expectedCount = expectedCounts.length
    ? Math.max(...expectedCounts)
    : null;

  return { images, expectedCount, rejectedCount };
}

function readCandidate(
  $: ReturnType<typeof load>,
  candidate: Candidate,
): string | null {
  const element = $(candidate.selector).first();

  if (!element.length) return null;

  const raw = candidate.attribute
    ? element.attr(candidate.attribute)
    : candidate.selector === 'img'
      ? element.attr('src') || element.attr('data-src')
      : element.text();

  const value = raw?.replace(/\s+/g, ' ').trim();

  return value || null;
}

function findValue(
  $: ReturnType<typeof load>,
  fieldCandidates: Candidate[],
): { selector: string; attribute: string | null; value: string } | null {
  for (const candidate of fieldCandidates) {
    const value = readCandidate($, candidate);

    if (value) {
      return {
        selector: candidate.selector,
        attribute: candidate.attribute ?? null,
        value,
      };
    }
  }

  return null;
}

function looksLikePrice(value: string): boolean {
  return /\d/.test(value) && /[$€£¥₹]|\b(?:USD|MXN|EUR|GBP|precio)\b|^\s*\d[\d.,\s]*\s*$|,\d{2}\s*$|\.\d{2}\s*$/.test(value);
}

export function detectProductFields(
  html: string,
  baseUrl = 'https://example.invalid/',
  productImages?: ProductImage[]
): SuggestedProductField[] {
  const $ = load(html);
  const fields: SuggestedProductField[] = [];
  const images = productImages ?? extractProductImages(html, baseUrl).images;
  const automaticPrice = detectAutomaticPrice(html);

  const definitions = [
    { key: 'name', label: 'Nombre', type: 'text' as const },
    { key: 'price', label: 'Precio', type: 'price' as const },
    { key: 'currency', label: 'Moneda', type: 'text' as const },
    { key: 'previousPrice', label: 'Precio anterior', type: 'price' as const },
    { key: 'image', label: 'Imagen', type: 'image' as const },
    { key: 'description', label: 'Descripción', type: 'text' as const },
  ];

  for (const definition of definitions) {
    const galleryImage = images.find(
      (image) => image.source !== 'JSON-LD Product.image'
    );
    const result =
      definition.key === 'image'
        ? galleryImage
          ? {
              selector:
                galleryImage.source === 'main product image context'
                  ? 'main img, main source'
                  : galleryImage.source,
              attribute: galleryImage.source.startsWith('meta[')
                ? 'content'
                : null,
              value: galleryImage.url,
            }
          : findValue($, candidates.image)
        : definition.key === 'price'
          ? automaticPrice
          : findValue($, candidates[definition.key]);

    if (!result) continue;

    if (
      (definition.key === 'price' || definition.key === 'previousPrice') &&
      !looksLikePrice(result.value)
    ) {
      continue;
    }

    fields.push({
      label: definition.label,
      selector: result.selector,
      attribute: result.attribute,
      type: definition.type,
      value: result.value,
    });
  }

  return fields;
}
