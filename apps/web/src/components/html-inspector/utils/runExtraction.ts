import type { ExtractField } from '../FieldsPanel';

export type ExtractionResultStatus = 'success' | 'warning' | 'error' | 'empty';

export type ExtractionResult = {
  fieldId: string;
  label: string;
  selector: string;
  attribute?: string;
  type: string;
  status: ExtractionResultStatus;
  value: string | null;
  matchCount: number;
  message?: string;
};

/**
 * Ejecuta un selector CSS sobre un HTML y devuelve el resultado.
 */
export function runExtraction(
  html: string,
  fields: ExtractField[]
): ExtractionResult[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  return fields.map((field) => runSingleExtraction(doc, field));
}

function runSingleExtraction(
  doc: Document,
  field: ExtractField
): ExtractionResult {
  const base: ExtractionResult = {
    fieldId: field.id,
    label: field.label,
    selector: field.selector,
    attribute: field.attribute,
    type: field.type,
    status: 'error',
    value: null,
    matchCount: 0,
  };

  // Ejecutar selector
  let matches: Element[];
  try {
    matches = Array.from(doc.querySelectorAll(field.selector));
  } catch {
    return {
      ...base,
      status: 'error',
      message: 'Selector CSS inválido',
    };
  }

  if (matches.length === 0) {
    return {
      ...base,
      status: 'error',
      message: 'No se encontró ningún elemento con este selector',
    };
  }

  // Tomar el primer match
  const element = matches[0];

  // Extraer valor
    // Extraer valor
  let value: string | null;

  if (field.attribute) {
    // Extraer atributo
    value = element.getAttribute(field.attribute);
    if (value === null) {
      return {
        ...base,
        status: 'warning',
        matchCount: matches.length,
        message: `El elemento no tiene el atributo "${field.attribute}"`,
      };
    }
  } else {
    // Extraer texto
    value = element.textContent?.trim() || '';
  }

  // Post-procesamiento según tipo
  if (field.type === 'image' && value) {
    value = normalizeUrl(value);
  }

  if (field.type === 'price' && value) {
    // Extraer solo el número y símbolo (quitar espacios raros)
    value = value.replace(/\s+/g, ' ').trim();
  }

  if (!value) {
    return {
      ...base,
      status: 'empty',
      matchCount: matches.length,
      message: 'El elemento está vacío',
    };
  }

  const status: ExtractionResultStatus = matches.length > 1 ? 'warning' : 'success';

  return {
    ...base,
    status,
    value,
    matchCount: matches.length,
    message:
      matches.length > 1
        ? `Se encontraron ${matches.length} elementos. Se usa el primero.`
        : undefined,
  };
}

/**
 * Normaliza una URL de imagen (por ejemplo, convierte rutas relativas).
 */
function normalizeUrl(url: string): string {
  // Por ahora devolvemos el valor tal cual. En el backend podríamos
  // resolver rutas relativas contra la URL final de la página.
  return url.trim();
}