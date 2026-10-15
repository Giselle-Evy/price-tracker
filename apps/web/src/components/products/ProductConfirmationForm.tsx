
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Save } from 'lucide-react';

import { api, type ApiError } from '../../lib/api';
import ProductImageGallery, {
  type ProductImagePreview,
} from '../html-inspector/ProductImageGallery';
import {
  getProductFieldKind,
  parseProductPrice,
  type ProductDetectedField,
  type ProductFieldKind,
} from './productFields';
import type { SavedProduct } from './productTypes';

type SaveProductPayload = {
  name: string;
  url: string;
  description: string | null;
  currentPrice: number | null;
  previousPrice: number | null;
  currency: string | null;
  imageUrl: string | null;
  images: ProductImagePreview[];
};

type Props = {
  originalUrl: string;
  fields: ProductDetectedField[];
  images: ProductImagePreview[];
  imageGalleryStatus: 'found' | 'partial' | 'not_found';
  expectedImageCount: number | null;
  rejectedImageCount: number;
  accessToken: string | null;
  productId?: string;
  savedProduct?: SavedProduct | null;
  syncDetectedFields?: boolean;
  submitLabel?: string;
  onSaved: (productId: string) => void;
};

function getValue(
  fields: ProductDetectedField[],
  kind: ProductFieldKind
): string {
  return (
    fields.find((field) => getProductFieldKind(field.label) === kind)?.value ??
    ''
  );
}

function getCurrentPrice(fields: ProductDetectedField[]): string {
  return getValue(fields, 'currentPrice');
}

function formatPrice(value: string): string {
  const price = parseProductPrice(value);
  return price === null ? '' : String(price);
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'error' in error) {
    const apiError = error as ApiError;
    return apiError.error;
  }

  return 'No se pudo guardar el producto. Tus cambios siguen disponibles para reintentar.';
}

