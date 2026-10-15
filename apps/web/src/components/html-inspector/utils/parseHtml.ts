export type HtmlNode = {
  /** Identificador único dentro del árbol (para keys de React) */
  nodeId: string;
  /** Etiqueta HTML: html, body, div, h1, span, etc. */
  tag: string;
  /** ID del elemento, si tiene */
  id?: string;
  /** Clases CSS */
  classes: string[];
  /** Otros atributos (src, href, alt, etc.) */
  attributes: Record<string, string>;
  /** Texto directo del nodo (truncado) */
  textPreview: string;
  /** Texto directo completo, usado para búsquedas sin truncar resultados */
  searchText: string;
  /** Hijos */
  children: HtmlNode[];
  /** Elemento DOM original (referencia, no serializable) */
  element: Element;
};

const MAX_TEXT_PREVIEW = 100;
const SKIP_TAGS = new Set([
  'script',
  'style',
  'link',
  'noscript',
  'template',
  'svg',
  'path',
]);

/**
 * Convierte un string HTML en un árbol de objetos navegable.
 * Usa DOMParser del navegador (seguro: no ejecuta scripts).
 */
export function parseHtml(html: string): HtmlNode | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  if (!doc.documentElement) return null;

  let counter = 0;

  function visit(element: Element): HtmlNode {
    const nodeId = `node-${counter++}`;
    const tag = element.tagName.toLowerCase();

    // Texto directo (solo nodos de texto hijos, no de descendientes)
    let searchText = '';
    for (const child of Array.from(element.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = (child.textContent || '').trim();
        if (text) {
          searchText += text + ' ';
        }
      }
    }
    searchText = searchText.trim();
    const textPreview = searchText.slice(0, MAX_TEXT_PREVIEW);

    // Atributos
    const attributes: Record<string, string> = {};
    for (const attr of Array.from(element.attributes)) {
      attributes[attr.name] = attr.value;
    }

    // Clases
    const classes = element.className
      ? element.className.split(/\s+/).filter(Boolean)
      : [];

    // ID
    const id = element.id || undefined;

    // Hijos (recursivo, saltando tags irrelevantes)
    const children: HtmlNode[] = [];
    for (const child of Array.from(element.children)) {
      const childTag = child.tagName.toLowerCase();
      if (SKIP_TAGS.has(childTag)) continue;
      children.push(visit(child));
    }

    return {
      nodeId,
      tag,
      id,
      classes,
      attributes,
      textPreview,
      searchText,
      children,
      element,
    };
  }

  return visit(doc.documentElement);
}

/**
 * Cuenta cuántos nodos tiene el árbol (útil para mostrar estadísticas).
 */
export function countNodes(node: HtmlNode): number {
  let count = 1;
  for (const child of node.children) {
    count += countNodes(child);
  }
  return count;
}