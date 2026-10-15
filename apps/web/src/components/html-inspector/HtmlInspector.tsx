import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';

import { parseHtml, countNodes, type HtmlNode } from './utils/parseHtml';
import {
  getNextSearchIndex,
  searchHtmlNodes,
  type HtmlSearchCriterion,
  type SearchDirection,
} from './utils/searchHtml';
import HtmlTree from './HtmlTree';
import ElementDetails from './ElementDetails';

type Props = {
  html: string;
  onAddField: (selector: string, suggestedAttribute?: string) => void;
};

export default function HtmlInspector(props: Props) {
  return <HtmlInspectorContent key={props.html} {...props} />;
}

function HtmlInspectorContent({ html, onAddField }: Props) {
  const [selectedNode, setSelectedNode] = useState<HtmlNode | null>(null);
  const [query, setQuery] = useState('');
  const [criterion, setCriterion] = useState<HtmlSearchCriterion>('all');
  const [activeSearch, setActiveSearch] = useState<{
    query: string;
    criterion: HtmlSearchCriterion;
    index: number;
  } | null>(null);

  const root = useMemo(() => parseHtml(html), [html]);
  const totalNodes = useMemo(() => (root ? countNodes(root) : 0), [root]);
  const results = useMemo(
    () => (root ? searchHtmlNodes(root, criterion, query) : []),
    [root, criterion, query]
  );
  const activeResultIndex =
    activeSearch?.query === query && activeSearch.criterion === criterion
      ? activeSearch.index
      : -1;
  const activeResult = results[activeResultIndex] ?? null;

  function navigateResults(direction: SearchDirection) {
    const nextIndex = getNextSearchIndex(
      activeResultIndex,
      results.length,
      direction
    );
    if (nextIndex < 0) return;

    setActiveSearch({ query, criterion, index: nextIndex });
    const result = results[nextIndex];
    setSelectedNode(result);
  }

  if (!root) {
    return (
      <div className="p-6 text-center text-on-surface-variant">
        No se pudo parsear el HTML.
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant bg-surface-container-low">
        <h2 className="text-sm font-semibold text-on-surface">
          Inspector de HTML
        </h2>
        <span className="text-xs text-on-surface-variant">
          {totalNodes.toLocaleString()} nodos
        </span>
      </div>

      <div className="flex flex-col gap-2 border-b border-outline-variant bg-surface-container-low/50 px-4 py-3 sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Buscar en el HTML</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                navigateResults(event.shiftKey ? 'previous' : 'next');
              }
            }}
            placeholder="Buscar texto, etiqueta, ID, clase o atributo..."
            className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest py-2 pl-9 pr-3 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </label>

        <label className="sr-only" htmlFor="html-search-criterion">
          Criterio de búsqueda
        </label>
        <select
          id="html-search-criterion"
          value={criterion}
          onChange={(event) =>
            setCriterion(event.target.value as HtmlSearchCriterion)
          }
          className="rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">Todo</option>
          <option value="text">Texto visible</option>
          <option value="tag">Etiqueta</option>
          <option value="id">ID</option>
          <option value="class">Clase</option>
          <option value="attribute">Atributo</option>
        </select>

        <div className="flex items-center justify-between gap-3 sm:justify-start">
          <span
            aria-live="polite"
            className="min-w-[7rem] text-xs text-on-surface-variant"
          >
            {query.trim()
              ? results.length === 0
                ? 'Sin coincidencias'
                : `${activeResultIndex < 0 ? 0 : activeResultIndex + 1} de ${results.length}`
              : 'Escribe para buscar'}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Resultado anterior"
              title="Resultado anterior (Shift+Enter)"
              disabled={results.length === 0}
              onClick={() => navigateResults('previous')}
              className="rounded-md p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronUp aria-hidden="true" className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Resultado siguiente"
              title="Resultado siguiente (Enter)"
              disabled={results.length === 0}
              onClick={() => navigateResults('next')}
              className="rounded-md p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronDown aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-outline-variant">
        <div className="max-h-[600px] overflow-auto p-2">
          <HtmlTree
            root={root}
            selectedId={selectedNode?.nodeId || null}
            highlightedId={activeResult?.nodeId ?? null}
            onSelect={setSelectedNode}
          />
        </div>

        <div className="max-h-[600px] overflow-auto bg-surface-container-low/30">
          <ElementDetails node={selectedNode} onAddField={onAddField} />
        </div>
      </div>
    </div>
  );
}