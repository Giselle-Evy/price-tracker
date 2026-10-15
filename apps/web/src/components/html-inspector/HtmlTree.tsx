import { useMemo } from 'react';

import type { HtmlNode } from './utils/parseHtml';
import { getHtmlNodeAncestors } from './utils/searchHtml';
import HtmlTreeNode from './HtmlTreeNode';

type Props = {
  root: HtmlNode;
  selectedId: string | null;
  highlightedId: string | null;
  onSelect: (node: HtmlNode) => void;
};

export default function HtmlTree({
  root,
  selectedId,
  highlightedId,
  onSelect,
}: Props) {
  const expandedIds = useMemo(
    () =>
      highlightedId
        ? new Set(getHtmlNodeAncestors(root, highlightedId))
        : new Set<string>(),
    [root, highlightedId]
  );

  return (
    <div className="font-mono text-xs">
      <HtmlTreeNode
        node={root}
        selectedId={selectedId}
        highlightedId={highlightedId}
        expandedIds={expandedIds}
        onSelect={onSelect}
        depth={0}
      />
    </div>
  );
}