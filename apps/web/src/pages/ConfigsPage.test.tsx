// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockGet, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  api: { get: mockGet, delete: mockDelete },
}));
vi.mock('../stores/authStore', () => ({
  useAuthStore: (selector: (state: { accessToken: string }) => unknown) =>
    selector({ accessToken: 'test-access-token' }),
}));

import ConfigsPage from './ConfigsPage';

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
  mockDelete.mockReset();
});

describe('ConfigsPage deletion controls', () => {
  it('shows a delete action for every listed config even when fields are absent', async () => {
    mockGet.mockResolvedValue({
      configs: [
        {
          id: 'config-old',
          name: 'Configuración antigua',
          sourceUrl: 'https://shop.example/old',
          sourceDomain: 'shop.example',
          status: 'draft',
        },
        {
          id: 'config-new',
          name: 'Configuración nueva',
          sourceUrl: 'https://shop.example/new',
          sourceDomain: 'shop.example',
          status: 'archived',
          fields: [],
        },
      ],
    });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(
        <MemoryRouter>
          <ConfigsPage />
        </MemoryRouter>
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(container.querySelectorAll('button[aria-label="Eliminar"]')).toHaveLength(2);
    expect(container.textContent).toContain('0 campos');
  });

  it('shows the API error after a blocked deletion and keeps the config listed', async () => {
    mockGet.mockResolvedValue({
      configs: [
        {
          id: 'monitored-config',
          name: 'Configuración con seguimiento',
          sourceUrl: 'https://shop.example/product',
          sourceDomain: 'shop.example',
          status: 'active',
          fields: [],
        },
      ],
    });
    mockDelete.mockRejectedValue({
      error: 'No se puede eliminar esta configuración porque tiene seguimientos asociados.',
      status: 409,
    });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(
        <MemoryRouter>
          <ConfigsPage />
        </MemoryRouter>
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="Eliminar"]')?.click();
    });
    await act(async () => {
      [...container.querySelectorAll('button')]
        .find((button) => button.textContent?.includes('Eliminar'))
        ?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mockDelete).toHaveBeenCalledWith(
      '/configs/monitored-config',
      'test-access-token'
    );
    expect(container.textContent).toContain('No se puede eliminar esta configuración');
    expect(container.textContent).toContain('Configuración con seguimiento');
  });
});
