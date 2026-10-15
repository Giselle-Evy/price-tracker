import * as cheerio from 'cheerio';

const AUTOMATIC_PRICE_CANDIDATES: Array<{
  selector: string;
  attribute?: string;
}> = [
  { selector: '[itemprop="price"]', attribute: 'content' },
  { selector: 'meta[property="product:price:amount"]', attribute: 'content' },
  { selector: 'meta[property="og:price:amount"]', attribute: 'content' },
  { selector: '[class*="sale-price"]' },
  { selector: '[class*="current-price"]' },
  { selector: '[class*="price"]' },
];

export type AutomaticPrice = {
  selector: string;
  attribute: string | null;
  value: string;
  price: number;
};

function looksLikePrice(value: string): boolean {
  return /\d/.test(value) && /[$€£¥₹]|\b(?:USD|MXN|EUR|GBP|precio)\b|^\s*\d[\d.,\s]*\s*$|,\d{2}\s*$|\.\d{2}\s*$/.test(value);
}

export function detectAutomaticPrice(html: string): AutomaticPrice | null {
  const $ = cheerio.load(html);

  for (const candidate of AUTOMATIC_PRICE_CANDIDATES) {
    const element = $(candidate.selector).first();
    if (!element.length) continue;

    const raw = candidate.attribute
      ? element.attr(candidate.attribute)
      : element.text();
    const value = raw?.replace(/\s+/g, ' ').trim();
    if (!value || !looksLikePrice(value)) continue;

    const price = parsePrice(value);
    if (price === null || !Number.isFinite(price) || price <= 0) continue;

    return {
      selector: candidate.selector,
      attribute: candidate.attribute ?? null,
      value,
      price,
    };
  }

  return null;
}

export type ExtractFieldInput = {
  label: string;
  selector: string;
  attribute: string | null;
  type: 'text' | 'price' | 'image' | 'url';
};

export type ExtractResult = {
  values: Record<string, string | null>;
  fieldErrors: Array<{ label: string; error: string }>;
};

/**
 * Aplica un array de fields (con selectores CSS) sobre un HTML.
 * Devuelve un objeto con { label -> valor extraido }.
 *
 * - Si el selector no matchea nada, el valor es null.
 * - Si el field tiene attribute, extrae ese atributo; si no, el texto.
 * - Los errores por field se acumulan en fieldErrors pero no cortan el proceso.
 */
export function extractFields(
  html: string,
  fields: ExtractFieldInput[]
): ExtractResult {
  const $ = cheerio.load(html);
  const values: Record<string, string | null> = {};
  const fieldErrors: Array<{ label: string; error: string }> = [];

  for (const field of fields) {
    try {
      const element = $(field.selector).first();

      if (element.length === 0) {
        values[field.label] = null;
        fieldErrors.push({
          label: field.label,
          error: 'Selector sin resultados',
        });
        continue;
      }

      let value: string | null;

      if (field.attribute) {
        const attr = element.attr(field.attribute);
        value = attr ?? null;

        if (value === null) {
          fieldErrors.push({
            label: field.label,
            error: `Atributo "${field.attribute}" no existe`,
          });
        }
      } else {
        const text = element.text().trim();
        value = text.length > 0 ? text : null;

        if (value === null) {
          fieldErrors.push({
            label: field.label,
            error: 'Elemento sin texto',
          });
        }
      }

      values[field.label] = value;
    } catch (err) {
      values[field.label] = null;
      fieldErrors.push({
        label: field.label,
        error: err instanceof Error ? err.message : 'Error desconocido',
      });
    }
  }

  return { values, fieldErrors };
}

/**
 * Parsea un precio desde texto (string) a numero decimal.
 * Acepta formatos como "51.77", "1,234.56", "1.234,56", etc.
 *
 * Devuelve null si no se puede parsear.
 */
export function parsePrice(raw: string | null): number | null {
  if (!raw) return null;

  const cleaned = raw.replace(/[^\d.,-]/g, '').trim();

  if (cleaned.length === 0) return null;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  let normalized: string;

  if (lastComma > lastDot) {
    // Formato europeo: "1.234,56" -> "1234.56"
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // Formato US/UK: "1,234.56" -> "1234.56"
    normalized = cleaned.replace(/,/g, '');
  }

  const parsed = parseFloat(normalized);

  if (Number.isNaN(parsed)) return null;

  return parsed;
}