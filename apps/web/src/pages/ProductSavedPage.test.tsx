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

import BuilderPage from './BuilderPage';
import ProductSavedPage from './ProductSavedPage';
import type { BuilderDraftState, SavedProduct } from '../components/products/productTypes';

const roots: Root[] = [];
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
  configurable: true,
  value: true,
});

const builderDraft: BuilderDraftState = {
  fields: [
    {
      id: 'old-price-field',
      label: 'Precio anterior',
      selector: '.old-price',
      type: 'price',
    },
  ],
};

const savedProduct: SavedProduct = {
  id: '87a37817-ad6b-417e-8333-1719ee5f93a9',
  name: 'Producto persistido',
  imageUrl: 'https://cdn.example/main.jpg',
  images: [{ url: 'https://cdn.example/main.jpg', alt: 'Principal' }],
  description: 'Descripción desde la API',
  currentPrice: 89.5,
  previousPrice: 110,
  canonicalUrl: 'https://shop.example/product',
  originalUrl: 'https://shop.example/product',
  domain: 'shop.example',
  currency: 'MXN',
  createdAt: '2026-10-13T00:00:00.000Z',
  updatedAt: '2026-10-13T00:00:00.000Z',
};

const savedConfig = {
  id: 'config-id',
  name: 'Configuración de tienda',
  sourceUrl: 'https://shop.example/template',
  fields: [{ id: 'price-field' }],
};

const savedMonitor = {
  id: 'monitor-id',
  productId: savedProduct.id,
  configId: savedConfig.id,
  extractionMode: 'manual' as const,
  name: savedProduct.name,
  frequencyMin: 'm15' as const,
  status: 'active' as const,
};

const alternateConfig = {
  id: 'alternate-config-id',
  name: 'Configuración alternativa',
  sourceUrl: 'https://www.shop.example/product',
  fields: [{ id: 'alternate-price-field' }],
};

const alternateMonitor = {
  ...savedMonitor,
  id: 'alternate-monitor-id',
  configId: alternateConfig.id,
  frequencyMin: 'm5' as const,
};

const analyzeResponse = {
  url: savedProduct.originalUrl,
  finalUrl: savedProduct.originalUrl,
  html: '<html><body><h1 class="product-name">Producto</h1><span class="old-price">$110.00</span></body></html>',
  statusCode: 200,
  contentType: 'text/html',
  durationMs: 1,
  method: 'cheerio',
  htmlSize: 100,
  detectedFields: [
    {
      label: 'Nombre',
      selector: '.product-name',
      attribute: null,
      type: 'text' as const,
      value: 'Producto',
    },
    {
      label: 'Precio anterior',
      selector: '.old-price',
      attribute: null,
      type: 'price' as const,
      value: '$110.00',
    },
  ],
  productImages: savedProduct.images,
  imageGalleryStatus: 'found' as const,
  expectedImageCount: 1,
  rejectedImageCount: 0,
};

afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(async () => root.unmount());
  }
  document.body.innerHTML = '';
  mockGet.mockReset();
  mockPost.mockReset();
  mockPatch.mockReset();
  localStorage.clear();
  sessionStorage.clear();
});

