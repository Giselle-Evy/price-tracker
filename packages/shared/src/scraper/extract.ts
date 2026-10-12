import * as cheerio from 'cheerio';

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