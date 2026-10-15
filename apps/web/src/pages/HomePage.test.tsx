// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));
vi.mock('../lib/api', () => ({ api: { get: mockGet } }));

import HomePage from './HomePage';

const roots: Root[] = [];
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
  configurable: true,
  value: true,
});

afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(async () => root.unmount());
  }
  document.body.innerHTML = '';
  mockGet.mockReset();
});

describe('community offers', () => {
  it('loads real community offers with detail and safe store links', async () => {
    mockGet.mockResolvedValue({
      offers: [{
        id: 'published-offer-id',
        title: 'Teclado mecánico',
        originalUrl: 'https://shop.example/keyboard',
        publishedAt: '2026-10-13T18:00:00.000Z',
        imageUrl: 'https://cdn.example/keyboard.jpg',
        description: 'Oferta publicada',
        price: 85,
        previousPrice: 110,
        currency: 'MXN',
      }],
      pagination: { page: 1, totalPages: 1 },
    });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(<MemoryRouter><HomePage /></MemoryRouter>);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockGet).toHaveBeenCalledWith('/offers?page=1&limit=20');
    expect(container.textContent).toContain('Teclado mecánico');
    expect(container.textContent).toContain('Oferta publicada');
    expect(container.querySelector('a[href="/offers/published-offer-id"]')?.textContent)
      .toContain('Ver detalle');
    expect(container.querySelector('a[href="https://shop.example/keyboard"]')?.getAttribute('rel'))
      .toBe('noopener noreferrer');
  });

  it('shows an empty state rather than fabricated offers', async () => {
    mockGet.mockResolvedValue({
      offers: [],
      pagination: { page: 1, totalPages: 0 },
    });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(<MemoryRouter><HomePage /></MemoryRouter>);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain('Aún no hay ofertas publicadas');
    expect(container.textContent).not.toContain('Producto de ejemplo');
  });
});
