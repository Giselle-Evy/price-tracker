// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockGet, mockPost, mockPut } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: { get: mockGet, post: mockPost, put: mockPut },
}));
vi.mock('../stores/authStore', () => ({
  useAuthStore: (selector: (state: { accessToken: string }) => unknown) =>
    selector({ accessToken: 'test-access-token' }),
}));
vi.mock('../components/html-inspector/HtmlInspector', () => ({
  default: () => <div>HTML inspector</div>,
}));
vi.mock('../components/html-inspector/AddFieldModal', () => ({
  default: () => null,
}));

import BuilderPage from './BuilderPage';

const productUrl = 'https://shop.example/product/new-item';
const configOne = {
  id: 'config-one',
  userId: 'user-1',
  name: 'Plantilla principal',
  sourceUrl: 'https://shop.example/product/old-item',
  sourceDomain: 'shop.example',
  status: 'active' as const,
  createdAt: '2026-10-12T00:00:00.000Z',
  updatedAt: '2026-10-12T00:00:00.000Z',
  fields: [
    {
      id: 'field-one',
      label: 'Nombre',
      selector: '.product-name',
      attribute: null,
      type: 'text' as const,
      transform: { trim: true },
      isPrimary: true,
      orderIndex: 0,
    },
    {
      id: 'field-two',
      label: 'Precio',
      selector: '[data-price="current"]',
      attribute: 'content',
      type: 'price' as const,
      transform: null,
      isPrimary: false,
      orderIndex: 1,
    },
  ],
};
const configTwo = {
  ...configOne,
  id: 'config-two',
  name: 'Plantilla alternativa',
  sourceDomain: 'SHOP.EXAMPLE.',
  updatedAt: '2026-10-13T00:00:00.000Z',
  fields: [
    {
      ...configOne.fields[0],
      id: 'field-three',
      selector: '.different-name',
      transform: null,
    },
  ],
};
const analysis = {
  url: productUrl,
  finalUrl: productUrl,
  html: '<html><body><h1 class="product-name">Producto de prueba</h1><meta data-price="current" content="19.99"></body></html>',
  statusCode: 200,
  contentType: 'text/html',
  durationMs: 1,
  method: 'cheerio' as const,
  htmlSize: 100,
  detectedFields: [
    {
      label: 'Nombre',
      selector: '.product-name',
      attribute: null,
      type: 'text' as const,
      value: 'Producto de prueba',
    },
  ],
  productImages: [],
  imageGalleryStatus: 'not_found' as const,
  expectedImageCount: null,
  rejectedImageCount: 0,
};

const roots: Root[] = [];
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
  configurable: true,
  value: true,
});

async function renderBuilder(url = productUrl) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);

  await act(async () => {
    root.render(
      <MemoryRouter
        initialEntries={[`/builder?url=${encodeURIComponent(url)}`]}
      >
        <Routes>
          <Route path="/builder" element={<BuilderPage />} />
          <Route path="/products/:id" element={<div>Producto guardado</div>} />
        </Routes>
      </MemoryRouter>
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
  });

  return container;
}

afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(async () => root.unmount());
  }
  document.body.innerHTML = '';
  mockGet.mockReset();
  mockPost.mockReset();
  mockPut.mockReset();
  vi.restoreAllMocks();
});

