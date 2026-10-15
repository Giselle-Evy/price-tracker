import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Plus, Search, ShoppingBag } from 'lucide-react';
import { api, type ApiError } from '../lib/api';
import OfferCard, { type OfferCardData } from '../components/offers/OfferCard';

type OffersResponse = {
  offers: OfferCardData[];
  pagination: { page: number; totalPages: number };
};

export default function HomePage() {
  const [offers, setOffers] = useState<OfferCardData[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    api.get<OffersResponse>(`/offers?page=${page}&limit=20`)
      .then((response) => {
        if (cancelled) return;
        setOffers((current) =>
          page === 1 ? response.offers : [...current, ...response.offers]
        );
        setTotalPages(response.pagination.totalPages);
      })
      .catch((requestError: ApiError) => {
        if (!cancelled) {
          setError(requestError.error || 'No se pudieron cargar las ofertas.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-10 lg:px-10">
      <section className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest">
        <div className="grid gap-7 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:p-10">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Comunidad de ofertas
            </span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-on-surface sm:text-4xl">
              Buenas compras empiezan aquí.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-on-surface-variant sm:text-base">
              Descubre productos compartidos por la comunidad y sigue los
              precios que te interesan, todo en un mismo lugar.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 sm:flex-row lg:flex-col lg:items-stretch">
            <Link
              to="/builder"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary-container px-4 py-2.5 text-sm font-semibold text-on-primary-container shadow-sm"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              Publicar oferta
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-outline-variant bg-surface-container-low/60 px-6 py-3 text-xs text-on-surface-variant sm:px-8">
          <span className="inline-flex items-center gap-2">
            <ShoppingBag aria-hidden="true" className="h-4 w-4 text-secondary" />
            Ofertas compartidas por personas
          </span>
          <span className="inline-flex items-center gap-2">
            <Bell aria-hidden="true" className="h-4 w-4 text-secondary" />
            Seguimientos de precio a tu ritmo
          </span>
        </div>
      </section>

      <section aria-labelledby="offers-heading" className="mt-9 sm:mt-11">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-outline-variant pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
              De la comunidad
            </p>
            <h2
              id="offers-heading"
              className="mt-1 text-xl font-semibold tracking-tight text-on-surface sm:text-2xl"
            >
              Todas las ofertas
            </h2>
          </div>
          <span className="text-sm text-on-surface-variant">
            {offers.length} {offers.length === 1 ? 'oferta publicada' : 'ofertas publicadas'}
          </span>
        </div>

        {error ? (
          <div role="alert" className="mt-6 rounded-xl bg-error-container p-4 text-sm text-on-error-container">
            {error}
          </div>
        ) : offers.length > 0 ? (
          <div className="mt-6 space-y-4">
            {offers.map((offer) => <OfferCard key={offer.id} offer={offer} />)}
            {page < totalPages && (
              <div className="pt-3 text-center">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => setPage((current) => current + 1)}
                  className="inline-flex min-h-10 items-center rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface hover:bg-surface-container disabled:opacity-60"
                >
                  {isLoading ? 'Cargando…' : 'Cargar más ofertas'}
                </button>
              </div>
            )}
          </div>
        ) : isLoading ? (
          <p role="status" className="py-12 text-center text-sm text-on-surface-variant">
            Cargando ofertas…
          </p>
        ) : (
          <div className="py-12 sm:py-16">
            <div className="mx-auto flex max-w-lg flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-container-low text-secondary">
                <Search aria-hidden="true" className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-on-surface">
                Aún no hay ofertas publicadas
              </h3>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                Las ofertas reales de la comunidad aparecerán aquí con sus precios y enlaces originales.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
