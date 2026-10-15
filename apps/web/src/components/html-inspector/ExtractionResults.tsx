
import type { ReactNode } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Circle,
  ChevronDown,
  ExternalLink,
  Package,
} from 'lucide-react';

import type { ExtractionResult } from './utils/runExtraction';
import ProductImageGallery from './ProductImageGallery';
import {
  getProductFieldKind,
  parseProductPrice,
} from '../products/productFields';

type Props = {
  results: ExtractionResult[];
  onClose: () => void;
};

type ProductField = {
  name?: ExtractionResult;
  oldPrice?: ExtractionResult;
  newPrice?: ExtractionResult;
  image?: ExtractionResult;
};

function normalizeLabel(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function identifyFields(results: ExtractionResult[]): ProductField {
  const product: ProductField = {};

  for (const result of results) {
    const label = normalizeLabel(result.label);
    if (result.type === 'image' || /imagen|image|fotografia|foto/.test(label)) {
      product.image ??= result;
      continue;
    }

    if (
      (result.status !== 'success' && result.status !== 'warning') ||
      !result.value?.trim()
    ) {
      continue;
    }

    const kind = getProductFieldKind(result.label);
    if (
      (kind === 'currentPrice' || kind === 'previousPrice') &&
      parseProductPrice(result.value) === null
    ) {
      continue;
    }

    if (kind === 'previousPrice') {
      product.oldPrice ??= result;
    } else if (kind === 'currentPrice') {
      product.newPrice ??= result;
    } else if (kind === 'name') {
      product.name ??= result;
    }
  }

  return product;
}

function getDiscount(oldPrice?: string | null, newPrice?: string | null) {
  const oldValue = parseProductPrice(oldPrice);
  const newValue = parseProductPrice(newPrice);

  if (
    oldValue === null ||
    newValue === null ||
    oldValue <= 0 ||
    newValue < 0 ||
    newValue >= oldValue
  ) {
    return null;
  }

  return Math.round(((oldValue - newValue) / oldValue) * 100);
}

export default function ExtractionResults({ results, onClose }: Props) {
  const successCount = results.filter((r) => r.status === 'success').length;
  const warningCount = results.filter((r) => r.status === 'warning').length;
  const errorCount = results.filter(
    (r) => r.status === 'error' || r.status === 'empty'
  ).length;

  const product = identifyFields(results);
  const discount = getDiscount(
    product.oldPrice?.value,
    product.newPrice?.value
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-sm">
      <header className="flex items-center justify-between gap-4 border-b border-outline-variant bg-surface-container-low px-5 py-4 sm:px-6">
        <div>
          <h2 className="font-semibold text-on-surface">
            Prueba de extracción
          </h2>
          <p className="mt-1 text-xs text-on-surface-variant">
            Comprueba los datos del producto y las imágenes obtenidas con tus selectores.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3 py-2 text-sm text-secondary transition hover:bg-surface-container-high"
        >
          Cerrar
        </button>
      </header>

      <div className="grid grid-cols-3 divide-x divide-outline-variant border-b border-outline-variant">
        <SummaryItem
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          label="Correctos"
          count={successCount}
        />
        <SummaryItem
          icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
          label="Advertencias"
          count={warningCount}
        />
        <SummaryItem
          icon={<XCircle className="h-4 w-4 text-red-600" />}
          label="Errores"
          count={errorCount}
        />
      </div>

      <div className="p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Package className="h-5 w-5 text-secondary" />
          <h3 className="font-semibold text-on-surface">
            Vista previa del producto
          </h3>
        </div>

        <ProductCard product={product} discount={discount} />

        <details className="mt-5 rounded-xl border border-outline-variant">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-medium text-on-surface">
            Revisar selectores y resultados técnicos
            <ChevronDown className="h-4 w-4 shrink-0" />
          </summary>

          <ul className="divide-y divide-outline-variant border-t border-outline-variant">
            {results.map((result) => (
              <ResultRow key={result.fieldId} result={result} />
            ))}
          </ul>
        </details>
      </div>
    </section>
  );
}

function ProductCard({
  product,
  discount,
}: {
  product: ProductField;
  discount: number | null;
}) {
  const name =
    product.name?.status !== 'error' && product.name?.status !== 'empty'
      ? product.name?.value
      : null;

  const images =
    product.image && product.image.status !== 'error' && product.image.status !== 'empty'
      ? (product.image.values.length > 0
          ? product.image.values
          : product.image.value
            ? [product.image.value]
            : []
        ).map((url) => ({ url, alt: name ?? null }))
      : [];

  const oldPrice =
    product.oldPrice?.status !== 'error' && product.oldPrice?.status !== 'empty'
      ? product.oldPrice?.value
      : null;

  const newPrice =
    product.newPrice?.status !== 'error' && product.newPrice?.status !== 'empty'
      ? product.newPrice?.value
      : null;

  return (
    <article className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest">
      <div className="grid grid-cols-1 gap-5 p-4 sm:grid-cols-[180px_minmax(0,1fr)] sm:p-5">
        <ProductImageGallery
          key={images.map((image) => image.url).join('|')}
          images={images}
          productName={name}
          emptyMessage="No se encontraron imágenes con el selector configurado."
        />

        <div className="flex min-w-0 flex-col justify-center">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-secondary">
            Producto extraído
          </p>

          <h4 className="break-words text-lg font-semibold text-on-surface sm:text-xl">
            {name || 'No se pudo detectar el nombre'}
          </h4>

          <div className="mt-5 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-on-surface-variant">
                Precio anterior:
              </span>
              {oldPrice ? (
                <span className="text-sm text-on-surface-variant line-through">
                  {oldPrice}
                </span>
              ) : (
                <span className="text-sm text-on-surface-variant">
                  No disponible
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-on-surface-variant">
                Precio nuevo:
              </span>
              <span className="text-2xl font-bold text-on-surface">
                {newPrice || 'No disponible'}
              </span>

              {discount !== null && (
                <span className="rounded-full bg-emerald-900/40 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                  -{discount}%
                </span>
              )}
            </div>
          </div>

          {discount === null && oldPrice && newPrice && (
            <p className="mt-2 text-xs text-on-surface-variant">
              No se pudo confirmar un descuento con los precios detectados.
            </p>
          )}

          <div className="mt-5 flex items-center gap-2 text-xs text-on-surface-variant">
            {name && newPrice && images.length > 0 ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Vista previa con datos disponibles
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Revisa los campos incompletos
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

function SummaryItem({
  icon,
  label,
  count,
}: {
  icon: ReactNode;
  label: string;
  count: number;
}) {
  return (
    <div className="flex flex-col gap-1 px-3 py-3 sm:flex-row sm:items-center sm:gap-2 sm:px-5">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs text-on-surface-variant">{label}</span>
      </div>
      <span className="text-sm font-semibold text-on-surface">{count}</span>
    </div>
  );
}

function ResultRow({ result }: { result: ExtractionResult }) {
  const { icon, color } = getStatusStyle(result.status);

  return (
    <li className="flex items-start gap-3 p-4">
      <div className="pt-0.5">{icon}</div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-on-surface">
            {result.label}
          </span>
          <span className="text-xs text-on-surface-variant">
            {result.type}
          </span>
          <span className="text-xs text-on-surface-variant">
            {result.matchCount} coincidencia{result.matchCount !== 1 ? 's' : ''}
          </span>
        </div>

        <code className="mt-2 block break-all text-xs text-on-surface-variant">
          {result.selector}
          {result.attribute && ` @${result.attribute}`}
        </code>

        {result.value && (
          <div className="mt-2 break-all rounded-lg bg-surface-container-low p-2 text-xs text-on-surface">
            {result.type === 'image' ? (
              <a
                href={result.value}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-secondary underline"
              >
                Abrir imagen <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              result.value
            )}
          </div>
        )}

        {result.message && (
          <p className={`mt-2 text-xs ${color}`}>{result.message}</p>
        )}
      </div>
    </li>
  );
}

function getStatusStyle(status: ExtractionResult['status']): {
  icon: ReactNode;
  color: string;
} {
  switch (status) {
    case 'success':
      return {
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
        color: 'text-emerald-700',
      };
    case 'warning':
      return {
        icon: <AlertTriangle className="h-5 w-5 text-amber-600" />,
        color: 'text-amber-700',
      };
    case 'empty':
      return {
        icon: <Circle className="h-5 w-5 text-slate-400" />,
        color: 'text-slate-500',
      };
    case 'error':
      return {
        icon: <XCircle className="h-5 w-5 text-red-600" />,
        color: 'text-red-700',
      };
  }
}
