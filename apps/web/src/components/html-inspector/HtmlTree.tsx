import type { HtmlNode } from './utils/parseHtml';
import HtmlTreeNode from './HtmlTreeNode';

type Props = {
  root: HtmlNode;
  selectedId: string | null;
  onSelect: (node: HtmlNode) => void;
};

export default function HtmlTree({ root, selectedId, onSelect }: Props) {
  return (
    <div className="font-mono text-xs">
      <HtmlTreeNode
        node={root}
        selectedId={selectedId}
        onSelect={onSelect}
        depth={0}
      />
    </div>
  );
}