describe('Builder saved configuration suggestions', () => {
  it('shows exact-host matches, allows choosing between them and tests saved selectors on the current URL', async () => {
    mockGet.mockResolvedValue({ configs: [configOne, configTwo] });
    mockPost.mockImplementation((endpoint: string) =>
      endpoint === '/analyze' ? analysis : { id: 'saved-product' }
    );
    const container = await renderBuilder();

    expect(mockGet).toHaveBeenCalledWith('/configs', 'test-access-token');
    expect(container.textContent).toContain('Configuraciones guardadas para este dominio');
    expect(container.textContent).toContain('Plantilla principal');
    expect(container.textContent).toContain('Plantilla alternativa');
    expect(container.textContent).toContain('2 campos');

    await act(async () => {
      [...container.querySelectorAll('button')]
        .find((button) =>
          button.closest('li')?.textContent?.includes('Plantilla principal') &&
          button.textContent?.includes('Usar configuración')
        )
        ?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockPost).toHaveBeenCalledWith('/analyze', { url: productUrl });
    expect(container.querySelector('[aria-current="step"]')?.textContent)
      .toContain('Configurar selectores');
    expect(container.textContent).toContain('Usando «Plantilla principal» como plantilla');
    expect(
      container.querySelector<HTMLInputElement>(
        'input[aria-label="Selector CSS de Nombre"]'
      )?.value
    ).toBe('.product-name');
    expect(container.textContent).toContain('19.99');
    expect(mockPost).toHaveBeenCalledTimes(1);

    await act(async () => {
      [...container.querySelectorAll('button')]
        .find((button) => button.textContent?.includes('Continuar a confirmar'))
        ?.click();
    });
    expect(container.querySelector<HTMLInputElement>('input[maxlength="500"]')?.value)
      .toBe('Producto de prueba');
    expect(mockPost).toHaveBeenCalledTimes(1);

    await act(async () => {
      container.querySelectorAll<HTMLFormElement>('form')[1]
        ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(mockPost).toHaveBeenCalledWith(
      '/products',
      expect.objectContaining({ name: 'Producto de prueba', url: productUrl }),
      'test-access-token'
    );
    expect(mockPost.mock.calls.some(([endpoint]) => endpoint === '/configs')).toBe(false);
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('marks unmatched selectors for review without saving a product automatically', async () => {
    mockGet.mockResolvedValue({ configs: [configTwo] });
    mockPost.mockResolvedValue(analysis);
    const container = await renderBuilder();

    await act(async () => {
      [...container.querySelectorAll('button')]
        .find((button) =>
          button.closest('li')?.textContent?.includes('Plantilla alternativa') &&
          button.textContent?.includes('Usar configuración')
        )
        ?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.querySelector<HTMLInputElement>(
      'input[aria-label="Selector CSS de Nombre"]'
    )?.value).toBe('.different-name');
    expect(container.textContent).toContain('No se encontró ningún elemento con este selector');
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost.mock.calls.some(([endpoint]) => endpoint === '/products')).toBe(false);
    expect(mockPost.mock.calls.some(([endpoint]) => endpoint === '/configs')).toBe(false);
  });

  it('keeps the manual flow when there are no domain-boundary matches', async () => {
    mockGet.mockResolvedValue({
      configs: [
        { ...configOne, sourceDomain: 'amazon.com.mx.attacker.example' },
        { ...configTwo, sourceDomain: 'evilamazon.com.mx' },
      ],
    });
    mockPost.mockResolvedValue(analysis);
    const container = await renderBuilder('https://amazon.com.mx/product');

    expect(container.textContent).not.toContain('Configuraciones guardadas para este dominio');
    expect(container.textContent).not.toContain('Plantilla principal');
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled)
      .toBe(false);

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(mockPost).toHaveBeenCalledWith('/analyze', {
      url: 'https://amazon.com.mx/product',
    });
  });

  it('accepts a proper subdomain boundary without accepting lookalike suffixes', async () => {
    mockGet.mockResolvedValue({ configs: [configOne] });
    const container = await renderBuilder('https://www.shop.example/product');

    expect(container.textContent).toContain('Plantilla principal');
    expect(container.textContent).toContain('shop.example · 2 campos');
  });

  it('keeps selector edits when the user declines replacing them with another suggestion', async () => {
    mockGet.mockResolvedValue({ configs: [configOne, configTwo] });
    mockPost.mockResolvedValue(analysis);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const container = await renderBuilder();

    await act(async () => {
      [...container.querySelectorAll('button')]
        .find((button) =>
          button.closest('li')?.textContent?.includes('Plantilla principal') &&
          button.textContent?.includes('Usar configuración')
        )
        ?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const selectorInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Selector CSS de Nombre"]'
    );
    expect(selectorInput).not.toBeNull();

    const setInputValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set;
    await act(async () => {
      setInputValue?.call(selectorInput, '.manually-corrected');
      selectorInput?.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      [...container.querySelectorAll('button')]
        .find((button) => button.textContent?.trim() === 'Anterior')
        ?.click();
    });
    await act(async () => {
      [...container.querySelectorAll('button')]
        .find((button) => button.textContent?.trim() === 'Anterior')
        ?.click();
    });
    await act(async () => {
      [...container.querySelectorAll('button')]
        .find((button) =>
          button.closest('li')?.textContent?.includes('Plantilla alternativa') &&
          button.textContent?.includes('Usar configuración')
        )
        ?.click();
    });

    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(selectorInput?.value).toBe('.manually-corrected');
    expect(mockPost).toHaveBeenCalledTimes(1);
  });
});
