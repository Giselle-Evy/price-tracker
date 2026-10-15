import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ExternalLink,
  ImageOff,
  Loader2,
  Pencil,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { api, type ApiError } from '../lib/api';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useAuthStore } from '../stores/authStore';

type PricePoint = {
  price: number;
  currency: string | null;
  observedAt: string;
};

type MonitoringFrequency = 'm5' | 'm10' | 'm15' | 'm30';

type OfferDetail = {
  id: string;
  isOwner: boolean;
  title: string;
  description: string | null;
  price: number | null;
  previousPrice: number | null;
  originalUrl: string;
  imageUrl: string | null;
  currency: string | null;
  publishedAt: string;
  product: {
    id: string;
    name: string;
    imageUrl: string | null;
    currentPrice: number | null;
    previousPrice: number | null;
    currency: string | null;
    originalUrl: string;
  };
  monitoring: {
    status: 'active' | 'paused' | 'error' | 'pending';
    frequencyMin: MonitoringFrequency;
    lastSuccessAt: string | null;
    currentPrice: number | null;
    history: PricePoint[];
  } | null;
};

export default function OfferDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [offer, setOffer] = useState<OfferDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editPreviousPrice, setEditPreviousPrice] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const savingRef = useRef(false);
  const deletingRef = useRef(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setIsLoading(true);
    (accessToken
      ? api.get<OfferDetail>(`/offers/${encodeURIComponent(id)}`, accessToken)
      : api.get<OfferDetail>(`/offers/${encodeURIComponent(id)}`))
      .then((result) => {
        if (!cancelled) {
          setOffer(result);
          setEditTitle(result.title);
          setEditDescription(result.description ?? '');
          setEditPrice(result.price?.toString() ?? '');
          setEditPreviousPrice(result.previousPrice?.toString() ?? '');
          setError(null);
        }
      })
      .catch((requestError: ApiError) => {
        if (!cancelled) setError(requestError.error || 'No se pudo cargar la oferta.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, accessToken]);

  async function handleUpdateOffer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!offer?.isOwner || !accessToken || savingRef.current) return;

    const price = parseOfferPrice(editPrice);
    const previousPrice = parseOfferPrice(editPreviousPrice);
    if (!editTitle.trim()) {
      setActionError('El título de la oferta es obligatorio.');
      return;
    }
    if (price === undefined || previousPrice === undefined) {
      setActionError('Los precios deben ser números mayores que cero o quedar vacíos.');
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    setActionError(null);
    try {
      const updated = await api.patch<Pick<OfferDetail, 'id' | 'title' | 'description' | 'price' | 'previousPrice'>>(
        `/offers/${encodeURIComponent(offer.id)}`,
        {
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          price,
          previousPrice,
        },
        accessToken
      );
      setOffer((current) => current ? { ...current, ...updated } : current);
      setIsEditing(false);
    } catch (requestError) {
      setActionError(getRequestErrorMessage(requestError, 'No se pudo actualizar la oferta.'));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  async function handleDeleteOffer() {
    if (!offer?.isOwner || !accessToken || deletingRef.current) return;

    deletingRef.current = true;
    setIsDeleting(true);
    setActionError(null);
    try {
      await api.delete<void>(`/offers/${encodeURIComponent(offer.id)}`, accessToken);
      setIsDeleteDialogOpen(false);
      navigate('/');
    } catch (requestError) {
      setIsDeleteDialogOpen(false);
      setActionError(getRequestErrorMessage(requestError, 'No se pudo eliminar la oferta.'));
    } finally {
      deletingRef.current = false;
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-4xl justify-center p-12">
        <Loader2 aria-label="Cargando oferta" className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !offer) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <div role="alert" className="flex gap-3 rounded-xl bg-error-container p-4 text-on-error-container">
          <AlertCircle aria-hidden="true" className="h-5 w-5 shrink-0" />
          <p>{error ?? 'No se encontró la oferta solicitada.'}</p>
        </div>
        <Link to="/" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Volver a la comunidad
        </Link>
      </main>
    );
  }

  const monitor = offer.monitoring;
  const currentPrice =
    offer.price ?? monitor?.currentPrice ?? offer.product.currentPrice;
  const previousPrice = offer.product.previousPrice ?? offer.previousPrice;
  const externalUrl = safeHttpUrl(offer.originalUrl);
  const productUrl = safeHttpUrl(offer.product.originalUrl);

  return (
    <>
      <main className="mx-auto max-w-4xl p-5 sm:p-8">
      <Link to="/" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-primary">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Volver a la comunidad
      </Link>
      <article className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest">
        <div className="grid gap-6 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:p-7">
          <div className="flex min-h-56 items-center justify-center rounded-xl bg-surface-container-low p-4">
            {offer.imageUrl ? (
              <img
                src={offer.imageUrl}
                alt={offer.product.name}
                className="max-h-80 w-full object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              <ImageOff aria-hidden="true" className="h-9 w-9 text-outline" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
              Oferta de la comunidad
            </p>
            {isEditing ? (
              <form className="mt-3 space-y-3" onSubmit={(event) => void handleUpdateOffer(event)}>
                <label className="block text-xs font-medium text-on-surface-variant">
                  Título
                  <input
                    aria-label="Título de la oferta"
                    value={editTitle}
                    maxLength={500}
                    onChange={(event) => setEditTitle(event.target.value)}
                    className={inputClass}
                    required
                  />
                </label>
                <label className="block text-xs font-medium text-on-surface-variant">
                  Descripción
                  <textarea
                    aria-label="Descripción de la oferta"
                    value={editDescription}
                    maxLength={20000}
                    onChange={(event) => setEditDescription(event.target.value)}
                    rows={3}
                    className={inputClass}
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-medium text-on-surface-variant">
                    Precio actual
                    <input
                      aria-label="Precio actual de la oferta"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={editPrice}
                      onChange={(event) => setEditPrice(event.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="block text-xs font-medium text-on-surface-variant">
                    Precio anterior
                    <input
                      aria-label="Precio anterior de la oferta"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={editPreviousPrice}
                      onChange={(event) => setEditPreviousPrice(event.target.value)}
                      className={inputClass}
                    />
                  </label>
                </div>
                {actionError && <p role="alert" className="text-sm text-error">{actionError}</p>}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container disabled:opacity-60"
                  >
                    {isSaving ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Save aria-hidden="true" className="h-4 w-4" />}
                    {isSaving ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => {
                      setIsEditing(false);
                      setActionError(null);
                    }}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface disabled:opacity-60"
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <>
                <h1 className="mt-2 break-words text-2xl font-semibold tracking-tight text-on-surface">
                  {offer.title}
                </h1>
                {offer.isOwner && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditTitle(offer.title);
                        setEditDescription(offer.description ?? '');
                        setEditPrice(offer.price?.toString() ?? '');
                        setEditPreviousPrice(offer.previousPrice?.toString() ?? '');
                        setActionError(null);
                        setIsEditing(true);
                      }}
                      className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-outline-variant px-3 py-1.5 text-sm font-semibold text-on-surface"
                    >
                      <Pencil aria-hidden="true" className="h-4 w-4" />
                      Editar oferta
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActionError(null);
                        setIsDeleteDialogOpen(true);
                      }}
                      className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-error px-3 py-1.5 text-sm font-semibold text-error"
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                      Eliminar oferta
                    </button>
                  </div>
                )}
              </>
            )}
            <p className="mt-1 text-sm text-on-surface-variant">{offer.product.name}</p>
            {!isEditing && offer.description && (
              <p className="mt-4 whitespace-pre-line text-sm leading-6 text-on-surface-variant">
                {offer.description}
              </p>
            )}
            {!isEditing && currentPrice !== null && (
              <p className="mt-5 text-2xl font-bold text-on-surface">
                {formatPrice(currentPrice, offer.product.currency ?? offer.currency)}
              </p>
            )}
            {!isEditing && previousPrice !== null && previousPrice > (currentPrice ?? 0) && (
              <p className="mt-1 text-sm text-on-surface-variant line-through">
                {formatPrice(previousPrice, offer.product.currency ?? offer.currency)}
              </p>
            )}
            <p className="mt-4 text-xs text-on-surface-variant">
              Publicada {formatDate(offer.publishedAt)}
            </p>
            {actionError && !isEditing && <p role="alert" className="mt-3 text-sm text-error">{actionError}</p>}
            {externalUrl && (
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container hover:bg-primary"
              >
                Ir a la oferta
                <ExternalLink aria-hidden="true" className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>

        <section aria-labelledby="monitoring-heading" className="border-t border-outline-variant p-5 sm:p-7">
          <h2 id="monitoring-heading" className="text-lg font-semibold text-on-surface">
            Seguimiento e historial de precios
          </h2>
          {monitor ? (
            <div className="mt-3 grid gap-2 text-sm text-on-surface-variant sm:grid-cols-3">
              <p>Estado: <span className="font-medium text-on-surface">{monitorStatusLabel(monitor.status)}</span></p>
              <p>Frecuencia: <span className="font-medium text-on-surface">{frequencyLabel(monitor.frequencyMin)}</span></p>
              <p>
                Última actualización:{' '}
                <span className="font-medium text-on-surface">
                  {monitor.lastSuccessAt ? formatDate(monitor.lastSuccessAt) : 'Sin actualización exitosa'}
                </span>
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-on-surface-variant">
              Este producto todavía no tiene un monitoreo registrado.
            </p>
          )}
          {monitor ? (
            <PriceHistoryChart points={monitor.history} currency={offer.product.currency ?? offer.currency} />
          ) : (
            <p className="mt-4 rounded-lg bg-surface-container-low p-4 text-sm text-on-surface-variant">
              No hay mediciones históricas disponibles.
            </p>
          )}
          {productUrl && (
            <p className="mt-4 break-all text-xs text-on-surface-variant">
              Página original:{' '}
              <a href={productUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                {productUrl}
              </a>
            </p>
          )}
        </section>
      </article>
      </main>
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title="Eliminar oferta"
        message="¿Seguro que quieres eliminar esta oferta? El producto y su seguimiento de precios no se eliminarán."
        confirmLabel="Eliminar oferta"
        isLoading={isDeleting}
        onConfirm={() => void handleDeleteOffer()}
        onCancel={() => setIsDeleteDialogOpen(false)}
      />
    </>
  );
}

function PriceHistoryChart({ points, currency }: { points: PricePoint[]; currency: string | null }) {
  if (points.length === 0) {
    return (
      <p className="mt-4 rounded-lg bg-surface-container-low p-4 text-sm text-on-surface-variant">
        Aún no hay mediciones reales suficientes para mostrar una gráfica.
      </p>
    );
  }

  const width = 800;
  const height = 260;
  const inset = { top: 20, right: 20, bottom: 38, left: 20 };
  const values = points.map((point) => point.price);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum || 1;
  const chartWidth = width - inset.left - inset.right;
  const chartHeight = height - inset.top - inset.bottom;
  const coordinates = points.map((point, index) => ({
    x: inset.left + (points.length === 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth),
    y: inset.top + ((maximum - point.price) / range) * chartHeight,
    point,
  }));

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest p-3">
      <p className="mb-2 text-xs text-on-surface-variant">
        Precio registrado a lo largo del tiempo (valores y fechas reales).
      </p>
      <svg
        role="img"
        aria-label="Gráfica del historial real de precios"
        viewBox={`0 0 ${width} ${height}`}
        className="h-56 w-full"
        preserveAspectRatio="none"
      >
        <line x1={inset.left} y1={height - inset.bottom} x2={width - inset.right} y2={height - inset.bottom} stroke="currentColor" className="text-outline-variant" />
        {coordinates.length > 1 && (
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
            className="text-primary"
            points={coordinates.map(({ x, y }) => `${x},${y}`).join(' ')}
          />
        )}
        {coordinates.map(({ x, y, point }) => (
          <circle key={`${point.observedAt}-${point.price}`} cx={x} cy={y} r="5" fill="currentColor" className="text-primary">
            <title>{`${formatDate(point.observedAt)} — ${formatPrice(point.price, point.currency ?? currency)}`}</title>
          </circle>
        ))}
        <text x={inset.left} y={height - 10} className="fill-current text-[11px] text-on-surface-variant">
          {formatDate(points[0].observedAt)}
        </text>
        <text x={width - inset.right} y={height - 10} textAnchor="end" className="fill-current text-[11px] text-on-surface-variant">
          {formatDate(points[points.length - 1].observedAt)}
        </text>
      </svg>
    </div>
  );
}

function safeHttpUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}

function parseOfferPrice(value: string): number | null | undefined {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && Number(parsed.toFixed(2)) === parsed
    ? parsed
    : undefined;
}

function getRequestErrorMessage(error: unknown, fallback: string): string {
  return error && typeof error === 'object' && 'error' in error
    ? (error as ApiError).error
    : fallback;
}

const inputClass =
  'mt-1.5 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';

function formatPrice(value: number, currency: string | null): string {
  if (currency && /^[A-Z]{3}$/.test(currency)) {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
    } catch {
      // Fall back to a numeric value with the provided currency label.
    }
  }
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)}${currency ? ` ${currency}` : ''}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
    : 'Fecha desconocida';
}

function frequencyLabel(value: MonitoringFrequency): string {
  const minutes = { m5: 5, m10: 10, m15: 15, m30: 30 }[value];
  return `Cada ${minutes} minutos`;
}

function monitorStatusLabel(value: NonNullable<OfferDetail['monitoring']>['status']): string {
  return {
    active: 'Activo',
    paused: 'Pausado',
    error: 'Error',
    pending: 'Pendiente',
  }[value];
}