export default function ProductConfirmationForm({
  originalUrl,
  fields,
  images,
  imageGalleryStatus,
  expectedImageCount,
  rejectedImageCount,
  accessToken,
  productId,
  savedProduct,
  syncDetectedFields = true,
  submitLabel = 'Guardar producto y continuar',
  onSaved,
}: Props) {
  const [name, setName] = useState(
    () => savedProduct?.name ?? getValue(fields, 'name')
  );

  const [url, setUrl] = useState(
    () => savedProduct?.originalUrl ?? originalUrl
  );

  const [description, setDescription] = useState(
    () => savedProduct?.description ?? getValue(fields, 'description')
  );

  const [currentPrice, setCurrentPrice] = useState(() =>
    savedProduct?.currentPrice === null ||
    savedProduct?.currentPrice === undefined
      ? formatPrice(getCurrentPrice(fields))
      : String(savedProduct.currentPrice)
  );

  const [previousPrice, setPreviousPrice] = useState(() =>
    savedProduct?.previousPrice === null ||
    savedProduct?.previousPrice === undefined
      ? formatPrice(getValue(fields, 'previousPrice'))
      : String(savedProduct.previousPrice)
  );

  const [currency, setCurrency] = useState(
    () => savedProduct?.currency ?? getValue(fields, 'currency')
  );

  const [includedImageUrls, setIncludedImageUrls] = useState(() =>
    images.map((image) => image.url)
  );

  const [primaryImageUrl, setPrimaryImageUrl] = useState<string | null>(
    savedProduct?.imageUrl ?? images[0]?.url ?? null
  );

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const savingRef = useRef(false);

  const touchedRef = useRef<{
    name?: boolean;
    description?: boolean;
    currentPrice?: boolean;
    previousPrice?: boolean;
    currency?: boolean;
    images?: boolean;
  }>({});

  const detectedName = getValue(fields, 'name');
  const detectedDescription = getValue(fields, 'description');
  const detectedCurrentPrice = formatPrice(getCurrentPrice(fields));
  const detectedPreviousPrice = formatPrice(
    getValue(fields, 'previousPrice')
  );
  const detectedCurrency = getValue(fields, 'currency');

  const imagesFingerprint = images
    .map(
      (image) =>
        `${image.url}\u0000${image.alt ?? ''}\u0000${image.source ?? ''}\u0000${image.order ?? ''}`
    )
    .join('\u0001');

  useEffect(() => {
    if (syncDetectedFields && !touchedRef.current.name) {
      setName(detectedName);
    }
  }, [detectedName, syncDetectedFields]);

  useEffect(() => {
    if (syncDetectedFields && !touchedRef.current.description) {
      setDescription(detectedDescription);
    }
  }, [detectedDescription, syncDetectedFields]);

  useEffect(() => {
    if (syncDetectedFields && !touchedRef.current.currentPrice) {
      setCurrentPrice(detectedCurrentPrice);
    }
  }, [detectedCurrentPrice, syncDetectedFields]);

  useEffect(() => {
    if (syncDetectedFields && !touchedRef.current.previousPrice) {
      setPreviousPrice(detectedPreviousPrice);
    }
  }, [detectedPreviousPrice, syncDetectedFields]);

  useEffect(() => {
    if (syncDetectedFields && !touchedRef.current.currency) {
      setCurrency(detectedCurrency);
    }
  }, [detectedCurrency, syncDetectedFields]);

  useEffect(() => {
    if (!touchedRef.current.images) {
      setIncludedImageUrls(images.map((image) => image.url));
      setPrimaryImageUrl(savedProduct?.imageUrl ?? images[0]?.url ?? null);
    }
  }, [imagesFingerprint, images, savedProduct?.imageUrl]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (savingRef.current) return;

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('El nombre del producto es obligatorio.');
      return;
    }

    let parsedUrl: URL;

    try {
      parsedUrl = new URL(url.trim());

      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('invalid protocol');
      }
    } catch {
      setError('Introduce una URL válida que use HTTP o HTTPS.');
      return;
    }

    const current = currentPrice.trim() ? Number(currentPrice) : null;
    const previous = previousPrice.trim() ? Number(previousPrice) : null;

    if (
      (current !== null && (!Number.isFinite(current) || current <= 0)) ||
      (previous !== null && (!Number.isFinite(previous) || previous <= 0))
    ) {
      setError(
        'Los precios deben ser números mayores que cero o quedar vacíos si no están disponibles.'
      );
      return;
    }

    const selectedImages = images.filter((image) =>
      includedImageUrls.includes(image.url)
    );

    const selectedPrimary =
      selectedImages.find((image) => image.url === primaryImageUrl) ??
      selectedImages[0] ??
      null;

    const payload: SaveProductPayload = {
      name: trimmedName,
      url: url.trim(),
      description: description.trim() || null,
      currentPrice: current,
      previousPrice: previous,
      currency: currency.trim() || null,
      imageUrl: selectedPrimary?.url ?? null,
      images: selectedImages,
    };

    savingRef.current = true;
    setIsSaving(true);
    setError(null);

    try {
      const saved = productId
        ? await api.put<{ id: string }>(
            `/products/${productId}`,
            payload,
            accessToken
          )
        : await api.post<{ id: string }>(
            '/products',
            payload,
            accessToken
          );

      onSaved(saved.id);
    } catch (saveError) {
      setError(getErrorMessage(saveError));
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest">
      <header className="border-b border-outline-variant bg-surface-container-low px-5 py-4">
        <h2 className="font-semibold text-on-surface">
          Confirmar y guardar producto
        </h2>

        <p className="mt-1 text-sm text-on-surface-variant">
          Revisa y corrige los datos. Guardar el producto no requiere crear una
          configuración de scraping.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5 p-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <div>
            <ProductImageGallery
              key={images.map((image) => image.url).join('|')}
              images={images}
              productName={name}
              emptyMessage="No hay imágenes disponibles; puedes guardar el producto sin imagen."
              selectedUrls={includedImageUrls}
              primaryUrl={primaryImageUrl}
              onSelectionChange={(urls) => {
                touchedRef.current.images = true;
                setIncludedImageUrls(urls);

                setPrimaryImageUrl((current) =>
                  current && urls.includes(current)
                    ? current
                    : urls[0] ?? null
                );
              }}
              onPrimaryChange={(imageUrl) => {
                touchedRef.current.images = true;
                setPrimaryImageUrl(imageUrl);
              }}
            />

            {imageGalleryStatus === 'partial' ? (
              <p role="status" className="mt-2 text-xs text-amber-300">
                Galería parcial: {images.length}
                {expectedImageCount !== null
                  ? ` de ${expectedImageCount}`
                  : ''}{' '}
                imágenes identificadas.
                {rejectedImageCount > 0 &&
                  ` Se descartaron ${rejectedImageCount} URL no válidas o no seguras.`}
              </p>
            ) : images.length === 0 ? (
              <p
                role="status"
                className="mt-2 text-xs text-on-surface-variant"
              >
                No se detectaron imágenes. El producto puede guardarse sin
                ellas.
              </p>
            ) : null}
          </div>

          <div className="space-y-4">
            <Field label="Nombre del producto">
              <input
                required
                maxLength={500}
                value={name}
                onChange={(event) => {
                  touchedRef.current.name = true;
                  setName(event.target.value);
                }}
                className={inputClass}
              />
            </Field>

            <Field label="URL original del producto">
              <input
                required
                type="url"
                maxLength={2048}
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                className={`${inputClass} font-mono text-xs`}
              />
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Precio actual">
                <input
                  type="number"
                  min="0.01"
                  max="9999999999.99"
                  step="0.01"
                  value={currentPrice}
                  onChange={(event) => {
                    touchedRef.current.currentPrice = true;
                    setCurrentPrice(event.target.value);
                  }}
                  placeholder="No disponible"
                  className={inputClass}
                />
              </Field>

              <Field label="Precio anterior">
                <input
                  type="number"
                  min="0.01"
                  max="9999999999.99"
                  step="0.01"
                  value={previousPrice}
                  onChange={(event) => {
                    touchedRef.current.previousPrice = true;
                    setPreviousPrice(event.target.value);
                  }}
                  placeholder="Opcional"
                  className={inputClass}
                />
              </Field>

              <Field label="Moneda">
                <input
                  maxLength={8}
                  value={currency}
                  onChange={(event) => {
                    touchedRef.current.currency = true;
                    setCurrency(event.target.value);
                  }}
                  placeholder="No detectada"
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="Descripción">
              <textarea
                rows={4}
                maxLength={20000}
                value={description}
                onChange={(event) => {
                  touchedRef.current.description = true;
                  setDescription(event.target.value);
                }}
                placeholder="No disponible"
                className={`${inputClass} resize-y`}
              />
            </Field>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-error-container p-3 text-sm text-on-error-container"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-outline-variant pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-xs text-on-surface-variant">
            <CheckCircle2
              aria-hidden="true"
              className="h-4 w-4 text-secondary"
            />
            Precio vacío significa que no se confirmó un precio; nunca se
            guardará como cero.
          </p>

          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-container px-5 py-3 text-sm font-semibold text-on-primary-container transition hover:bg-primary disabled:cursor-wait disabled:opacity-60"
          >
            {isSaving ? (
              <Loader2
                aria-hidden="true"
                className="h-4 w-4 animate-spin"
              />
            ) : (
              <Save aria-hidden="true" className="h-4 w-4" />
            )}

            {isSaving ? 'Guardando...' : submitLabel}
          </button>
        </div>
      </form>
    </section>
  );
}

const inputClass =
  'w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-medium text-on-surface-variant">
        {label}
      </span>
      {children}
    </label>
  );
}
