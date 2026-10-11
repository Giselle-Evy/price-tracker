/**
 * Genera un selector CSS único para un elemento DOM.
 * Estrategia:
 *   1. Si tiene ID → #id
 *   2. Si tiene clases → tag.class1.class2
 *   3. Si tiene atributos útiles → tag[attr="value"]
 *   4. Si no → tag:nth-of-type(N) dentro del padre
 *   5. Sube por el árbol hasta que el selector sea único
 */
export function buildSelector(element: Element): string {
  // Caso 1: ID
  if (element.id) {
    return `#${element.id}`;
  }

  // Caso 2: clases
  const classes = element.className
    ? element.className.split(/\s+/).filter(Boolean)
    : [];

  if (classes.length > 0) {
    const tag = element.tagName.toLowerCase();
    const classSelector = `${tag}.${classes.join('.')}`;
    // Verificar que el selector es único en el documento
    try {
      const matches = element.ownerDocument.querySelectorAll(classSelector);
      if (matches.length === 1) {
        return classSelector;
      }
    } catch {
      // Algunos nombres de clase pueden romper el selector (caracteres raros)
    }
  }

  // Caso 3: atributos útiles
  const usefulAttrs = ['data-testid', 'name', 'aria-label', 'itemprop', 'role'];
  for (const attr of usefulAttrs) {
    const value = element.getAttribute(attr);
    if (value) {
      const tag = element.tagName.toLowerCase();
      const selector = `${tag}[${attr}="${value}"]`;
      try {
        const matches = element.ownerDocument.querySelectorAll(selector);
        if (matches.length === 1) {
          return selector;
        }
      } catch {
        // ignore
      }
    }
  }

  // Caso 4: construir selector compuesto subiendo por el árbol
  return buildPathSelector(element);
}

function buildPathSelector(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    const tag = current.tagName.toLowerCase();

    // En el html, no añadir nth-of-type
    if (tag === 'html') {
      parts.unshift('html');
      break;
    }

    // Intentar con ID
    if (current.id) {
      parts.unshift(`#${current.id}`);
      break;
    }

    // Intentar con clases
    const classes = current.className
      ? current.className.split(/\s+/).filter(Boolean)
      : [];
    if (classes.length > 0 && parts.length === 0) {
      // Solo usamos clases para el elemento final, no para ancestros
      // (sino el selector se hace enorme)
      parts.unshift(`${tag}.${classes.join('.')}`);
    } else {
      // Añadir nth-of-type
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          (sib) => sib.tagName === current!.tagName
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          parts.unshift(`${tag}:nth-of-type(${index})`);
        } else {
          parts.unshift(tag);
        }
      } else {
        parts.unshift(tag);
      }
    }

    current = current.parentElement;
  }

  return parts.join(' > ');
}

/**
 * Devuelve un resumen legible del elemento:
 * - Tag
 * - Si tiene ID
 * - Clases
 * - Atributos relevantes
 */
export type ElementSummary = {
  tag: string;
  id?: string;
  classes: string[];
  attributes: Record<string, string>;
  text: string;
  selector: string;
};

export function summarizeElement(element: Element): ElementSummary {
  const tag = element.tagName.toLowerCase();
  const id = element.id || undefined;
  const classes = element.className
    ? element.className.split(/\s+/).filter(Boolean)
    : [];

  const attributes: Record<string, string> = {};
  for (const attr of Array.from(element.attributes)) {
    if (attr.name === 'class') continue;
    attributes[attr.name] = attr.value;
  }

  // Texto directo
  let text = '';
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      text += (child.textContent || '') + ' ';
    }
  }
  text = text.trim();

  return {
    tag,
    id,
    classes,
    attributes,
    text,
    selector: buildSelector(element),
  };
}