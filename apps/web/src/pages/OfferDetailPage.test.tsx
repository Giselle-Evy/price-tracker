// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockGet, mockPatch, mockDelete, authState } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPatch: vi.fn(),
  mockDelete: vi.fn(),
  authState: { accessToken: null as string | null },
}));
vi.mock('../lib/api', () => ({
  api: { get: mockGet, patch: mockPatch, delete: mockDelete },
}));
vi.mock('../stores/authStore', () => ({
  useAuthStore: (selector: (state: { accessToken: string | null }) => unknown) =>
    selector(authState),
}));

import OfferDetailPage from './OfferDetailPage';

const roots: Root[] = [];
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
  configurable: true,
  value: true,
});

const offerDetail = {
  id: 'published-offer-id',
  isOwner: false,
  title: 'Oferta de producto',
  description: 'Descripción de la comunidad',
  price: 85,
  previousPrice: 110,
  originalUrl: 'https://shop.example/product',
  imageUrl: 'https://cdn.example/product.jpg',
  currency: 'MXN',
  publishedAt: '2026-10-13T18:00:00.000Z',
  product: {
    id: 'product-id',
    name: 'Producto',
    imageUrl: 'https://cdn.example/product.jpg',
    currentPrice: 85,
    previousPrice: 110,
    currency: 'MXN',
    originalUrl: 'https://shop.example/product',
  },
  monitoring: {
    status: 'active' as const,
    frequencyMin: 'm15' as const,
    lastSuccessAt: '2026-10-13T19:00:00.000Z',
    currentPrice: 85,
    history: [
      { price: 89.5, currency: 'MXN', observedAt: '2026-10-13T18:00:00.000Z' },
      { price: 85, currency: 'MXN', observedAt: '2026-10-13T19:00:00.000Z' },
    ],
  },
};

afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(async () => root.unmount());
  }
  document.body.innerHTML = '';
  mockGet.mockReset();
  mockPatch.mockReset();
  mockDelete.mockReset();
  authState.accessToken = null;
});

function renderDetail() {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  return { container, root };
}

