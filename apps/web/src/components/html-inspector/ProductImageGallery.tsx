import { useState } from 'react';
import { ImageOff } from 'lucide-react';

export type ProductImagePreview = {
  url: string;
  alt: string | null;
  source?: string;
  order?: number;
};

type Props = {
  images: ProductImagePreview[];
  productName?: string | null;
  emptyMessage: string;
  selectedUrls?: string[];
  primaryUrl?: string | null;
  onSelectionChange?: (urls: string[]) => void;
  onPrimaryChange?: (url: string | null) => void;
};

export default function ProductImageGallery({
  images,
  productName,
  emptyMessage,
  selectedUrls,
  primaryUrl,
  onSelectionChange,
  onPrimaryChange,
}: Props) {
  const [internalIncludedUrls, setInternalIncludedUrls] = useState<Set<string>>(
    () => new Set(images.map((image) => image.url))
  );
  const [internalPrimaryUrl, setInternalPrimaryUrl] = useState<string | null>(
    () => images[0]?.url ?? null
  );
  const [failedUrls, setFailedUrls] = useState<Set<string>>(() => new Set());
  const includedUrls = selectedUrls
    ? new Set(selectedUrls)
    : internalIncludedUrls;
  const selectedPrimaryUrl = primaryUrl === undefined
    ? internalPrimaryUrl
    : primaryUrl;

  const selectedImages = images.filter((image) => includedUrls.has(image.url));
  const primaryImage =
    selectedImages.find(
      (image) => image.url === selectedPrimaryUrl && !failedUrls.has(image.url)
    ) ??
    selectedImages.find((image) => !failedUrls.has(image.url));
  const loadedCount = images.length - failedUrls.size;

  function toggleIncluded(url: string) {
    const next = new Set(includedUrls);
    if (next.has(url)) next.delete(url);
    else next.add(url);

    if (onSelectionChange) onSelectionChange([...next]);
    else setInternalIncludedUrls(next);

    if (!next.has(selectedPrimaryUrl ?? '') || !selectedPrimaryUrl) {
      const nextPrimary = [...next][0] ?? null;
      if (onPrimaryChange) onPrimaryChange(nextPrimary);
      else setInternalPrimaryUrl(nextPrimary);
    }
  }

  function selectPrimary(url: string) {
    if (onPrimaryChange) onPrimaryChange(url);
    else setInternalPrimaryUrl(url);
  }

  function markFailed(url: string) {
    const nextFailedUrls = new Set(failedUrls);
    nextFailedUrls.add(url);
    setFailedUrls(nextFailedUrls);

    if (selectedPrimaryUrl === url) {
      const fallbackUrl =
        selectedImages.find(
          (image) => image.url !== url && !nextFailedUrls.has(image.url)
        )?.url ?? null;
      if (onPrimaryChange) onPrimaryChange(fallbackUrl);
      else setInternalPrimaryUrl(fallbackUrl);
    }
  }

  return (
    <div className="min-w-0">
      <div className="flex min-h-48 items-center justify-center overflow-hidden rounded-xl bg-surface-container-low p-3 sm:min-h-56">
        {primaryImage && !failedUrls.has(primaryImage.url) ? (
          <img
            key={primaryImage.url}
            src={primaryImage.url}
            alt={primaryImage.alt || productName || 'Imagen del producto'}
            className="max-h-64 w-full object-contain"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => markFailed(primaryImage.url)}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 px-3 text-center text-sm text-on-surface-variant">
            <ImageOff aria-hidden="true" className="h-8 w-8" />
            {selectedImages.length === 0 ? emptyMessage : 'No se pudo cargar la imagen seleccionada.'}
          </div>
        )}
      </div>

      {images.length > 0 && (
        <div className="mt-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-on-surface-variant">
              {images.length} imagen{images.length === 1 ? '' : 'es'} identificada{images.length === 1 ? '' : 's'}
              {loadedCount < images.length && ` · ${failedUrls.size} no cargaron`}
            </p>
            <p className="text-xs text-on-surface-variant">
              {selectedImages.length} incluida{selectedImages.length === 1 ? '' : 's'}
            </p>
          </div>

          <ul aria-label="Galería de imágenes del producto" className="flex flex-wrap gap-2">
            {images.map((image, index) => {
              const included = includedUrls.has(image.url);
              const failed = failedUrls.has(image.url);

              return (
                <li
                  key={`${image.url}-${index}`}
                  className={`w-[4.5rem] rounded-lg border p-1 ${
                    included
                      ? 'border-outline-variant bg-surface-container-low'
                      : 'border-outline-variant/60 opacity-60'
                  }`}
                >
                  <button
                    type="button"
                    disabled={failed || !included}
                    aria-label={`Usar imagen ${index + 1} como principal`}
                    aria-pressed={primaryImage?.url === image.url}
                    onClick={() => selectPrimary(image.url)}
                    className="flex h-14 w-full items-center justify-center overflow-hidden rounded-md focus-visible:outline-primary disabled:cursor-not-allowed"
                  >
                    {failed ? (
                      <ImageOff aria-hidden="true" className="h-5 w-5 text-outline" />
                    ) : (
                      <img
                        src={image.url}
                        alt=""
                        className="h-full w-full object-contain"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={() => markFailed(image.url)}
                      />
                    )}
                  </button>
                  <label className="mt-1 flex cursor-pointer items-center justify-center gap-1 text-[10px] text-on-surface-variant">
                    <input
                      type="checkbox"
                      checked={included}
                      onChange={() => toggleIncluded(image.url)}
                      className="accent-primary"
                      aria-label={`Incluir imagen ${index + 1}`}
                    />
                    Incluir
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
