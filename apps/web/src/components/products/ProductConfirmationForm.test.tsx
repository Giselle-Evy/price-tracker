// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockPost, mockPut } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockPut: vi.fn(),
}));
vi.mock('../../lib/api', () => ({ api: { post: mockPost, put: mockPut } }));

import ProductConfirmationForm from './ProductConfirmationForm';
import { mergeManualProductFields, type ProductDetectedField } from './productFields';
import type { SavedProduct } from './productTypes';

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
  mockPost.mockReset();
  mockPut.mockReset();
  onSaved.mockReset();
});

const initialFields: ProductDetectedField[] = [
  { label: 'Nombre', value: 'Nombre detectado' },
  { label: 'Precio anterior', value: '$120.00' },
  { label: 'Precio', value: '$99.50' },
  { label: 'Moneda', value: 'MXN' },
  { label: 'Descripción', value: 'Descripción detectada' },
];

async function renderForm(fields = initialFields) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);

  await act(async () => {
    root.render(
      <ProductConfirmationForm
        originalUrl="https://shop.example/product"
        fields={fields}
        images={[
          { url: 'https://cdn.example/main.jpg', alt: 'Principal' },
          { url: 'https://cdn.example/side.jpg', alt: 'Lateral' },
        ]}
        imageGalleryStatus="found"
        expectedImageCount={2}
        rejectedImageCount={0}
        accessToken="valid-token"
        onSaved={onSaved}
      />
    );
  });
  return { container, root };
}

const onSaved = vi.fn();

