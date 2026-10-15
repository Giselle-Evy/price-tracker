import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

import type { HtmlNode } from './utils/parseHtml';

type Props = {
  node: HtmlNode;
  selectedId: string | null;
  highlightedId: string | null;
  expandedIds: Set<string>;
  onSelect: (node: HtmlNode) => void;
  depth: number;
};

const MAX_INDENT_DEPTH = 8;

export default function HtmlTreeNode({
  node,
  selectedId,
  highlightedId,
  expandedIds,
  onSelect,
  depth,
}: Props) {
  const [open, setOpen] = useState(depth < 3);
  const rowRef = useRef<HTMLDivElement>(null);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.nodeId;
  const isHighlighted = highlightedId === node.nodeId;
  const isExpandedForSearch = expandedIds.has(node.nodeId);
  const isOpen = open || isExpandedForSearch;

  // Clases visuales para el nombre del tag
  const tagColor = getTagColor(node.tag);

  useEffect(() => {
    if (isHighlighted) {
      rowRef.current?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [isHighlighted]);

  return (
    <div>
      {/* Fila del nodo */}
      <div
        ref={rowRef}
        className={`flex items-center gap-1 py-1 px-2 rounded cursor-pointer text-xs font-mono transition-colors ${
          isHighlighted
            ? 'bg-amber-400/20 text-on-surface ring-1 ring-inset ring-amber-400'
            : isSelected
              ? 'bg-primary-container text-on-primary-container'
              : 'hover:bg-surface-container-low'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => onSelect(node)}
      >
        {/* Flecha colapsable */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isExpandedForSearch) setOpen(!open);
            }}
            className="flex-shrink-0 w-4 h-4 flex items-center justify-center text-secondary hover:text-on-surface"
          >
            {isOpen ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>
        ) : (
          <span className="w-4 h-4 flex-shrink-0" />
        )}

        {/* Tag */}
        <span className={`font-semibold ${tagColor}`}>&lt;{node.tag}</span>

        {/* ID */}
        {node.id && (
          <span className="text-amber-600">
            #{node.id}
          </span>
        )}

        {/* Clases */}
        {node.classes.length > 0 && (
          <span className="text-primary">
            .{node.classes.join('.')}
          </span>
        )}

        <span className={`font-semibold ${tagColor}`}>&gt;</span>

        {/* Texto preview */}
        {node.textPreview && (
          <span className="text-on-surface-variant truncate ml-1 opacity-70">
            {node.textPreview}
          </span>
        )}
      </div>

      {/* Hijos */}
      {isOpen && hasChildren && (
        <div>
          {node.children.map((child) => (
            <HtmlTreeNode
              key={child.nodeId}
              node={child}
              selectedId={selectedId}
              highlightedId={highlightedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              depth={Math.min(depth + 1, MAX_INDENT_DEPTH)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Asigna un color a cada tag según su tipo.
 * Útil para identificar visualmente la estructura.
 */
function getTagColor(tag: string): string {
  // Estructura
  if (['html', 'body', 'head'].includes(tag)) return 'text-secondary';
  // Contenedores
  if (['div', 'section', 'article', 'main', 'aside', 'header', 'footer', 'nav'].includes(tag)) {
    return 'text-indigo-600';
  }
  // Texto
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'strong', 'em'].includes(tag)) {
    return 'text-emerald-700';
  }
  // Listas
  if (['ul', 'ol', 'li'].includes(tag)) return 'text-purple-600';
  // Tablas
  if (['table', 'thead', 'tbody', 'tr', 'td', 'th'].includes(tag)) return 'text-orange-600';
  // Media
  if (['img', 'video', 'audio', 'picture', 'source'].includes(tag)) return 'text-pink-600';
  // Links
  if (['a'].includes(tag)) return 'text-blue-600';
  // Formularios
  if (['form', 'input', 'button', 'select', 'textarea', 'label'].includes(tag)) return 'text-red-600';
  // Otros
  return 'text-on-surface';
}