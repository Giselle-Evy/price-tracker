import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

import { api, type ApiError } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import type { SavedProduct } from '../components/products/productTypes';

type ScrapeConfigOption = {
  id: string;
  name: string;
  sourceUrl: string;
  fields: Array<{ id: string }>;
};

type MonitorFrequency = 'm5' | 'm10' | 'm15' | 'm30';
type SelectableFrequency = Exclude<MonitorFrequency, 'm10'>;

type ProductMonitor = {
  id: string;
  productId: string;
  configId: string | null;
  extractionMode: 'manual' | 'automatic';
  name: string;
  frequencyMin: MonitorFrequency;
  status: 'active' | 'paused' | 'error' | 'pending';
};

type CreatedOffer = {
  id: string;
};

const PUBLISHED_OFFER_PREFIX = 'price-tracker-published-offer:';

function urlsAreCompatible(productUrl: string, configUrl: string): boolean {
  try {
    const product = new URL(productUrl);
    const config = new URL(configUrl);
    if (
      !['http:', 'https:'].includes(product.protocol) ||
      !['http:', 'https:'].includes(config.protocol)
    ) {
      return false;
    }
    const productHost = product.hostname.toLowerCase();
    const configHost = config.hostname.toLowerCase();
    return (
      productHost === configHost ||
      productHost.endsWith(`.${configHost}`) ||
      configHost.endsWith(`.${productHost}`)
    );
  } catch {
    return false;
  }
}

function isSelectableFrequency(value: MonitorFrequency): value is SelectableFrequency {
  return value === 'm5' || value === 'm15' || value === 'm30';
}

function parseSelectableFrequency(value: string): SelectableFrequency | '' {
  return value === 'm5' || value === 'm15' || value === 'm30' ? value : '';
}

function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'error' in error) {
    return (error as ApiError).error;
  }
  return 'No se pudo configurar el seguimiento. Inténtalo de nuevo.';
}