describe('ProductSavedPage', () => {
  it('recovers the saved product and returns to its builder draft without routing to monitors', async () => {
    mockGet.mockImplementation((endpoint: string) => {
      if (endpoint.startsWith('/products/')) return Promise.resolve(savedProduct);
      if (endpoint === '/configs') return Promise.resolve({ configs: [savedConfig] });
      if (endpoint === '/monitors') return Promise.resolve({ monitors: [] });
      throw new Error(`Unexpected GET ${endpoint}`);
    });
    mockPost.mockResolvedValue(analyzeResponse);
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(
        <MemoryRouter
          initialEntries={[
            {
              pathname: `/products/${savedProduct.id}`,
              state: { builderDraft },
            },
          ]}
        >
          <Routes>
            <Route path="/products/:id" element={<ProductSavedPage />} />
            <Route path="/builder" element={<BuilderPage />} />
          </Routes>
        </MemoryRouter>
      );
    });

    expect(mockGet).toHaveBeenCalledWith(
      `/products/${savedProduct.id}`,
      'test-access-token'
    );
    expect(container.textContent).toContain('Producto guardado correctamente');
    expect(container.textContent).toContain('89.5 MXN');
    expect(container.textContent).toContain('110 MXN');
    expect(container.textContent).toContain('Descripción desde la API');
    expect(mockGet).toHaveBeenCalledWith('/configs', 'test-access-token');
    expect(mockGet).toHaveBeenCalledWith('/monitors', 'test-access-token');
    expect(container.querySelector('a[href="/monitors"]')).toBeNull();
    expect(container.textContent).toContain('Configurar seguimiento de precios');
    expect(container.textContent).toContain('Publicar oferta');
    expect(container.textContent).toContain('Configurar seguimiento de precios');
    expect(container.textContent).not.toContain('Pendiente de implementación');
    expect(container.querySelector('input[aria-label="Nombre de la oferta"]')).toBeNull();
    expect(container.querySelector('textarea[aria-label="Descripción de la oferta"]')).toBeNull();
    expect(container.textContent).not.toContain('Ver producto guardado');
    expect(container.querySelector(`a[href="/products/${savedProduct.id}"]`)).toBeNull();
    expect(container.querySelector(`a[href^="/builder?productId=${savedProduct.id}"]`)?.textContent)
      .toContain('Volver al constructor');

    await act(async () => {
      container.querySelector<HTMLAnchorElement>(`a[href^="/builder?productId=${savedProduct.id}"]`)?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockGet).toHaveBeenCalledWith(
      `/products/${savedProduct.id}`,
      'test-access-token'
    );
    expect(mockPost).toHaveBeenCalledWith(
      '/analyze',
      { url: savedProduct.originalUrl }
    );
    expect(container.textContent).toContain('.old-price');
    const prices = [...container.querySelectorAll<HTMLInputElement>('input[type="number"]')];
    expect(prices.map((input) => input.value)).toEqual(['89.5', '110']);
    expect(
      container.querySelector<HTMLInputElement>('input[aria-label="Incluir imagen 1"]')?.checked
    ).toBe(true);
  });

  it.each([
    ['m5', 'Cada 5 minutos'],
    ['m15', 'Cada 15 minutos'],
    ['m30', 'Cada 30 minutos'],
  ] as const)('creates a monitor with the selected %s frequency', async (frequencyMin, label) => {
    mockGet.mockImplementation((endpoint: string) => {
      if (endpoint.startsWith('/products/')) return Promise.resolve(savedProduct);
      if (endpoint === '/configs') return Promise.resolve({ configs: [savedConfig] });
      if (endpoint === '/monitors') return Promise.resolve({ monitors: [] });
      throw new Error(`Unexpected GET ${endpoint}`);
    });
    mockPost.mockResolvedValue({ ...savedMonitor, frequencyMin });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[`/products/${savedProduct.id}`]}>
          <Routes>
            <Route path="/products/:id" element={<ProductSavedPage />} />
          </Routes>
        </MemoryRouter>
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const frequencySelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Frecuencia de revisión"]'
    );
    if (!frequencySelect) throw new Error('Frequency selector was not rendered');
    expect(
      [...frequencySelect.options]
        .map((option) => option.value)
        .filter(Boolean)
    ).toEqual(['m5', 'm15', 'm30']);
    expect([...frequencySelect.options].map((option) => option.textContent)).toContain(label);

    await act(async () => {
      frequencySelect.value = frequencyMin;
      frequencySelect.dispatchEvent(new Event('change', { bubbles: true }));
      container.querySelector<HTMLButtonElement>('button:not([disabled])')?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/monitors',
      {
        productId: savedProduct.id,
        configId: savedConfig.id,
        name: savedProduct.name,
        frequencyMin,
      },
      'test-access-token'
    );
    expect(container.textContent).toContain('El seguimiento de precios quedó configurado.');
    expect(container.textContent).toContain('El seguimiento de precios está activo.');
    expect(mockPost.mock.calls.some(([endpoint]) => endpoint === '/configs')).toBe(false);
  });

  it('creates an automatic monitor without requiring a saved configuration', async () => {
    mockGet.mockImplementation((endpoint: string) => {
      if (endpoint.startsWith('/products/')) return Promise.resolve(savedProduct);
      if (endpoint === '/configs') {
        return Promise.resolve({
          configs: [
            { ...savedConfig, sourceUrl: 'https://shop.example.attacker.test' },
            { ...savedConfig, id: 'empty-config', fields: [] },
          ],
        });
      }
      if (endpoint === '/monitors') return Promise.resolve({ monitors: [] });
      throw new Error(`Unexpected GET ${endpoint}`);
    });
    const automaticMonitor = {
      ...savedMonitor,
      configId: null,
      extractionMode: 'automatic' as const,
      frequencyMin: 'm5' as const,
    };
    mockPost.mockResolvedValue(automaticMonitor);
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[`/products/${savedProduct.id}`]}>
          <Routes>
            <Route path="/products/:id" element={<ProductSavedPage />} />
          </Routes>
        </MemoryRouter>
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain('Se intentará detectar el precio automáticamente');
    expect(container.querySelector('a[href^="/builder?productId="]')).not.toBeNull();
    expect(container.textContent).toContain('El seguimiento de precios aún no está activo.');
    const frequencySelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Frecuencia de revisión"]'
    );
    if (!frequencySelect) throw new Error('Frequency selector was not rendered');
    const startButton = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('Iniciar seguimiento automático'));
    if (!startButton) throw new Error('Automatic tracking button was not rendered');
    await act(async () => {
      frequencySelect.value = 'm5';
      frequencySelect.dispatchEvent(new Event('change', { bubbles: true }));
      startButton.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/monitors',
      {
        productId: savedProduct.id,
        name: savedProduct.name,
        frequencyMin: 'm5',
      },
      'test-access-token'
    );
    expect(container.textContent).toContain('El seguimiento de precios quedó configurado.');
    expect(container.textContent).toContain('El seguimiento de precios está activo.');
    expect(localStorage.length).toBe(0);
    expect(mockPost.mock.calls.some(([endpoint]) => endpoint === '/configs')).toBe(false);
  });

  it('restores automatic monitor frequency and active state from the backend response', async () => {
    mockGet.mockImplementation((endpoint: string) => {
      if (endpoint.startsWith('/products/')) return Promise.resolve(savedProduct);
      if (endpoint === '/configs') return Promise.resolve({ configs: [] });
      if (endpoint === '/monitors') {
        return Promise.resolve({
          monitors: [
            {
              ...savedMonitor,
              configId: null,
              extractionMode: 'automatic',
              frequencyMin: 'm5',
            },
          ],
        });
      }
      throw new Error(`Unexpected GET ${endpoint}`);
    });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[`/products/${savedProduct.id}`]}>
          <Routes>
            <Route path="/products/:id" element={<ProductSavedPage />} />
          </Routes>
        </MemoryRouter>
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain('El seguimiento de precios está activo.');
    expect(
      container.querySelector<HTMLSelectElement>('select[aria-label="Frecuencia de revisión"]')
        ?.value
    ).toBe('m5');
    expect(localStorage.length).toBe(0);
  });

  it('shows monitor update failures without claiming the selected frequency was saved', async () => {
    const automaticMonitor = {
      ...savedMonitor,
      configId: null,
      extractionMode: 'automatic' as const,
    };
    mockGet.mockImplementation((endpoint: string) => {
      if (endpoint.startsWith('/products/')) return Promise.resolve(savedProduct);
      if (endpoint === '/configs') return Promise.resolve({ configs: [] });
      if (endpoint === '/monitors') {
        return Promise.resolve({ monitors: [automaticMonitor] });
      }
      throw new Error(`Unexpected GET ${endpoint}`);
    });
    mockPatch.mockRejectedValue({
      error: 'No se pudo actualizar el seguimiento',
      status: 503,
    });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[`/products/${savedProduct.id}`]}>
          <Routes>
            <Route path="/products/:id" element={<ProductSavedPage />} />
          </Routes>
        </MemoryRouter>
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const frequencySelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Frecuencia de revisión"]'
    );
    if (!frequencySelect) throw new Error('Frequency selector was not rendered');

    await act(async () => {
      frequencySelect.value = 'm30';
      frequencySelect.dispatchEvent(new Event('change', { bubbles: true }));
      [...container.querySelectorAll<HTMLButtonElement>('button')]
        .find((button) => button.textContent?.includes('Guardar frecuencia'))
        ?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockPatch).toHaveBeenCalledWith(
      `/monitors/${automaticMonitor.id}`,
      { frequencyMin: 'm30' },
      'test-access-token'
    );
    expect(container.querySelector('[role="alert"]')?.textContent)
      .toContain('No se pudo actualizar el seguimiento');
    expect(container.textContent).not.toContain('Se actualizó la frecuencia del seguimiento.');
    expect(container.textContent).toContain('El seguimiento de precios está activo.');
  });

  it('updates an existing product/config monitor instead of creating a duplicate', async () => {
    mockGet.mockImplementation((endpoint: string) => {
      if (endpoint.startsWith('/products/')) return Promise.resolve(savedProduct);
      if (endpoint === '/configs') return Promise.resolve({ configs: [savedConfig] });
      if (endpoint === '/monitors') return Promise.resolve({ monitors: [savedMonitor] });
      throw new Error(`Unexpected GET ${endpoint}`);
    });
    mockPatch.mockResolvedValue({ ...savedMonitor, frequencyMin: 'm30' });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[`/products/${savedProduct.id}`]}>
          <Routes>
            <Route path="/products/:id" element={<ProductSavedPage />} />
          </Routes>
        </MemoryRouter>
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const frequencySelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Frecuencia de revisión"]'
    );
    if (!frequencySelect) throw new Error('Frequency selector was not rendered');
    await act(async () => {
      frequencySelect.value = 'm30';
      frequencySelect.dispatchEvent(new Event('change', { bubbles: true }));
      container.querySelector<HTMLButtonElement>('button:not([disabled])')?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockPatch).toHaveBeenCalledWith(
      `/monitors/${savedMonitor.id}`,
      { frequencyMin: 'm30' },
      'test-access-token'
    );
    expect(mockPost.mock.calls.some(([endpoint]) => endpoint === '/monitors')).toBe(false);
    expect(container.textContent).toContain('Se actualizó la frecuencia del seguimiento.');
  });

  it('reuses the unambiguous config associated with an existing product monitor', async () => {
    mockGet.mockImplementation((endpoint: string) => {
      if (endpoint.startsWith('/products/')) return Promise.resolve(savedProduct);
      if (endpoint === '/configs') {
        return Promise.resolve({ configs: [savedConfig, alternateConfig] });
      }
      if (endpoint === '/monitors') {
        return Promise.resolve({ monitors: [alternateMonitor] });
      }
      throw new Error(`Unexpected GET ${endpoint}`);
    });
    mockPatch.mockResolvedValue({ ...alternateMonitor, frequencyMin: 'm30' });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[`/products/${savedProduct.id}`]}>
          <Routes>
            <Route path="/products/:id" element={<ProductSavedPage />} />
          </Routes>
        </MemoryRouter>
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const configSelect = container.querySelector<HTMLSelectElement>(
      'select:not([aria-label="Frecuencia de revisión"])'
    );
    expect(configSelect).toBeNull();
    const frequencySelect = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Frecuencia de revisión"]'
    );
    if (!frequencySelect) throw new Error('Frequency selector was not rendered');

    await act(async () => {
      frequencySelect.value = 'm30';
      frequencySelect.dispatchEvent(new Event('change', { bubbles: true }));
      [...container.querySelectorAll<HTMLButtonElement>('button')]
        .find((button) => button.textContent?.includes('Guardar frecuencia'))
        ?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockPatch).toHaveBeenCalledWith(
      `/monitors/${alternateMonitor.id}`,
      { frequencyMin: 'm30' },
      'test-access-token'
    );
    expect(mockPost.mock.calls.some(([endpoint]) => endpoint === '/monitors')).toBe(false);
  });

  it('shows backend errors and prevents duplicate monitor submissions', async () => {
    let rejectPost: ((reason: { error: string; status: number }) => void) | undefined;
    mockGet.mockImplementation((endpoint: string) => {
      if (endpoint.startsWith('/products/')) return Promise.resolve(savedProduct);
      if (endpoint === '/configs') return Promise.resolve({ configs: [savedConfig] });
      if (endpoint === '/monitors') return Promise.resolve({ monitors: [] });
      throw new Error(`Unexpected GET ${endpoint}`);
    });
    mockPost.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectPost = reject;
        })
    );
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[`/products/${savedProduct.id}`]}>
          <Routes>
            <Route path="/products/:id" element={<ProductSavedPage />} />
          </Routes>
        </MemoryRouter>
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const submitButton = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('Iniciar seguimiento'));
    if (!submitButton) throw new Error('Monitor submit button was not rendered');
    await act(async () => {
      submitButton.click();
      submitButton.click();
    });
    expect(mockPost).toHaveBeenCalledTimes(1);

    await act(async () => {
      rejectPost?.({ error: 'Ya existe un seguimiento', status: 409 });
    });
    expect(container.querySelector('[role="alert"]')?.textContent)
      .toContain('Ya existe un seguimiento');
    expect(container.textContent).not.toContain('El seguimiento de precios quedó configurado.');
  });

  it('opens publication from the saved product and navigates to the published offer detail', async () => {
    mockGet.mockImplementation((endpoint: string) => {
      if (endpoint.startsWith('/products/')) return Promise.resolve(savedProduct);
      if (endpoint === '/configs') return Promise.resolve({ configs: [savedConfig] });
      if (endpoint === '/monitors') return Promise.resolve({ monitors: [] });
      throw new Error(`Unexpected GET ${endpoint}`);
    });
    mockPost.mockImplementation((endpoint: string) => {
      if (endpoint === '/offers') return Promise.resolve({ id: 'published-offer-id' });
      return Promise.resolve(analyzeResponse);
    });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[`/products/${savedProduct.id}`]}>
          <Routes>
            <Route path="/products/:id" element={<ProductSavedPage />} />
            <Route path="/offers/:id" element={<div>Oferta publicada</div>} />
          </Routes>
        </MemoryRouter>
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const publishButton = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('Publicar oferta'));
    if (!publishButton) throw new Error('Offer publication button was not rendered');
    expect(container.querySelector('input[aria-label="Nombre de la oferta"]')).toBeNull();
    expect(container.querySelector('textarea[aria-label="Descripción de la oferta"]')).toBeNull();

    await act(async () => {
      publishButton.click();
    });
    const confirmButton = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('Confirmar publicación'));
    if (!confirmButton) throw new Error('Offer confirmation button was not rendered');
    await act(async () => {
      confirmButton.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/offers',
      {
        productId: savedProduct.id,
        title: savedProduct.name,
        description: savedProduct.description,
        price: 89.5,
        previousPrice: 110,
      },
      'test-access-token'
    );
    expect(container.textContent).toContain('Oferta publicada');
  });

  it('shows publication failures without marking the offer as published', async () => {
    mockGet.mockImplementation((endpoint: string) => {
      if (endpoint.startsWith('/products/')) return Promise.resolve(savedProduct);
      if (endpoint === '/configs') return Promise.resolve({ configs: [savedConfig] });
      if (endpoint === '/monitors') return Promise.resolve({ monitors: [savedMonitor] });
      throw new Error(`Unexpected GET ${endpoint}`);
    });
    mockPost.mockRejectedValue({ error: 'No se pudo guardar la oferta', status: 500 });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[`/products/${savedProduct.id}`]}>
          <Routes>
            <Route path="/products/:id" element={<ProductSavedPage />} />
          </Routes>
        </MemoryRouter>
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const publishButton = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('Publicar oferta'));
    if (!publishButton) throw new Error('Offer publication button was not rendered');

    await act(async () => {
      publishButton.click();
    });
    const confirmButton = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('Confirmar publicación'));
    if (!confirmButton) throw new Error('Offer confirmation button was not rendered');
    await act(async () => {
      confirmButton.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.querySelector('[role="alert"]')?.textContent)
      .toContain('No se pudo guardar la oferta');
    expect(container.textContent).toContain('El seguimiento de precios está activo.');
    expect(container.querySelector('a[href="/offers/undefined"]')).toBeNull();
  });

  it('reuses the offer already published in this browser session', async () => {
    sessionStorage.setItem(
      `price-tracker-published-offer:${savedProduct.id}`,
      'existing-offer-id'
    );
    mockGet.mockImplementation((endpoint: string) => {
      if (endpoint.startsWith('/products/')) return Promise.resolve(savedProduct);
      if (endpoint === '/configs') return Promise.resolve({ configs: [savedConfig] });
      if (endpoint === '/monitors') return Promise.resolve({ monitors: [] });
      if (endpoint === '/offers/existing-offer-id') {
        return Promise.resolve({ id: 'existing-offer-id' });
      }
      throw new Error(`Unexpected GET ${endpoint}`);
    });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[`/products/${savedProduct.id}`]}>
          <Routes>
            <Route path="/products/:id" element={<ProductSavedPage />} />
            <Route path="/offers/:id" element={<div>Oferta existente</div>} />
          </Routes>
        </MemoryRouter>
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const publishButton = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('Publicar oferta'));
    if (!publishButton) throw new Error('Offer publication button was not rendered');

    await act(async () => {
      publishButton.click();
    });
    const confirmButton = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('Confirmar publicación'));
    if (!confirmButton) throw new Error('Offer confirmation button was not rendered');
    await act(async () => {
      confirmButton.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockGet).toHaveBeenCalledWith('/offers/existing-offer-id', 'test-access-token');
    expect(mockPost.mock.calls.some(([endpoint]) => endpoint === '/offers')).toBe(false);
    expect(container.textContent).toContain('Oferta existente');
  });

  it('shows publication loading and prevents duplicate offer submissions', async () => {
    let resolvePublication: ((value: { id: string }) => void) | undefined;
    mockGet.mockImplementation((endpoint: string) => {
      if (endpoint.startsWith('/products/')) return Promise.resolve(savedProduct);
      if (endpoint === '/configs') return Promise.resolve({ configs: [savedConfig] });
      if (endpoint === '/monitors') return Promise.resolve({ monitors: [] });
      throw new Error(`Unexpected GET ${endpoint}`);
    });
    mockPost.mockImplementation((endpoint: string) => {
      if (endpoint === '/offers') {
        return new Promise((resolve) => {
          resolvePublication = resolve;
        });
      }
      return Promise.resolve(analyzeResponse);
    });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[`/products/${savedProduct.id}`]}>
          <Routes>
            <Route path="/products/:id" element={<ProductSavedPage />} />
            <Route path="/offers/:id" element={<div>Oferta publicada</div>} />
          </Routes>
        </MemoryRouter>
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const publishButton = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('Publicar oferta'));
    if (!publishButton) throw new Error('Offer publication button was not rendered');

    await act(async () => {
      publishButton.click();
    });
    const confirmButton = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('Confirmar publicación'));
    if (!confirmButton) throw new Error('Offer confirmation button was not rendered');
    await act(async () => {
      confirmButton.click();
      confirmButton.click();
    });

    expect(mockPost.mock.calls.filter(([endpoint]) => endpoint === '/offers')).toHaveLength(1);
    expect(container.textContent).toContain('Publicando…');
    expect(confirmButton.disabled).toBe(true);

    await act(async () => {
      resolvePublication?.({ id: 'published-offer-id' });
    });
    expect(container.textContent).toContain('Oferta publicada');
  });
});
