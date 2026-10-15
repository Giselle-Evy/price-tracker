import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, ImageOff, Tag } from 'lucide-react';

export type OfferCardData = {
  id: string;
  title: string;
  originalUrl: string;
  publishedAt: string;
  imageUrl?: string | null;
  description?: string | null;
  price?: number | null;
  previousPrice?: number | null;
  currency?: string | null;
};

type Props = {
  offer: OfferCardData;
};

function formatPrice(value: number, currency?: string | null): string {
  if (currency && /^[A-Z]{3}$/.test(currency)) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
      }).format(value);
    } catch {
      // Unknown currency codes are shown alongside the numeric value.
    }
  }

  const formatted = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(value);

  return currency ? `${formatted} ${currency}` : formatted;
}

function getSafeExternalUrl(rawUrl: string): URL | null {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

export default function OfferCard({ offer }: Props) {
  const [imageFailed, setImageFailed] = useState(false);
  const externalUrl = getSafeExternalUrl(offer.originalUrl);
  const price =
    typeof offer.price === 'number' &&
    Number.isFinite(offer.price) &&
    offer.price >= 0
      ? offer.price
      : null;
  const previousPrice =
    typeof offer.previousPrice === 'number' &&
    Number.isFinite(offer.previousPrice) &&
    offer.previousPrice > 0
      ? offer.previousPrice
      : null;
  const discount =
    price !== null && previousPrice !== null && previousPrice > price
      ? Math.round(((previousPrice - price) / previousPrice) * 100)
      : null;
  const publishedDate = new Date(offer.publishedAt);
  const hasPublishedDate = Number.isFinite(publishedDate.getTime());

  return (
    <article className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest transition-shadow hover:shadow-md">
      <div className="flex flex-col sm:flex-row">
        <div className="flex aspect-[4/3] shrink-0 items-center justify-center overflow-hidden bg-surface-container-low sm:aspect-square sm:w-48">
          {offer.imageUrl && !imageFailed ? (
            <img
              src={offer.imageUrl}
              alt={offer.title}
              loading="lazy"
              className="h-full w-full object-contain p-4"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <ImageOff
              aria-hidden="true"
              className="h-8 w-8 text-outline"
            />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
            {hasPublishedDate && (
              <time dateTime={publishedDate.toISOString()}>
                {new Intl.DateTimeFormat(undefined, {
                  dateStyle: 'medium',
                }).format(publishedDate)}
              </time>
            )}
            {externalUrl && (
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="h-1 w-1 rounded-full bg-outline" />
                {externalUrl.hostname}
              </span>
            )}
          </div>

          <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-6 text-on-surface">
            {offer.title}
          </h3>
          {offer.description && (
            <p className="mt-2 line-clamp-2 text-sm leading-5 text-on-surface-variant">
              {offer.description}
            </p>
          )}

          {price !== null && (
            <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-xl font-bold tracking-tight text-on-surface">
                {formatPrice(price, offer.currency)}
              </span>
              {discount !== null && previousPrice !== null && (
                <>
                  <span className="text-sm text-on-surface-variant line-through">
                    {formatPrice(previousPrice, offer.currency)}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    <Tag aria-hidden="true" className="h-3.5 w-3.5" />
                    -{discount}%
                  </span>
                </>
              )}
            </div>
          )}

          {externalUrl && (
            <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-2 pt-5">
              <Link
                to={`/offers/${encodeURIComponent(offer.id)}`}
                className="inline-flex items-center text-sm font-semibold text-primary hover:text-primary/80"
              >
                Ver detalle
              </Link>
              <a
                href={externalUrl.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80"
              >
                Ir a la oferta
                <ExternalLink aria-hidden="true" className="h-4 w-4" />
              </a>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