describe('OfferDetailPage', () => {
  it('shows the actual monitor summary and historical chart without monitor controls', async () => {
    mockGet.mockResolvedValue(offerDetail);
    const { container, root } = renderDetail();

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/offers/published-offer-id']}>
          <Routes>
            <Route path="/offers/:id" element={<OfferDetailPage />} />
            <Route path="/" element={<p>Comunidad de ofertas</p>} />
          </Routes>
        </MemoryRouter>
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockGet).toHaveBeenCalledWith('/offers/published-offer-id');
    expect(container.textContent).toContain('Oferta de producto');
    expect(container.textContent).toContain('Cada 15 minutos');
    expect(container.textContent).toContain('Activo');
    expect(container.querySelector('svg[aria-label="Gráfica del historial real de precios"]'))
      .not.toBeNull();
    expect(container.querySelectorAll('svg circle')).toHaveLength(2);
    expect(container.textContent).toContain('Página original');
    expect(container.querySelector('button')).toBeNull();
  });

  it('renders a truthful empty message when no monitor history exists', async () => {
    mockGet.mockResolvedValue({ ...offerDetail, monitoring: null });
    const { container, root } = renderDetail();

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/offers/published-offer-id']}>
          <Routes>
            <Route path="/offers/:id" element={<OfferDetailPage />} />
            <Route path="/" element={<p>Comunidad de ofertas</p>} />
          </Routes>
        </MemoryRouter>
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain('todavía no tiene un monitoreo registrado');
    expect(container.textContent).toContain('No hay mediciones históricas disponibles');
    expect(container.querySelector('svg[aria-label="Gráfica del historial real de precios"]'))
      .toBeNull();
  });

  it('shows the saved offer price after editing and reloading despite stale monitor prices', async () => {
    authState.accessToken = 'owner-token';
    mockGet.mockResolvedValue({ ...offerDetail, isOwner: true });
    mockPatch.mockResolvedValue({
      id: offerDetail.id,
      title: 'Oferta editada',
      description: 'Descripción editada',
      price: 79,
      previousPrice: 110,
    });
    const { container, root } = renderDetail();

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/offers/published-offer-id']}>
          <Routes>
            <Route path="/offers/:id" element={<OfferDetailPage />} />
            <Route path="/" element={<p>Comunidad de ofertas</p>} />
          </Routes>
        </MemoryRouter>
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(mockGet).toHaveBeenCalledWith('/offers/published-offer-id', 'owner-token');

    const editButton = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('Editar oferta'));
    expect(editButton).toBeDefined();
    await act(async () => editButton?.click());

    const title = container.querySelector<HTMLInputElement>('input[aria-label="Título de la oferta"]');
    if (!title) throw new Error('Edit form was not rendered');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
        ?.set?.call(title, 'Oferta editada');
      title.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const price = container.querySelector<HTMLInputElement>(
      'input[aria-label="Precio actual de la oferta"]'
    );
    if (!price) throw new Error('Offer price input was not rendered');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
        ?.set?.call(price, '79');
      price.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const saveButton = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('Guardar cambios'));
    await act(async () => {
      saveButton?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockPatch).toHaveBeenCalledWith(
      '/offers/published-offer-id',
      {
        title: 'Oferta editada',
        description: 'Descripción de la comunidad',
        price: 79,
        previousPrice: 110,
      },
      'owner-token'
    );
    expect(container.textContent).toContain('Oferta editada');
    expect(container.querySelector('p.text-2xl')?.textContent).toContain('79');
    expect(mockPatch).toHaveBeenCalledTimes(1);

    const updatedOffer = {
      ...offerDetail,
      isOwner: true,
      price: 79,
      product: { ...offerDetail.product, currentPrice: 85 },
      monitoring: { ...offerDetail.monitoring, currentPrice: 85 },
    };
    mockGet.mockResolvedValueOnce(updatedOffer);
    await act(async () => root.unmount());
    roots.splice(roots.indexOf(root), 1);

    const { container: reloadedContainer, root: reloadedRoot } = renderDetail();
    await act(async () => {
      reloadedRoot.render(
        <MemoryRouter initialEntries={['/offers/published-offer-id']}>
          <Routes>
            <Route path="/offers/:id" element={<OfferDetailPage />} />
            <Route path="/" element={<p>Comunidad de ofertas</p>} />
          </Routes>
        </MemoryRouter>
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(reloadedContainer.querySelector('p.text-2xl')?.textContent).toContain('79');
  });

  it('shows edit failures without replacing the offer with an unsaved success state', async () => {
    authState.accessToken = 'owner-token';
    mockGet.mockResolvedValue({ ...offerDetail, isOwner: true });
    mockPatch.mockRejectedValue({ error: 'No se pudo guardar el cambio', status: 500 });
    const { container, root } = renderDetail();

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/offers/published-offer-id']}>
          <Routes>
            <Route path="/offers/:id" element={<OfferDetailPage />} />
            <Route path="/" element={<p>Comunidad de ofertas</p>} />
          </Routes>
        </MemoryRouter>
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      [...container.querySelectorAll<HTMLButtonElement>('button')]
        .find((button) => button.textContent?.includes('Editar oferta'))
        ?.click();
    });
    await act(async () => {
      [...container.querySelectorAll<HTMLButtonElement>('button')]
        .find((button) => button.textContent?.includes('Guardar cambios'))
        ?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.querySelector('[role="alert"]')?.textContent)
      .toContain('No se pudo guardar el cambio');
    expect(container.textContent).toContain('Guardar cambios');
    expect(container.textContent).not.toContain('Oferta editada');
  });

  it('shows edit loading and prevents duplicate update requests', async () => {
    authState.accessToken = 'owner-token';
    mockGet.mockResolvedValue({ ...offerDetail, isOwner: true });
    let resolveUpdate: ((value: {
      id: string;
      title: string;
      description: string;
      price: number;
      previousPrice: number;
    }) => void) | undefined;
    mockPatch.mockImplementation(() => new Promise((resolve) => {
      resolveUpdate = resolve;
    }));
    const { container, root } = renderDetail();

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/offers/published-offer-id']}>
          <Routes>
            <Route path="/offers/:id" element={<OfferDetailPage />} />
            <Route path="/" element={<p>Comunidad de ofertas</p>} />
          </Routes>
        </MemoryRouter>
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      [...container.querySelectorAll<HTMLButtonElement>('button')]
        .find((button) => button.textContent?.includes('Editar oferta'))
        ?.click();
    });
    const saveButton = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('Guardar cambios'));
    await act(async () => {
      saveButton?.click();
      saveButton?.click();
    });

    expect(mockPatch).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Guardando…');
    expect(saveButton?.disabled).toBe(true);

    await act(async () => {
      resolveUpdate?.({
        id: offerDetail.id,
        title: offerDetail.title,
        description: offerDetail.description,
        price: offerDetail.price,
        previousPrice: offerDetail.previousPrice,
      });
    });
    expect(container.textContent).toContain('Oferta de producto');
  });

  it('requires confirmation before deleting and returns to the community after success', async () => {
    authState.accessToken = 'owner-token';
    mockGet.mockResolvedValue({ ...offerDetail, isOwner: true });
    let resolveDelete: (() => void) | undefined;
    mockDelete.mockImplementation(() => new Promise<void>((resolve) => {
      resolveDelete = resolve;
    }));
    const { container, root } = renderDetail();

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/offers/published-offer-id']}>
          <Routes>
            <Route path="/offers/:id" element={<OfferDetailPage />} />
            <Route path="/" element={<p>Comunidad de ofertas</p>} />
          </Routes>
        </MemoryRouter>
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      [...container.querySelectorAll<HTMLButtonElement>('button')]
        .find((button) => button.textContent?.includes('Eliminar oferta'))
        ?.click();
    });
    expect(container.querySelector('[role="dialog"]')?.textContent)
      .toContain('El producto y su seguimiento de precios no se eliminarán');
    expect(mockDelete).not.toHaveBeenCalled();

    await act(async () => {
      [...container.querySelectorAll<HTMLButtonElement>('button')]
        .filter((button) => button.textContent?.includes('Eliminar oferta'))
        .at(-1)
        ?.click();
    });

    expect(mockDelete).toHaveBeenCalledWith('/offers/published-offer-id', 'owner-token');
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Eliminando...');
    const confirmDelete = [...container.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')]
      .find((button) => button.textContent?.includes('Eliminando...'));
    expect(confirmDelete?.disabled).toBe(true);

    await act(async () => {
      resolveDelete?.();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).toContain('Comunidad de ofertas');
  });

  it('keeps the offer and confirmation visible when deletion fails', async () => {
    authState.accessToken = 'owner-token';
    mockGet.mockResolvedValue({ ...offerDetail, isOwner: true });
    mockDelete.mockRejectedValue({ error: 'No se pudo eliminar la oferta', status: 500 });
    const { container, root } = renderDetail();

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/offers/published-offer-id']}>
          <Routes>
            <Route path="/offers/:id" element={<OfferDetailPage />} />
            <Route path="/" element={<p>Comunidad de ofertas</p>} />
          </Routes>
        </MemoryRouter>
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      [...container.querySelectorAll<HTMLButtonElement>('button')]
        .find((button) => button.textContent?.includes('Eliminar oferta'))
        ?.click();
    });
    await act(async () => {
      [...container.querySelectorAll<HTMLButtonElement>('button')]
        .filter((button) => button.textContent?.includes('Eliminar oferta'))
        .at(-1)
        ?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.querySelector('[role="alert"]')?.textContent)
      .toContain('No se pudo eliminar la oferta');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.textContent).toContain('Oferta de producto');
    expect(container.textContent).not.toContain('Comunidad de ofertas');
  });

  it('does not expose edit or delete actions to non-owners', async () => {
    mockGet.mockResolvedValue({ ...offerDetail, isOwner: false });
    const { container, root } = renderDetail();

    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/offers/published-offer-id']}>
          <Routes>
            <Route path="/offers/:id" element={<OfferDetailPage />} />
            <Route path="/" element={<p>Comunidad de ofertas</p>} />
          </Routes>
        </MemoryRouter>
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.textContent).not.toContain('Editar oferta');
    expect(container.textContent).not.toContain('Eliminar oferta');
  });
});
