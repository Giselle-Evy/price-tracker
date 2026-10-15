import { describe, expect, it } from 'vitest';
import {
  detectProductFields,
  extractProductImages,
} from './auto-detect.js';

const baseUrl = 'https://shop.example/products/widget';

function gallery(images: string, attributes = ''): string {
  return `<main><h1>Widget</h1><div data-product-gallery ${attributes}>${images}</div></main>`;
}

describe('extractProductImages', () => {
  it('extracts one valid image and its alt text', () => {
    const result = extractProductImages(
      gallery('<img src="/images/widget-front.jpg" alt="Widget frontal">'),
      baseUrl
    );

    expect(result.images).toEqual([
      {
        url: 'https://shop.example/images/widget-front.jpg',
        alt: 'Widget frontal',
        source: '[data-product-gallery]',
        order: 1,
      },
    ]);
  });

  it('preserves all four images in gallery order', () => {
    const html = gallery(
      [1, 2, 3, 4]
        .map((index) => `<img src="/widget-${index}.jpg" alt="Vista ${index}">`)
        .join('')
    );

    expect(extractProductImages(html, baseUrl).images).toHaveLength(4);
  });

  it('has no fixed gallery limit', () => {
    const html = gallery(
      Array.from({ length: 12 }, (_, index) => `<img src="/widget-${index}.jpg">`).join('')
    );

    const result = extractProductImages(html, baseUrl);
    expect(result.images).toHaveLength(12);
    expect(result.images.map((image) => image.order)).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 1)
    );
  });

  it('extracts the image array from Product JSON-LD, including ImageObjects', () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Product',
          name: 'Widget',
          image: [
            '/json/front.jpg',
            {
              '@type': 'ImageObject',
              contentUrl: 'https://cdn.example/json/side.jpg',
              caption: 'Vista lateral',
            },
          ],
        },
      ],
    })}</script>`;

    const result = extractProductImages(html, baseUrl);
    expect(result.images.map((image) => image.url)).toEqual([
      'https://shop.example/json/front.jpg',
      'https://cdn.example/json/side.jpg',
    ]);
    expect(result.images[1].alt).toBe('Vista lateral');
  });

  it('uses the highest-resolution srcset candidate and lazy-load attributes', () => {
    const html = gallery(
      `<img src="/small.jpg" data-lazy-src="/lazy.jpg" data-srcset="/small.jpg 320w, /large.jpg 1280w" alt="Widget">`
    );

    expect(extractProductImages(html, baseUrl).images[0].url).toBe(
      'https://shop.example/large.jpg'
    );
  });

  it('resolves relative image URLs and retains absolute HTTPS URLs', () => {
    const html = gallery(
      '<img src="../images/front.jpg"><img src="https://cdn.example/widget-side.webp">'
    );

    expect(extractProductImages(html, baseUrl).images.map((image) => image.url)).toEqual([
      'https://shop.example/images/front.jpg',
      'https://cdn.example/widget-side.webp',
    ]);
  });

  it('deduplicates equivalent URLs without collapsing separate product views', () => {
    const html = gallery(
      '<img src="/view/front.jpg?width=320"><img src="/view/front.jpg?width=1600#main"><img src="/view/back.jpg">'
    );

    const result = extractProductImages(html, baseUrl);
    expect(result.images).toHaveLength(2);
    expect(result.images[0].url).toBe(
      'https://shop.example/view/front.jpg?width=1600'
    );
    expect(result.images[1].url).toBe('https://shop.example/view/back.jpg');
  });

  it('does not collect banners, logos, or recommended-product images', () => {
    const html = `<main>
      <div class="site-banner"><img src="/banner.jpg"></div>
      <div class="brand-logo"><img src="/logo.svg"></div>
      <div class="related-products product-gallery"><img src="/recommended.jpg"></div>
      <div data-product-gallery><img src="/widget.jpg"></div>
    </main>`;

    expect(extractProductImages(html, baseUrl).images.map((image) => image.url)).toEqual([
      'https://shop.example/widget.jpg',
    ]);
  });

  it('returns an empty collection when no product image source is available', () => {
    const result = extractProductImages(
      '<main><h1>Widget</h1><p>No images here</p></main>',
      baseUrl
    );

    expect(result.images).toEqual([]);
    expect(result.expectedCount).toBeNull();
  });

  it('rejects invalid schemes and private-network image URLs', () => {
    const html = gallery(
      '<img src="javascript:alert(1)"><img src="http://127.0.0.1/private.jpg"><img src="data:image/png;base64,AAAA">'
    );

    const result = extractProductImages(html, baseUrl);
    expect(result.images).toEqual([]);
    expect(result.rejectedCount).toBeGreaterThan(0);
  });

  it('reports the expected gallery count when only some thumbnails are present', () => {
    const html = gallery(
      '<img src="/one.jpg"><img src="/two.jpg">',
      'data-image-count="5"'
    );

    const result = extractProductImages(html, baseUrl);
    expect(result.images).toHaveLength(2);
    expect(result.expectedCount).toBe(5);
  });

  it('keeps the legacy detected image field derived from the first valid image', () => {
    const html = gallery(
      '<img src="/first.jpg"><img src="/second.jpg">'
    );
    const images = extractProductImages(html, baseUrl).images;
    const imageField = detectProductFields(html, baseUrl, images).find(
      (field) => field.type === 'image'
    );

    expect(imageField).toMatchObject({
      label: 'Imagen',
      value: images[0].url,
      selector: '[data-product-gallery]',
      attribute: null,
    });
  });

  it('uses a runnable content attribute selector for product metadata images', () => {
    const html = `<main>
      <meta property="og:type" content="product">
      <meta property="og:image" content="https://cdn.example/widget.jpg">
    </main>`;
    const images = extractProductImages(html, baseUrl).images;
    const imageField = detectProductFields(html, baseUrl, images).find(
      (field) => field.type === 'image'
    );

    expect(imageField).toMatchObject({
      selector: 'meta[property]',
      attribute: 'content',
      value: 'https://cdn.example/widget.jpg',
    });
  });

  it('detects a product description without inventing missing price data', () => {
    const html = `<main>
      <h1>Widget</h1>
      <meta name="description" content="Descripción real del producto">
      <meta property="product:price:amount" content="19.99">
      <meta property="product:price:currency" content="MXN">
    </main>`;

    const fields = detectProductFields(html, baseUrl);
    expect(fields.find((field) => field.label === 'Descripción')?.value).toBe(
      'Descripción real del producto'
    );
    expect(fields.find((field) => field.label === 'Precio')?.value).toBe(
      '19.99'
    );
    expect(fields.find((field) => field.label === 'Moneda')?.value).toBe(
      'MXN'
    );
    expect(fields.find((field) => field.label === 'Precio anterior')).toBeUndefined();
  });
});