export default function ProductSavedPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  const accessToken = useAuthStore((state) => state.accessToken);
  const [product, setProduct] = useState<SavedProduct | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [compatibleConfigs, setCompatibleConfigs] = useState<ScrapeConfigOption[]>([]);
  const [monitors, setMonitors] = useState<ProductMonitor[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState('');
  const [frequencyMin, setFrequencyMin] = useState<SelectableFrequency | ''>('m15');
  const [trackingLoadError, setTrackingLoadError] = useState<string | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [trackingSuccess, setTrackingSuccess] = useState<string | null>(null);
  const [loadedTrackingProductId, setLoadedTrackingProductId] = useState<string | null>(null);
  const [isSavingMonitor, setIsSavingMonitor] = useState(false);
  const savingMonitorRef = useRef(false);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
  const [isPublishingOffer, setIsPublishingOffer] = useState(false);
  const publishingOfferRef = useRef(false);
  const isLoadingTrackingOptions =
    Boolean(product) && loadedTrackingProductId !== product?.id;

  useEffect(() => {
    if (!id || !accessToken) return;
    let cancelled = false;

    api
      .get<SavedProduct>(`/products/${id}`, accessToken)
      .then((savedProduct) => {
        if (!cancelled) {
          setProduct(savedProduct);
        }
      })
      .catch((requestError: ApiError) => {
        if (!cancelled) {
          setError(requestError.error || 'No se pudo recuperar el producto guardado.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, accessToken]);

  useEffect(() => {
    if (!product || !accessToken) return;
    let cancelled = false;

    Promise.all([
      api.get<{ configs: ScrapeConfigOption[] }>('/configs', accessToken),
      api.get<{ monitors: ProductMonitor[] }>('/monitors', accessToken),
    ])
      .then(([configResponse, monitorResponse]) => {
        if (cancelled) return;
        setTrackingLoadError(null);
        const compatible = configResponse.configs.filter(
          (config) =>
            config.fields.length > 0 &&
            urlsAreCompatible(product.canonicalUrl, config.sourceUrl)
        );
        const productMonitors = monitorResponse.monitors.filter(
          (monitor) => monitor.productId === product.id
        );
        const matchingMonitors = productMonitors.filter(
          (monitor) =>
            monitor.extractionMode === 'manual' &&
            compatible.some((config) => config.id === monitor.configId)
        );
        setCompatibleConfigs(compatible);
        setMonitors(productMonitors);

        const automaticMonitor = productMonitors.find(
          (monitor) => monitor.extractionMode === 'automatic'
        );
        const unambiguousMonitor =
          matchingMonitors.length === 1 ? matchingMonitors[0] : null;
        const initialConfigId =
          unambiguousMonitor?.configId ??
          (!automaticMonitor && compatible.length === 1 ? compatible[0].id : '');
        setSelectedConfigId(initialConfigId);
        const existingMonitor = productMonitors.find(
          (monitor) =>
            initialConfigId
              ? monitor.extractionMode === 'manual' && monitor.configId === initialConfigId
              : monitor.extractionMode === 'automatic'
        );
        setFrequencyMin(
          existingMonitor && isSelectableFrequency(existingMonitor.frequencyMin)
            ? existingMonitor.frequencyMin
            : existingMonitor ? '' : 'm15'
        );
      })
      .catch((requestError: ApiError) => {
        if (!cancelled) {
          setTrackingLoadError(
            requestError.error || 'No se pudo cargar la configuración del seguimiento.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadedTrackingProductId(product.id);
      });

    return () => {
      cancelled = true;
    };
  }, [product, accessToken]);

  async function handleConfigureMonitoring() {
    if (!product || !frequencyMin || savingMonitorRef.current) {
      return;
    }
    setTrackingError(null);
    setTrackingSuccess(null);

    if (isLoadingTrackingOptions || trackingLoadError) {
      setTrackingError(
        trackingLoadError ?? 'Espera a que termine de cargar la configuración del seguimiento.'
      );
      return;
    }

    savingMonitorRef.current = true;
    setIsSavingMonitor(true);
    const existingMonitor = monitors.find(
      (monitor) =>
        monitor.productId === product.id &&
        (selectedConfigId
          ? monitor.extractionMode === 'manual' && monitor.configId === selectedConfigId
          : monitor.extractionMode === 'automatic')
    );

    try {
      const savedMonitor = existingMonitor
        ? await api.patch<ProductMonitor>(
            `/monitors/${existingMonitor.id}`,
            { frequencyMin },
            accessToken
          )
        : await api.post<ProductMonitor>(
            '/monitors',
            {
              productId: product.id,
              ...(selectedConfigId ? { configId: selectedConfigId } : {}),
              name: product.name,
              frequencyMin,
            },
            accessToken
          );

      setMonitors((current) =>
        existingMonitor
          ? current.map((monitor) =>
              monitor.id === savedMonitor.id ? savedMonitor : monitor
            )
          : [...current, savedMonitor]
      );
      setTrackingSuccess(
        existingMonitor
          ? 'Se actualizó la frecuencia del seguimiento.'
          : 'El seguimiento de precios quedó configurado.'
      );
    } catch (requestError) {
      setTrackingError(getErrorMessage(requestError));
    } finally {
      savingMonitorRef.current = false;
      setIsSavingMonitor(false);
    }
  }

  async function handlePublishOffer() {
    if (!product || !accessToken || publishingOfferRef.current) return;

    publishingOfferRef.current = true;
    setIsPublishingOffer(true);
    setOfferError(null);
    try {
      const storageKey = `${PUBLISHED_OFFER_PREFIX}${product.id}`;
      const existingOfferId = sessionStorage.getItem(storageKey);
      if (existingOfferId) {
        try {
          await api.get(`/offers/${encodeURIComponent(existingOfferId)}`, accessToken);
          setIsPublishDialogOpen(false);
          navigate(`/offers/${encodeURIComponent(existingOfferId)}`);
          return;
        } catch (requestError) {
          if ((requestError as ApiError).status !== 404) throw requestError;
          sessionStorage.removeItem(storageKey);
        }
      }

      const created = await api.post<CreatedOffer>(
        '/offers',
        {
          productId: product.id,
          title: product.name,
          description: product.description?.trim() || null,
          price: product.currentPrice,
          previousPrice: product.previousPrice,
        },
        accessToken
      );
      try {
        sessionStorage.setItem(storageKey, created.id);
      } catch {
        setOfferError('La oferta se publicó; no se pudo guardar el acceso rápido en esta sesión.');
      }
      setIsPublishDialogOpen(false);
      navigate(`/offers/${encodeURIComponent(created.id)}`);
    } catch (requestError) {
      setOfferError(
        requestError && typeof requestError === 'object' && 'error' in requestError
          ? String((requestError as ApiError).error)
          : 'No se pudo publicar la oferta. Inténtalo de nuevo.'
      );
    } finally {
      publishingOfferRef.current = false;
      setIsPublishingOffer(false);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-3xl justify-center p-12">
        <Loader2 aria-label="Cargando producto" className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <div role="alert" className="flex gap-3 rounded-xl bg-error-container p-4 text-on-error-container">
          <AlertCircle aria-hidden="true" className="h-5 w-5 shrink-0" />
          <p>{error ?? 'No se encontró el producto solicitado.'}</p>
        </div>
        <Link
          to={id ? `/builder?productId=${encodeURIComponent(id)}` : '/builder'}
          state={location.state}
          className="mt-4 inline-block text-sm text-primary underline"
        >
          Volver al constructor
        </Link>
      </div>
    );
  }

  const currentPrice = formatPrice(product.currentPrice, product.currency);
  const previousPrice = formatPrice(product.previousPrice, product.currency);
  const selectedMonitor = monitors.find(
    (monitor) =>
      monitor.productId === product.id &&
      (selectedConfigId
        ? monitor.extractionMode === 'manual' && monitor.configId === selectedConfigId
        : monitor.extractionMode === 'automatic')
  );
  const matchingCompatibleMonitors = monitors.filter((monitor) =>
    compatibleConfigs.some((config) => config.id === monitor.configId)
  );
  const requiresConfigChoice =
    compatibleConfigs.length > 1 && matchingCompatibleMonitors.length !== 1;

  return (
    <main className="mx-auto max-w-3xl p-5 sm:p-8">
      <section className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest">
        <header className="flex items-center gap-3 border-b border-outline-variant bg-surface-container-low px-5 py-4">
          <CheckCircle2 aria-hidden="true" className="h-6 w-6 text-emerald-400" />
          <div>
            <h1 className="text-xl font-semibold text-on-surface">Producto guardado correctamente</h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              Se recuperó desde tu registro persistente.
            </p>
          </div>
        </header>

        <div className="grid gap-5 p-5 sm:grid-cols-[180px_minmax(0,1fr)]">
          <div className="flex min-h-40 items-center justify-center rounded-xl bg-surface-container-low p-3">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="max-h-48 w-full object-contain"
                referrerPolicy="no-referrer"
                onError={(event) => {
                  event.currentTarget.hidden = true;
                }}
              />
            ) : (
              <span className="text-sm text-on-surface-variant">Sin imagen principal</span>
            )}
          </div>

          <div className="min-w-0">
            <h2 className="break-words text-lg font-semibold text-on-surface">{product.name}</h2>
            <p className="mt-1 text-sm text-on-surface-variant">{product.domain}</p>
            <a
              href={product.originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block break-all text-sm text-primary underline"
            >
              {product.originalUrl}
            </a>
            {currentPrice && (
              <p className="mt-4 text-lg font-semibold text-on-surface">
                Precio actual: {currentPrice}
              </p>
            )}
            {previousPrice && (
              <p className="mt-1 text-sm text-on-surface-variant">
                Precio anterior: {previousPrice}
              </p>
            )}
            {product.description && (
              <p className="mt-3 whitespace-pre-line text-sm text-on-surface-variant">
                {product.description}
              </p>
            )}
            <p className="mt-3 text-xs text-on-surface-variant">
              {product.images.length} imagen{product.images.length === 1 ? '' : 'es'} guardada{product.images.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        {product.images.length > 1 && (
          <ul aria-label="Imágenes adicionales guardadas" className="flex flex-wrap gap-2 border-t border-outline-variant p-5">
            {product.images
              .filter((image) => image.url !== product.imageUrl)
              .map((image) => (
                <li key={`${image.url}-${image.order}`} className="flex h-16 w-16 items-center justify-center rounded-lg bg-surface-container-low p-1">
                  <img
                    src={image.url}
                    alt={image.alt ?? ''}
                    className="h-full w-full object-contain"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={(event) => {
                      event.currentTarget.hidden = true;
                    }}
                  />
                </li>
              ))}
          </ul>
        )}

        <div className="border-t border-outline-variant bg-surface-container-low/50 p-5">
          <p className="text-sm font-medium text-on-surface">
            {selectedMonitor?.status === 'active'
              ? 'El seguimiento de precios está activo.'
              : selectedMonitor
                ? 'El producto tiene un seguimiento guardado, pero no está activo.'
                : 'El seguimiento de precios aún no está activo.'}
          </p>
          <section
            aria-label="Configurar seguimiento de precios"
            className="mt-4 rounded-lg border border-outline-variant bg-surface-container-low p-4"
          >
              <h3 className="text-sm font-semibold text-on-surface">
                Configurar seguimiento de precios
              </h3>
              <p className="mt-1 text-xs text-on-surface-variant">
                Elige cada cuánto revisar el precio. La frecuencia se configura en minutos.
              </p>

              {isLoadingTrackingOptions ? (
                <p role="status" className="mt-3 flex items-center gap-2 text-sm text-on-surface-variant">
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                  Cargando configuraciones guardadas…
                </p>
              ) : null}
              {trackingLoadError && (
                <p role="alert" className="mt-3 text-sm text-error">{trackingLoadError}</p>
              )}
              {!isLoadingTrackingOptions && !trackingLoadError && (
                <p className="mt-3 text-sm text-on-surface-variant">
                  {selectedConfigId
                    ? 'Se utilizará la configuración manual compatible guardada.'
                    : 'Se intentará detectar el precio automáticamente. Si no se puede validar un precio, el seguimiento no se activará; puedes configurar la extracción desde el Builder.'}
                </p>
              )}
              {requiresConfigChoice && (
                    <label className="mt-4 block text-xs font-medium text-on-surface-variant">
                      Configuración de scraping
                      <select
                        aria-label="Configuración de scraping"
                        value={selectedConfigId}
                        onChange={(event) => {
                          const nextConfigId = event.target.value;
                          setSelectedConfigId(nextConfigId);
                          const existing = monitors.find(
                            (monitor) =>
                              nextConfigId
                                ? monitor.extractionMode === 'manual' &&
                                  monitor.configId === nextConfigId
                                : monitor.extractionMode === 'automatic'
                          );
                          setFrequencyMin(
                            existing && isSelectableFrequency(existing.frequencyMin)
                              ? existing.frequencyMin
                              : existing
                                ? ''
                                : 'm15'
                          );
                          setTrackingSuccess(null);
                        }}
                        className={inputClass}
                      >
                        <option value="">Extracción automática</option>
                        {compatibleConfigs.map((config) => (
                          <option key={config.id} value={config.id}>{config.name}</option>
                        ))}
                      </select>
                    </label>
              )}
              {!requiresConfigChoice && selectedConfigId && (
                    <p className="mt-3 text-xs text-on-surface-variant">
                      Configuración guardada: {
                        compatibleConfigs.find((config) => config.id === selectedConfigId)?.name
                      }
                    </p>
              )}

              <label className="mt-4 block text-xs font-medium text-on-surface-variant">
                    Frecuencia de revisión
                    <select
                      aria-label="Frecuencia de revisión"
                      value={frequencyMin}
                      onChange={(event) => {
                        setFrequencyMin(parseSelectableFrequency(event.target.value));
                        setTrackingSuccess(null);
                        setTrackingError(null);
                      }}
                      className={inputClass}
                    >
                      <option value="">Selecciona una frecuencia</option>
                      <option value="m5">Cada 5 minutos</option>
                      <option value="m15">Cada 15 minutos</option>
                      <option value="m30">Cada 30 minutos</option>
                    </select>
              </label>
              {monitors.some(
                    (monitor) =>
                      monitor.configId === selectedConfigId &&
                      monitor.frequencyMin === 'm10'
                  ) && (
                    <p role="status" className="mt-2 text-xs text-on-surface-variant">
                      Este seguimiento existente conserva su frecuencia heredada de 10 minutos.
                      Selecciona una opción disponible para cambiarla.
                    </p>
              )}
              {trackingError && (
                    <p role="alert" className="mt-3 text-sm text-error">{trackingError}</p>
              )}
              {trackingSuccess && (
                    <p role="status" className="mt-3 text-sm text-primary">{trackingSuccess}</p>
              )}
              <button
                    type="button"
                    onClick={() => void handleConfigureMonitoring()}
                    disabled={
                      !frequencyMin ||
                      isSavingMonitor ||
                      isLoadingTrackingOptions
                    }
                    className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingMonitor && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
                    {isSavingMonitor
                      ? 'Guardando seguimiento…'
                      : selectedConfigId
                        ? selectedMonitor
                          ? 'Guardar frecuencia'
                          : 'Iniciar seguimiento'
                        : selectedMonitor
                          ? 'Guardar frecuencia'
                          : 'Iniciar seguimiento automático'}
              </button>
          </section>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setOfferError(null);
                setIsPublishDialogOpen(true);
              }}
              className="inline-flex min-h-12 items-center justify-center rounded-lg bg-primary-container px-4 py-2.5 text-sm font-semibold text-on-primary-container hover:bg-primary"
            >
              Publicar oferta
            </button>
            <Link
              to={`/builder?productId=${encodeURIComponent(product.id)}`}
              state={location.state}
              className="inline-flex min-h-12 items-center justify-center rounded-lg bg-primary-container px-4 py-2.5 text-sm font-semibold text-on-primary-container hover:bg-primary"
            >
              Volver al constructor
            </Link>
          </div>
        </div>
      </section>
      {isPublishDialogOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="publish-offer-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-on-surface/40 p-4"
        >
          <section className="w-full max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-5 shadow-xl">
            <h2 id="publish-offer-title" className="text-lg font-semibold text-on-surface">
              Publicar oferta
            </h2>
            <p className="mt-2 text-sm text-on-surface-variant">
              Se publicarán los datos guardados de «{product.name}»
              {currentPrice ? ` con precio ${currentPrice}` : ''}. No tendrás que volver a capturarlos.
            </p>
            {offerError && <p role="alert" className="mt-3 text-sm text-error">{offerError}</p>}
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                disabled={isPublishingOffer}
                onClick={() => setIsPublishDialogOpen(false)}
                className="min-h-10 rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isPublishingOffer}
                onClick={() => void handlePublishOffer()}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container disabled:cursor-wait disabled:opacity-60"
              >
                {isPublishingOffer && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
                {isPublishingOffer ? 'Publicando…' : 'Confirmar publicación'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function formatPrice(value: number | null, currency: string | null): string | null {
  if (value === null) return null;
  return `${value.toLocaleString()}${currency ? ` ${currency}` : ''}`;
}

const inputClass =
  'mt-1.5 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';
