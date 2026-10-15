// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockGet, mockPost, mockPatch } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPatch: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: { get: mockGet, post: mockPost, patch: mockPatch },
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
vi.mock('../components/html-inspector/ExtractionResults', () => ({
  default: () => null,
}));

import BuilderPage from './BuilderPage';

const configId = '87a37817-ad6b-417e-8333-1719ee5f93a9';
const originalConfig = {
  id: configId,
  userId: 'user-1',
  name: 'Configuración corregida',
  sourceUrl: 'https://shop.example/product',
  sourceDomain: 'shop.example',
  status: 'active' as const,
  createdAt: '2026-10-13T00:00:00.000Z',
  updatedAt: '2026-10-13T00:00:00.000Z',
  fields: [
    {
      id: 'field-1',
      label: 'Título corregido manualmente',
      selector: '.manual-title',
      attribute: null,
      type: 'text' as const,
      transform: { trim: true },
      isPrimary: true,
      orderIndex: 0,
    },
    {
      id: 'field-2',
      label: 'Precio confirmado',
      selector: '[data-price="sale"]',
      attribute: 'content',
      type: 'price' as const,
      transform: null,
      isPrimary: false,
      orderIndex: 1,
    },
  ],
};

const analysis = {
  url: originalConfig.sourceUrl,
  finalUrl: originalConfig.sourceUrl,
  html: '<html><body><h1>Automatic title</h1><h2 class="manual-title">Manually configured product name</h2><meta data-price="sale" content="55.30"></body></html>',
  statusCode: 200,
  contentType: 'text/html',
  durationMs: 1,
  method: 'cheerio' as const,
  htmlSize: 50,
  detectedFields: [
    {
      label: 'Nombre',
      selector: 'h1',
      attribute: null,
      type: 'text' as const,
      value: 'Automatic title',
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

afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(async () => root.unmount());
  }
  document.body.innerHTML = '';
  mockGet.mockReset();
  mockPost.mockReset();
  mockPatch.mockReset();
});

describe('Builder configuration editing', () => {
  it('hydrates persisted fields and updates the same config without adding analysis suggestions', async () => {
    mockGet.mockResolvedValue(originalConfig);
    mockPost.mockResolvedValue(analysis);
    mockPatch.mockResolvedValue(originalConfig);
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={[
            `/builder?configId=${configId}&url=${encodeURIComponent(originalConfig.sourceUrl)}&autorun=1`,
          ]}
        >
          <Routes>
            <Route path="/builder" element={<BuilderPage />} />
            <Route path="/configs/:id" element={<div>Configuration detail route</div>} />
          </Routes>
        </MemoryRouter>
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockGet).toHaveBeenCalledWith(`/configs/${configId}`, 'test-access-token');
    expect(mockPost).toHaveBeenCalledWith('/analyze', { url: originalConfig.sourceUrl });
    expect(container.querySelector('[aria-current="step"]')?.textContent).toContain('Revisar información');

    await act(async () => {
      [...container.querySelectorAll('button')]
        .find((button) => button.textContent?.trim() === 'Continuar')
        ?.click();
    });
    expect(container.querySelector('[aria-current="step"]')?.textContent).toContain('Configurar selectores');
    const savedFieldList = [...container.querySelectorAll('ul')].find((list) =>
      list.textContent?.includes('Título corregido manualmente')
    );
    expect(savedFieldList?.querySelectorAll('li')).toHaveLength(2);
    expect(savedFieldList?.textContent).not.toContain('h1');
    expect(
      container.querySelector<HTMLInputElement>(
        'input[aria-label="Selector CSS de Título corregido manualmente"]'
      )?.value
    ).toBe('.manual-title');
    expect(
      container.querySelector<HTMLInputElement>(
        'input[aria-label="Selector CSS de Precio confirmado"]'
      )?.value
    ).toBe('[data-price="sale"]');

    const selectorInput = container.querySelector<HTMLInputElement>(
      'input[aria-label="Selector CSS de Título corregido manualmente"]'
    );
    const setInputValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set;
    await act(async () => {
      setInputValue?.call(selectorInput, 'h2.manual-title');
      selectorInput?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(selectorInput?.value).toBe('h2.manual-title');

    await act(async () => {
      [...container.querySelectorAll('button')]
        .find((button) => button.textContent?.includes('Probar selectores'))
        ?.click();
    });
    expect(mockPost).toHaveBeenCalledTimes(1);

    await act(async () => {
      [...container.querySelectorAll('button')]
        .find((button) => button.textContent?.includes('Continuar a confirmar'))
        ?.click();
    });
    expect(container.querySelector('[aria-current="step"]')?.textContent).toContain('Confirmar y guardar');

    const productNameInput = [...container.querySelectorAll<HTMLInputElement>('input')]
      .find((input) => input.getAttribute('maxlength') === '500');
    const productPriceInput = [...container.querySelectorAll<HTMLInputElement>('input[type="number"]')][0];
    expect(productNameInput?.value).toBe('Manually configured product name');
    expect(productPriceInput?.value).toBe('55.3');
    expect(mockPost).toHaveBeenCalledTimes(1);

    await act(async () => {
      setInputValue?.call(productNameInput, 'Manual correction kept between steps');
      productNameInput?.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      [...container.querySelectorAll('button')]
        .find((button) => button.textContent?.trim() === 'Anterior')
        ?.click();
    });
    expect(
      container.querySelector<HTMLInputElement>(
        'input[aria-label="Selector CSS de Título corregido manualmente"]'
      )?.value
    ).toBe('h2.manual-title');
    await act(async () => {
      [...container.querySelectorAll('button')]
        .find((button) => button.textContent?.includes('Continuar a confirmar'))
        ?.click();
    });
    expect(productNameInput?.value).toBe('Manual correction kept between steps');

    await act(async () => {
      [...container.querySelectorAll('button')]
        .find((button) => button.textContent?.includes('Probar selectores'))
        ?.click();
    });
    expect(productNameInput?.value).toBe('Manual correction kept between steps');
    expect(productPriceInput?.value).toBe('55.3');
    expect(mockPost).toHaveBeenCalledTimes(1);

    await act(async () => {
      [...container.querySelectorAll('button')]
        .find((button) => button.textContent?.trim() === 'Anterior')
        ?.click();
    });
    await act(async () => {
      [...container.querySelectorAll('button')]
        .find((button) => button.textContent?.includes('Guardar configuración'))
        ?.click();
    });
    const nameInput = container.querySelector<HTMLInputElement>('#config-name');
    expect(nameInput?.value).toBe(originalConfig.name);

    await act(async () => {
      [...container.querySelectorAll('button')]
        .find((button) => button.textContent?.includes('Actualizar'))
        ?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockPatch).toHaveBeenCalledWith(
      `/configs/${configId}`,
      {
        name: originalConfig.name,
        sourceUrl: originalConfig.sourceUrl,
        fields: [
          {
            label: originalConfig.fields[0].label,
            selector: 'h2.manual-title',
            attribute: undefined,
            type: 'text',
            transform: { trim: true },
            isPrimary: true,
            orderIndex: 0,
          },
          {
            label: originalConfig.fields[1].label,
            selector: originalConfig.fields[1].selector,
            attribute: 'content',
            type: 'price',
            transform: null,
            isPrimary: false,
            orderIndex: 1,
          },
        ],
      },
      'test-access-token'
    );
  });
});