function changeInput(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
    'value'
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('ProductConfirmationForm', () => {
  it('sends manual corrections and selected images without requiring a scrape config', async () => {
    mockPost.mockResolvedValue({ id: 'saved-product-id' });
    const { container } = await renderForm();

    const name = container.querySelector<HTMLInputElement>('input[maxlength="500"]');
    const priceInputs = [...container.querySelectorAll<HTMLInputElement>('input[type="number"]')];
    const description = container.querySelector<HTMLTextAreaElement>('textarea');
    if (!name || !description || priceInputs.length !== 2) {
      throw new Error('Expected editable product fields were not rendered');
    }

    await act(async () => {
      changeInput(name, 'Nombre corregido');
      changeInput(priceInputs[0], '89.25');
      changeInput(description, 'Descripción corregida');
      container.querySelector<HTMLButtonElement>(
        'button[aria-label="Usar imagen 2 como principal"]'
      )?.click();
      const firstImageCheckbox =
        container.querySelector<HTMLInputElement>('input[aria-label="Incluir imagen 1"]');
      firstImageCheckbox?.click();
      container.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/products',
      expect.objectContaining({
        name: 'Nombre corregido',
        currentPrice: 89.25,
        previousPrice: 120,
        description: 'Descripción corregida',
        currency: 'MXN',
        imageUrl: 'https://cdn.example/side.jpg',
        images: [expect.objectContaining({ url: 'https://cdn.example/side.jpg' })],
      }),
      'valid-token'
    );
    expect(mockPost.mock.calls[0][1]).not.toHaveProperty('configId');
    expect(onSaved).toHaveBeenCalledWith('saved-product-id');
  });

  it('validates incomplete required data and does not send an invalid product', async () => {
    const { container } = await renderForm();
    const name = container.querySelector<HTMLInputElement>('input[maxlength="500"]');
    if (!name) throw new Error('Name input was not rendered');

    await act(async () => {
      changeInput(name, '  ');
      container.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    });

    expect(container.textContent).toContain('El nombre del producto es obligatorio.');
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('retains editable values on error and blocks duplicate submissions while pending', async () => {
    let rejectPost: ((reason: { error: string; status: number }) => void) | undefined;
    mockPost.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectPost = reject;
        })
    );
    const { container } = await renderForm();
    const name = container.querySelector<HTMLInputElement>('input[maxlength="500"]');
    const button = container.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (!name || !button) throw new Error('Save form controls were not rendered');

    await act(async () => {
      changeInput(name, 'Nombre que debe conservarse');
      button.click();
      button.click();
    });
    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(name.value).toBe('Nombre que debe conservarse');

    await act(async () => {
      rejectPost?.({ error: 'Error de base de datos', status: 500 });
    });
    expect(container.textContent).toContain('Error de base de datos');
    expect(name.value).toBe('Nombre que debe conservarse');

    mockPost.mockResolvedValueOnce({ id: 'saved-after-retry' });
    await act(async () => {
      button.click();
    });
    expect(mockPost).toHaveBeenCalledTimes(2);
    expect(onSaved).toHaveBeenCalledWith('saved-after-retry');
  });

  it('saves a returned product by ID instead of creating another product', async () => {
    mockPut.mockResolvedValue({ id: 'existing-product-id' });
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(
        <ProductConfirmationForm
          originalUrl="https://shop.example/product"
          fields={initialFields}
          images={[
            { url: 'https://cdn.example/main.jpg', alt: 'Principal' },
          ]}
          imageGalleryStatus="found"
          expectedImageCount={1}
          rejectedImageCount={0}
          accessToken="valid-token"
          productId="existing-product-id"
          onSaved={onSaved}
        />
      );
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    });

    expect(mockPut).toHaveBeenCalledWith(
      '/products/existing-product-id',
      expect.objectContaining({
        currentPrice: 99.5,
        previousPrice: 120,
      }),
      'valid-token'
    );
    expect(mockPost).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith('existing-product-id');
  });

  it('restores persisted corrections and selected primary/additional images in edit mode', async () => {
    mockPut.mockResolvedValue({ id: 'existing-product-id' });
    const savedProduct: SavedProduct = {
      id: 'existing-product-id',
      name: 'Nombre corregido y guardado',
      imageUrl: 'https://cdn.example/side.jpg',
      images: [
        { url: 'https://cdn.example/main.jpg', alt: 'Principal' },
        { url: 'https://cdn.example/side.jpg', alt: 'Lateral' },
      ],
      description: 'Descripción corregida y guardada',
      currentPrice: 89.25,
      previousPrice: 110.5,
      canonicalUrl: 'https://shop.example/product',
      originalUrl: 'https://shop.example/product',
      domain: 'shop.example',
      currency: 'MXN',
      createdAt: '2026-10-13T00:00:00.000Z',
      updatedAt: '2026-10-13T00:00:00.000Z',
    };
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    roots.push(root);

    await act(async () => {
      root.render(
        <ProductConfirmationForm
          originalUrl={savedProduct.originalUrl}
          fields={initialFields}
          images={savedProduct.images}
          imageGalleryStatus="found"
          expectedImageCount={2}
          rejectedImageCount={0}
          accessToken="valid-token"
          productId={savedProduct.id}
          savedProduct={savedProduct}
          syncDetectedFields={false}
          onSaved={onSaved}
        />
      );
    });

    const name = container.querySelector<HTMLInputElement>('input[maxlength="500"]');
    const prices = [...container.querySelectorAll<HTMLInputElement>('input[type="number"]')];
    const description = container.querySelector<HTMLTextAreaElement>('textarea');
    if (!name || !description || prices.length !== 2) {
      throw new Error('Saved product fields were not rendered');
    }
    expect(name.value).toBe('Nombre corregido y guardado');
    expect(prices.map((input) => input.value)).toEqual(['89.25', '110.5']);
    expect(description.value).toBe('Descripción corregida y guardada');

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    });

    expect(mockPut).toHaveBeenCalledWith(
      `/products/${savedProduct.id}`,
      expect.objectContaining({
        imageUrl: 'https://cdn.example/side.jpg',
        images: savedProduct.images,
        currentPrice: 89.25,
        previousPrice: 110.5,
      }),
      'valid-token'
    );
  });

  it('syncs newly tested values into untouched fields but preserves manual corrections', async () => {
    const { container, root } = await renderForm();
    const inputs = () =>
      [...container.querySelectorAll<HTMLInputElement>('input[type="number"]')];
    const manuallyUpdated = mergeManualProductFields(initialFields, [
      {
        fieldId: 'old-price',
        label: 'Precio anterior',
        selector: '.old-price',
        type: 'price',
        status: 'success',
        value: '$110.25',
        values: ['$110.25'],
        matchCount: 1,
      },
    ]);

    await act(async () => {
      root.render(
        <ProductConfirmationForm
          originalUrl="https://shop.example/product"
          fields={manuallyUpdated}
          images={[
            { url: 'https://cdn.example/main.jpg', alt: 'Principal' },
            { url: 'https://cdn.example/side.jpg', alt: 'Lateral' },
          ]}
          imageGalleryStatus="found"
          expectedImageCount={2}
          rejectedImageCount={0}
          accessToken="valid-token"
          onSaved={onSaved}
        />
      );
    });

    expect(inputs()[0].value).toBe('99.5');
    expect(inputs()[1].value).toBe('110.25');

    await act(async () => {
      changeInput(inputs()[0], '80');
      root.render(
        <ProductConfirmationForm
          originalUrl="https://shop.example/product"
          fields={mergeManualProductFields(initialFields, [
            {
              fieldId: 'old-price',
              label: 'Precio anterior',
              selector: '.updated-old-price',
              type: 'price',
              status: 'success',
              value: '$105.00',
              values: ['$105.00'],
              matchCount: 1,
            },
          ])}
          images={[
            { url: 'https://cdn.example/main.jpg', alt: 'Principal' },
            { url: 'https://cdn.example/side.jpg', alt: 'Lateral' },
          ]}
          imageGalleryStatus="found"
          expectedImageCount={2}
          rejectedImageCount={0}
          accessToken="valid-token"
          onSaved={onSaved}
        />
      );
    });

    expect(inputs()[0].value).toBe('80');
    expect(inputs()[1].value).toBe('105');

    mockPost.mockResolvedValue({ id: 'saved-product-id' });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    });
    expect(mockPost).toHaveBeenCalledWith(
      '/products',
      expect.objectContaining({ currentPrice: 80, previousPrice: 105 }),
      'valid-token'
    );
  });
});
