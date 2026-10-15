
import type { ExtractionResult } from '../html-inspector/utils/runExtraction';
import type { ProductImagePreview } from '../html-inspector/ProductImageGallery';

export type ProductDetectedField = {
  label: string;
  value: string;
};

export type ProductFieldKind =
  | 'name'
  | 'currentPrice'
  | 'previousPrice'
  | 'description'
  | 'currency'
  | 'image';

function normalizeLabel(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Clasifica las etiquetas de los campos del producto.
 * Esta función es la fuente central de clasificación para el constructor
 * y el formulario de confirmación.
 */
export function getProductFieldKind(label: string): ProductFieldKind | null {
  const normalized = normalizeLabel(label);

  // Los precios anteriores deben identificarse antes que los actuales.
  if (
    /\bprecio\s+(?:anterior|antiguo|antigua|original|base|historico|de lista|regular|sin descuento|tachado|de referencia)\b/.test(
      normalized
    ) ||
    /\b(?:old|original|previous|list|regular|base|reference|retail|was)\s+price\b/.test(
      normalized
    ) ||
    /\bprice\s+(?:before discount|without discount|original|regular|list|base|was)\b/.test(
      normalized
    )
  ) {
    return 'previousPrice';
  }

  // Imágenes del producto.
  if (/\b(?:imagen|image|fotografia|foto)\b/.test(normalized)) {
    return 'image';
  }

  // Nombre del producto.
  if (
    /\b(?:nombre|titulo)\s+(?:del\s+)?producto\b/.test(normalized) ||
    /\b(?:nombre|titulo|product name|title)\b/.test(normalized)
  ) {
    return 'name';
  }

  // Descripción.
  if (/\b(?:descripcion|description)\b/.test(normalized)) {
    return 'description';
  }

  // Moneda.
  if (/\b(?:moneda|currency)\b/.test(normalized)) {
    return 'currency';
  }

  // Precios actuales, nuevos o con descuento.
  if (
    /\b(?:precio|price)\s+(?:actual|nuevo|con descuento|rebajado|de oferta|oferta|final)\b/.test(
      normalized
    ) ||
    /\b(?:current|new|sale|discounted|offer|final)\s+price\b/.test(
      normalized
    ) ||
    /\b(?:precio|price)\b/.test(normalized)
  ) {
    return 'currentPrice';
  }

  return null;
}

export function parseProductPrice(
  value: string | null | undefined
): number | null {
  if (!value) return null;

  let cleaned = value.replace(/[^\d.,-]/g, '');
  if (!/\d/.test(cleaned)) return null;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  const decimalIndex = Math.max(lastComma, lastDot);

  if (lastComma !== -1 && lastDot !== -1) {
    const decimalSeparator = decimalIndex === lastComma ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';

    cleaned = cleaned
      .split(thousandsSeparator)
      .join('')
      .replace(decimalSeparator, '.');
  } else if (decimalIndex !== -1) {
    const decimals = cleaned.length - decimalIndex - 1;
    const separator = cleaned[decimalIndex];

    cleaned =
      decimals === 1 || decimals === 2
        ? cleaned.replace(separator, '.')
        : cleaned.split(separator).join('');
  }

  const price = Number(cleaned);

  if (
    !Number.isFinite(price) ||
    price <= 0 ||
    price > 9_999_999_999.99 ||
    Number(price.toFixed(2)) !== price
  ) {
    return null;
  }

  return price;
}

export function mergeManualProductFields(
  detectedFields: ProductDetectedField[],
  results: ExtractionResult[] | null
): ProductDetectedField[] {
  if (!results?.length) return detectedFields;

  const replacements = new Map<ProductFieldKind, string>();

  for (const result of results) {
    if (
      (result.status !== 'success' && result.status !== 'warning') ||
      !result.value?.trim()
    ) {
      continue;
    }

    const kind = getProductFieldKind(result.label);

    // Las imágenes se procesan por separado.
    if (!kind || kind === 'image' || replacements.has(kind)) {
      continue;
    }

    // No reemplazar precios con valores que no se puedan interpretar.
    if (
      (kind === 'currentPrice' || kind === 'previousPrice') &&
      parseProductPrice(result.value) === null
    ) {
      continue;
    }

    replacements.set(kind, result.value);
  }

  if (replacements.size === 0) return detectedFields;

  const canonicalLabels: Record<ProductFieldKind, string> = {
    name: 'Nombre del producto',
    currentPrice: 'Precio nuevo',
    previousPrice: 'Precio antiguo',
    description: 'Descripción',
    currency: 'Moneda',
    image: 'Imagen del producto',
  };

  const updatedKinds = new Set<ProductFieldKind>();
  const mergedFields: ProductDetectedField[] = [];

  for (const field of detectedFields) {
    const kind = getProductFieldKind(field.label);
    const replacement = kind ? replacements.get(kind) : undefined;

    if (!kind || replacement === undefined) {
      mergedFields.push(field);
      continue;
    }

    // Evita duplicar campos de la misma categoría.
    if (updatedKinds.has(kind)) continue;

    mergedFields.push({
      label: canonicalLabels[kind],
      value: replacement,
    });

    updatedKinds.add(kind);
  }

  // Añadir campos personalizados que no existían en la detección automática.
  for (const [kind, value] of replacements) {
    if (!updatedKinds.has(kind)) {
      mergedFields.push({
        label: canonicalLabels[kind],
        value,
      });
    }
  }

  return mergedFields;
}

export function mergeManualProductImages(
  detectedImages: ProductImagePreview[],
  results: ExtractionResult[] | null
): ProductImagePreview[] {
  const imageResult = results?.find(
    (result) =>
      (result.status === 'success' || result.status === 'warning') &&
      result.values.length > 0 &&
      (result.type === 'image' ||
        getProductFieldKind(result.label) === 'image')
  );

  if (!imageResult) return detectedImages;

  const existingImages = new Map(
    detectedImages.map((image) => [image.url, image])
  );

  return [...new Set(imageResult.values)].map(
    (url, index) =>
      existingImages.get(url) ?? {
        url,
        alt: null,
        source: 'manual-selector',
        order: index + 1,
      }
  );
}
