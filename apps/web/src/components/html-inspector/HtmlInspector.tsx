import { useMemo, useState } from 'react';

import { parseHtml, countNodes, type HtmlNode } from './utils/parseHtml';
import HtmlTree from './HtmlTree';
import ElementDetails from './ElementDetails';

type Props = {
  html: string;
};

export default function HtmlInspector({ html }: Props) {
  const [selectedNode, setSelectedNode] = useState<HtmlNode | null>(null);

  const root = useMemo(() => parseHtml(html), [html]);
  const totalNodes = useMemo(() => (root ? countNodes(root) : 0), [root]);

  if (!root) {
    return (
      <div className="p-6 text-center text-on-surface-variant">
        No se pudo parsear el HTML.
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant bg-surface-container-low">
        <h2 className="text-sm font-semibold text-on-surface">
          Inspector de HTML
        </h2>
        <span className="text-xs text-on-surface-variant">
          {totalNodes.toLocaleString()} nodos
        </span>
      </div>

      {/* Panel dividido */}
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-outline-variant">
        {/* Árbol */}
        <div className="max-h-[600px] overflow-auto p-2">
          <HtmlTree
            root={root}
            selectedId={selectedNode?.nodeId || null}
            onSelect={setSelectedNode}
          />
        </div>

        {/* Detalles */}
        <div className="max-h-[600px] overflow-auto bg-surface-container-low/30">
          <ElementDetails node={selectedNode} />
        </div>
      </div>
    </div>
  );
}