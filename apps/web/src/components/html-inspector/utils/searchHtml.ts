import type { HtmlNode } from './parseHtml';

export type HtmlSearchCriterion =
  | 'all'
  | 'text'
  | 'tag'
  | 'id'
  | 'class'
  | 'attribute';

export type SearchDirection = 'next' | 'previous';

export function searchHtmlNodes(
  root: HtmlNode,
  criterion: HtmlSearchCriterion,
  query: string
): HtmlNode[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return [];

  const matches: HtmlNode[] = [];
  const pending = [root];

  while (pending.length > 0) {
    const node = pending.pop()!;
    if (matchesNode(node, criterion, normalizedQuery)) {
      matches.push(node);
    }

    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      pending.push(node.children[index]);
    }
  }

  return matches;
}

export function getNextSearchIndex(
  currentIndex: number,
  total: number,
  direction: SearchDirection
): number {
  if (total === 0) return -1;
  if (currentIndex < 0 || currentIndex >= total) {
    return direction === 'next' ? 0 : total - 1;
  }

  const offset = direction === 'next' ? 1 : -1;
  return (currentIndex + offset + total) % total;
}

export function getHtmlNodeAncestors(
  root: HtmlNode,
  targetId: string
): string[] {
  const pending: Array<{ node: HtmlNode; parentId: string | null }> = [
    { node: root, parentId: null },
  ];
  const parentById = new Map<string, string | null>();

  while (pending.length > 0) {
    const { node, parentId } = pending.pop()!;
    parentById.set(node.nodeId, parentId);
    if (node.nodeId === targetId) {
      const ancestors: string[] = [];
      let ancestorId = parentId;
      while (ancestorId !== null) {
        ancestors.unshift(ancestorId);
        ancestorId = parentById.get(ancestorId) ?? null;
      }
      return ancestors;
    }

    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      pending.push({
        node: node.children[index],
        parentId: node.nodeId,
      });
    }
  }

  return [];
}

function matchesNode(
  node: HtmlNode,
  criterion: HtmlSearchCriterion,
  query: string
): boolean {
  const attributes = Object.entries(node.attributes);
  const matchesAttribute = matchesAttributeQuery(attributes, query);
  const matches = {
    text: node.searchText.toLocaleLowerCase().includes(query),
    tag: node.tag.toLocaleLowerCase().includes(query),
    id: node.id?.toLocaleLowerCase().includes(query) ?? false,
    class: node.classes.some((className) =>
      className.toLocaleLowerCase().includes(query)
    ),
    attribute: matchesAttribute,
  };

  if (criterion !== 'all') return matches[criterion];
  return (
    matches.text ||
    matches.tag ||
    matches.id ||
    matches.class ||
    matches.attribute
  );
}

function matchesAttributeQuery(
  attributes: Array<[string, string]>,
  query: string
): boolean {
  const assignment = query.match(
    /^([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(.*))$/
  );

  if (assignment) {
    const [, rawName, doubleQuotedValue, singleQuotedValue, unquotedValue] =
      assignment;
    const name = rawName.toLocaleLowerCase();
    const value = (doubleQuotedValue ?? singleQuotedValue ?? unquotedValue ?? '')
      .trim()
      .toLocaleLowerCase();

    return attributes.some(
      ([attributeName, attributeValue]) =>
        attributeName.toLocaleLowerCase() === name &&
        attributeValue.toLocaleLowerCase().includes(value)
    );
  }

  return attributes.some(
    ([name, value]) =>
      name.toLocaleLowerCase().includes(query) ||
      value.toLocaleLowerCase().includes(query)
  );
}
