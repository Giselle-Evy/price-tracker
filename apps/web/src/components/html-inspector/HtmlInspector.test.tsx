// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import HtmlInspector from './HtmlInspector';

const renderedRoots: Root[] = [];
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
  configurable: true,
  value: true,
});

afterEach(async () => {
  for (const root of renderedRoots.splice(0)) {
    await act(async () => root.unmount());
  }
  document.body.innerHTML = '';
});

describe('HtmlInspector search navigation', () => {
  it('selects, highlights and reveals results with the keyboard and buttons', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    renderedRoots.push(root);

    await act(async () => {
      root.render(
        <HtmlInspector
          html="<main><div><section><div><h1>Deep product title</h1><p>Another product title</p></div></section></div></main>"
          onAddField={() => undefined}
        />
      );
    });

    const input = container.querySelector<HTMLInputElement>('input[type="search"]');
    if (!input) throw new Error('Search input was not rendered');

    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )?.set;
      setter?.call(input, 'product title');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(container.textContent).toContain('0 de 2');
    const nextButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Resultado siguiente"]'
    );
    if (!nextButton) throw new Error('Next-result button was not rendered');
    await act(async () => nextButton.click());

    expect(container.textContent).toContain('1 de 2');
    expect(container.querySelector('.ring-amber-400')).not.toBeNull();
    expect(container.textContent).toContain('Selector CSS');
    expect(container.textContent).toContain('Deep product title');

    await act(async () => {
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          bubbles: true,
          key: 'Enter',
          shiftKey: true,
        })
      );
    });
    expect(container.textContent).toContain('2 de 2');
    expect(container.querySelector('.ring-amber-400')?.textContent)
      .toContain('Another product title');
  });

  it('clears the query, result and selected details when the HTML changes', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    renderedRoots.push(root);

    await act(async () => {
      root.render(
        <HtmlInspector html="<h1>Old product</h1>" onAddField={() => undefined} />
      );
    });

    const input = container.querySelector<HTMLInputElement>('input[type="search"]');
    if (!input) throw new Error('Search input was not rendered');
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value'
      )?.set;
      setter?.call(input, 'Old product');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      root.render(
        <HtmlInspector html="<h1>New product</h1>" onAddField={() => undefined} />
      );
    });

    expect(container.querySelector<HTMLInputElement>('input[type="search"]')?.value)
      .toBe('');
    expect(container.textContent).toContain('Escribe para buscar');
    expect(container.textContent).toContain(
      'Selecciona un elemento del árbol para ver sus detalles.'
    );
  });
});
