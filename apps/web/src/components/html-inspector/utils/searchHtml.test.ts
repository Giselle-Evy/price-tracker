// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { parseHtml, type HtmlNode } from './parseHtml';
import {
  getHtmlNodeAncestors,
  getNextSearchIndex,
  searchHtmlNodes,
} from './searchHtml';

function createFixture(): HtmlNode {
  const root = parseHtml(`
    <!doctype html>
    <html>
      <head><meta itemprop="price" content="49.99"></head>
      <body>
        <main>
          <h1 id="product-title" class="product-title">Wireless headphones</h1>
          <span class="product-price" data-price="49.99" itemprop="price">$49.99</span>
          <div class="product-gallery">
            <img src="/headphones.jpg" alt="Headphones front view">
          </div>
        </main>
      </body>
    </html>
  `);
  if (!root) throw new Error('Controlled HTML fixture failed to parse');
  return root;
}

function findNode(
  root: HtmlNode,
  predicate: (node: HtmlNode) => boolean
): HtmlNode {
  const pending = [root];
  while (pending.length > 0) {
    const node = pending.pop()!;
    if (predicate(node)) return node;
    pending.push(...node.children);
  }
  throw new Error('Expected node was not present in the controlled HTML');
}

describe('searchHtmlNodes', () => {
  it('finds visible text case-insensitively', () => {
    const results = searchHtmlNodes(createFixture(), 'text', 'WIRELESS');
    expect(results.map((node) => node.tag)).toEqual(['h1']);
  });

  it('finds HTML tags including metadata tags', () => {
    const results = searchHtmlNodes(createFixture(), 'tag', 'meta');
    expect(results.map((node) => node.tag)).toEqual(['meta']);
  });

  it('finds IDs and classes', () => {
    const root = createFixture();
    expect(searchHtmlNodes(root, 'id', 'product-title').map((n) => n.tag))
      .toEqual(['h1']);
    expect(searchHtmlNodes(root, 'class', 'product-price').map((n) => n.tag))
      .toEqual(['span']);
  });

  it('finds attribute names and name/value expressions', () => {
    const root = createFixture();
    expect(searchHtmlNodes(root, 'attribute', 'data-price').map((n) => n.tag))
      .toEqual(['span']);
    expect(
      searchHtmlNodes(root, 'attribute', 'itemprop="price"').map((n) => n.tag)
    ).toEqual(['meta', 'span']);
  });

  it('returns no results for empty queries or missing matches', () => {
    const root = createFixture();
    expect(searchHtmlNodes(root, 'all', '   ')).toEqual([]);
    expect(searchHtmlNodes(root, 'all', 'not-present')).toEqual([]);
  });

  it('matches a general query across text and DOM metadata', () => {
    const root = createFixture();
    const actual = searchHtmlNodes(root, 'all', 'product-price');
    expect(actual.map((node) => node.tag)).toEqual(['span']);
  });

  it('finds a full direct text value beyond the preview limit', () => {
    const text = `${'x'.repeat(120)}needle`;
    const root = parseHtml(`<p>${text}</p>`);
    if (!root) throw new Error('Controlled HTML fixture failed to parse');
    expect(searchHtmlNodes(root, 'text', 'needle').map((node) => node.tag))
      .toEqual(['p']);
  });

  it('navigates results in both directions and wraps around', () => {
    expect(getNextSearchIndex(-1, 3, 'next')).toBe(0);
    expect(getNextSearchIndex(-1, 3, 'previous')).toBe(2);
    expect(getNextSearchIndex(0, 3, 'previous')).toBe(2);
    expect(getNextSearchIndex(2, 3, 'next')).toBe(0);
    expect(getNextSearchIndex(0, 0, 'next')).toBe(-1);
  });

  it('returns the matching node and the ancestor path needed to expand the tree', () => {
    const root = createFixture();
    const match = searchHtmlNodes(root, 'id', 'product-title')[0];

    expect(match.tag).toBe('h1');
    expect(getHtmlNodeAncestors(root, match.nodeId)).toEqual([
      root.nodeId,
      findNode(root, (node) => node.tag === 'body').nodeId,
      findNode(root, (node) => node.tag === 'main').nodeId,
    ]);
  });

  it('uses the latest parsed tree after the inspected HTML changes', () => {
    const oldTree = parseHtml('<h1>Old product</h1>');
    const newTree = parseHtml('<h1>New product</h1>');
    if (!oldTree || !newTree) throw new Error('Controlled HTML fixture failed to parse');

    expect(searchHtmlNodes(oldTree, 'text', 'old').map((n) => n.tag))
      .toEqual(['h1']);
    expect(searchHtmlNodes(newTree, 'text', 'new').map((n) => n.tag))
      .toEqual(['h1']);
  });

  it('finds the expected node using the general search', () => {
    const root = createFixture();
    expect(searchHtmlNodes(root, 'all', 'wireless').map((n) => n.tag))
      .toEqual(['h1']);
  });
});
