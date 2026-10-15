
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
  type FormEvent,
} from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import {
  Globe,
  Search,
  Loader2,
  AlertCircle,
  Clock,
  Server,
  FileCode,
  CheckCircle2,
  X,
  Sparkles,
  Pencil,
} from 'lucide-react';

import { api, type ApiError } from '../lib/api';
import HtmlInspector from '../components/html-inspector/HtmlInspector';
import AddFieldModal, {
  type NewField,
} from '../components/html-inspector/AddFieldModal';

import FieldsPanel, {
  type ExtractField,
  type JsonValue,
} from '../components/html-inspector/FieldsPanel';

import ExtractionResults from '../components/html-inspector/ExtractionResults';
import type { ProductImagePreview } from '../components/html-inspector/ProductImageGallery';
import ProductConfirmationForm from '../components/products/ProductConfirmationForm';
import type {
  BuilderDraftState,
  SavedProduct,
} from '../components/products/productTypes';
import {
  getProductFieldKind,
  mergeManualProductFields,
  mergeManualProductImages,
  type ProductFieldKind,
} from '../components/products/productFields';
import SaveConfigModal from '../components/html-inspector/SaveConfigModal';
import {
  runExtraction,
  type ExtractionResult,
} from '../components/html-inspector/utils/runExtraction';

type AnalyzeResponse = {
  url: string;
  finalUrl: string;
  html: string;
  statusCode: number;
  contentType: string;
  durationMs: number;
  method: 'cheerio' | 'playwright';
  htmlSize: number;
  detectedFields: {
    label: string;
    selector: string;
    attribute: string | null;
    type: 'text' | 'price' | 'image' | 'url';
    value: string;
  }[];
  productImages: ProductImagePreview[];
  imageGalleryStatus: 'found' | 'partial' | 'not_found';
  expectedImageCount: number | null;
  rejectedImageCount: number;
};

type ProductFieldLabel =
  | 'Nombre del producto'
  | 'Precio antiguo'
  | 'Precio nuevo'
  | 'Imagen del producto'
  | 'Descripción'
  | 'Moneda';

type DetectedProductField = Omit<
  AnalyzeResponse['detectedFields'][number],
  'label' | 'type'
> & {
  label: ProductFieldLabel;
  type: 'text' | 'price' | 'image';
};

/**
 * Utiliza la clasificación centralizada para evitar que el constructor
 * interprete un precio anterior como si fuera el precio actual.
 */
function canonicalProductLabel(label: string): ProductFieldLabel | null {
  const kind = getProductFieldKind(label);

  if (!kind) return null;

  const canonicalLabels: Record<ProductFieldKind, ProductFieldLabel> = {
    name: 'Nombre del producto',
    previousPrice: 'Precio antiguo',
    currentPrice: 'Precio nuevo',
    image: 'Imagen del producto',
    description: 'Descripción',
    currency: 'Moneda',
  };

  return canonicalLabels[kind];
}

function prepareDetectedFields(
  detectedFields: AnalyzeResponse['detectedFields'],
): DetectedProductField[] {
  return detectedFields.flatMap((field) => {
    const label = canonicalProductLabel(field.label);

    if (!label) return [];

    const type: DetectedProductField['type'] =
      label === 'Imagen del producto'
        ? 'image'
        : label === 'Precio antiguo' || label === 'Precio nuevo'
          ? 'price'
          : 'text';

    return [{ ...field, label, type }];
  });
}

type ConfigFieldDto = {
  id: string;
  label: string;
  selector: string;
  attribute: string | null;
  type: 'text' | 'price' | 'image' | 'url';
  transform: JsonValue | null;
  isPrimary: boolean;
  orderIndex: number;
};

type ConfigDto = {
  id: string;
  userId: string;
  name: string;
  sourceUrl: string;
  sourceDomain: string;
  status: 'draft' | 'active' | 'error' | 'archived';
  createdAt: string;
  updatedAt: string;
  fields: ConfigFieldDto[];
};

type ConfigSuggestionState =
  | { hostname: string; status: 'loading' }
  | { hostname: string; status: 'loaded'; configs: ConfigDto[] }
  | { hostname: string; status: 'error'; message: string };

function getHttpHostname(value: string): string | null {
  try {
    const parsed = new URL(value.trim());

    if (!['http:', 'https:'].includes(parsed.protocol)) return null;

    return parsed.hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return null;
  }
}

function getConfigHostname(config: ConfigDto): string | null {
  return (
    getHttpHostname(`https://${config.sourceDomain}`) ??
    getHttpHostname(config.sourceUrl)
  );
}

function isConfigHostnameMatch(hostname: string, config: ConfigDto): boolean {
  const configHostname = getConfigHostname(config);

  if (!configHostname) return false;

  return (
    hostname === configHostname ||
    hostname.endsWith(`.${configHostname}`)
  );
}

export default function BuilderPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const accessToken = useAuthStore((state) => state.accessToken);

  // El modo edición se determina una sola vez.
  const [configId] = useState<string | null>(
    () => searchParams.get('configId'),
  );

  const isEditMode = configId !== null;
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [savedProduct, setSavedProduct] = useState<SavedProduct | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingConfigName, setEditingConfigName] = useState('');
  const [fields, setFields] = useState<ExtractField[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSelector, setModalSelector] = useState('');
  const [modalAttribute, setModalAttribute] = useState<string | undefined>();
  const [extractionResults, setExtractionResults] = useState<
    ExtractionResult[] | null
  >(null);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [furthestStep, setFurthestStep] = useState(1);
  const [configSuggestionState, setConfigSuggestionState] =
    useState<ConfigSuggestionState | null>(null);
  const [appliedConfig, setAppliedConfig] = useState<ConfigDto | null>(null);
  const [dismissedSuggestionHostname, setDismissedSuggestionHostname] =
    useState<string | null>(null);

  const bootstrappedRef = useRef(false);
  const manualFieldsChangedRef = useRef(false);

  const confirmationFields = useMemo(
    () =>
      result
        ? mergeManualProductFields(result.detectedFields, extractionResults)
        : [],
    [result, extractionResults]
  );

  const confirmationImages = useMemo(() => {
    if (!result) return [];

    const manuallyTestedImages = extractionResults?.some(
      (extraction) =>
        (extraction.status === 'success' || extraction.status === 'warning') &&
        extraction.values.length > 0 &&
        (extraction.type === 'image' ||
          getProductFieldKind(extraction.label) === 'image')
    );

    if (savedProduct && !manuallyTestedImages) {
      return savedProduct.images;
    }

    return mergeManualProductImages(result.productImages, extractionResults);
  }, [result, extractionResults, savedProduct]);

  // Analizar una URL y detectar campos automáticamente.
  const runAnalyze = useCallback(async (
    urlToAnalyze: string,
    options?: {
      preserveFields?: boolean;
      includeDetectedFields?: boolean;
      extractFields?: ExtractField[];
      step?: 2 | 3;
    },
  ) => {
    setError(null);
    setResult(null);
    setExtractionResults(null);
    setIsLoading(true);

    // Al analizar otro producto, comenzar con campos limpios.
    // En modo edición, conservar los campos guardados.
    if (!options?.preserveFields) {
      setFields([]);
    }

    try {
      const data = await api.post<AnalyzeResponse>('/analyze', {
        url: urlToAnalyze,
      });

      setResult(data);

      const analyzedStep = options?.step ?? 2;
      setCurrentStep(analyzedStep);
      setFurthestStep(analyzedStep);

      if (options?.extractFields) {
        setExtractionResults(
          runExtraction(
            data.html,
            options.extractFields,
            data.finalUrl,
            data.productImages.map((image) => image.url)
          )
        );
      }

      if (options?.includeDetectedFields === false) return;

      const normalizedFields = prepareDetectedFields(data.detectedFields);

      setFields((previousFields) => {
        const existingLabels = new Set(
          previousFields.map(
            (field) =>
              canonicalProductLabel(field.label) ??
              field.label.trim().toLowerCase(),
          ),
        );

        const newFields: ExtractField[] = normalizedFields
          .filter((field) => !existingLabels.has(field.label))
          .map((field) => ({
            id: crypto.randomUUID(),
            label: field.label,
            selector: field.selector,
            attribute: field.attribute ?? undefined,
            type: field.type,
          }));

        return [...previousFields, ...newFields];
      });
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.error || 'Error al analizar la URL');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isEditMode || editingProductId || !accessToken) return;

    const hostname = getHttpHostname(url);

    if (!hostname) return;

    let cancelled = false;

    const timeoutId = window.setTimeout(() => {
      setConfigSuggestionState({ hostname, status: 'loading' });

      api
        .get<{ configs: ConfigDto[] }>('/configs', accessToken)
        .then(({ configs }) => {
          if (cancelled) return;

          const compatible = configs
            .filter(
              (config) =>
                isConfigHostnameMatch(hostname, config) &&
                config.fields.length > 0
            )
            .sort(
              (left, right) =>
                new Date(right.updatedAt).getTime() -
                new Date(left.updatedAt).getTime()
            );

          setConfigSuggestionState({
            hostname,
            status: 'loaded',
            configs: compatible,
          });
        })
        .catch((requestError: ApiError) => {
          if (!cancelled) {
            setConfigSuggestionState({
              hostname,
              status: 'error',
              message:
                requestError.error ||
                'No se pudieron cargar las configuraciones guardadas.',
            });
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [accessToken, editingProductId, isEditMode, url]);

  // Cargar parámetros iniciales y configuraciones existentes.
  useEffect(() => {
    if (bootstrappedRef.current) return;

    const urlParam = searchParams.get('url');
    const autorun = searchParams.get('autorun');
    const configIdParam = searchParams.get('configId');
    const productIdParam = searchParams.get('productId');

    if (!urlParam && !configIdParam && !productIdParam) return;

    bootstrappedRef.current = true;

    queueMicrotask(async () => {
      setSearchParams({}, { replace: true });

      if (productIdParam) {
        try {
          const existingProduct = await api.get<SavedProduct>(
            `/products/${productIdParam}`,
            accessToken,
          );

          setSavedProduct(existingProduct);
          setEditingProductId(existingProduct.id);
          setUrl(existingProduct.originalUrl);

          const builderDraft = (
            location.state as { builderDraft?: BuilderDraftState } | null
          )?.builderDraft;

          if (builderDraft?.fields) {
            setFields(
              builderDraft.fields.map((field) => ({
                ...field,
                id: crypto.randomUUID(),
              }))
            );
          }

          await runAnalyze(existingProduct.originalUrl, {
            preserveFields: Boolean(builderDraft?.fields.length),
          });
        } catch (err) {
          const apiError = err as ApiError;
          setError(apiError.error || 'Error al cargar el producto guardado');
        }

        return;
      }

      if (configIdParam) {
        try {
          const existing = await api.get<ConfigDto>(
            `/configs/${configIdParam}`,
            accessToken,
          );

          setEditingConfigName(existing.name);
          setUrl(existing.sourceUrl);

          const mapped: ExtractField[] = existing.fields
            .slice()
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((field) => ({
              id: crypto.randomUUID(),
              label: field.label,
              selector: field.selector,
              attribute: field.attribute ?? undefined,
              type: field.type,
              transform: field.transform,
              isPrimary: field.isPrimary,
            }));

          setFields(mapped);

          if (autorun === '1' || urlParam) {
            void runAnalyze(existing.sourceUrl, {
              preserveFields: true,
              includeDetectedFields: false,
              extractFields: mapped,
            });
          }
        } catch (err) {
          const apiError = err as ApiError;
          setError(apiError.error || 'Error al cargar la configuración');
        }
      } else if (urlParam) {
        setUrl(urlParam);

        if (autorun === '1') {
          void runAnalyze(urlParam);
        }
      }
    });

    // The ref prevents reruns after the query string is cleared.
  }, [accessToken, location.state, runAnalyze, searchParams, setSearchParams]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const normalizedUrl = url.trim();

    if (!normalizedUrl) return;

    try {
      const parsedUrl = new URL(normalizedUrl);

      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('invalid protocol');
      }
    } catch {
      setError('Introduce una URL válida que use HTTP o HTTPS.');
      return;
    }

    const preservesAppliedConfig =
      appliedConfig !== null &&
      getConfigHostname(appliedConfig) === getHttpHostname(normalizedUrl);

    if (appliedConfig && !preservesAppliedConfig) {
      setAppliedConfig(null);
      manualFieldsChangedRef.current = false;
    }

    await runAnalyze(normalizedUrl, {
      preserveFields: isEditMode || preservesAppliedConfig,
      includeDetectedFields: !isEditMode && !preservesAppliedConfig,
      extractFields:
        isEditMode || preservesAppliedConfig ? fields : undefined,
    });
  }

  function handleClear() {
    setUrl('');
    setResult(null);
    setError(null);
    setCurrentStep(1);
    setFurthestStep(1);
    setFields([]);
    setExtractionResults(null);
    setSavedProduct(null);
    setEditingProductId(null);
    setAppliedConfig(null);
    setDismissedSuggestionHostname(null);
    manualFieldsChangedRef.current = false;
  }

  function handleAnalyzeAnother() {
    setResult(null);
    setError(null);
    setCurrentStep(1);
    setFurthestStep(1);
    setUrl('');
    setFields([]);
    setExtractionResults(null);
    setSavedProduct(null);
    setEditingProductId(null);
    setAppliedConfig(null);
    setDismissedSuggestionHostname(null);
    manualFieldsChangedRef.current = false;
  }

  function handleOpenAddField(
    selector: string,
    suggestedAttribute?: string,
  ) {
    setModalSelector(selector);
    setModalAttribute(suggestedAttribute);
    setModalOpen(true);
  }

  function handleConfirmAddField(newField: NewField) {
    manualFieldsChangedRef.current = true;

    setFields((previousFields) => [
      ...previousFields,
      {
        id: crypto.randomUUID(),
        ...newField,
      },
    ]);

    setExtractionResults(null);
    setModalOpen(false);
  }

  function handleRemoveField(id: string) {
    manualFieldsChangedRef.current = true;

    setFields((previousFields) =>
      previousFields.filter((field) => field.id !== id),
    );

    setExtractionResults(null);
  }

  function handleUpdateSelector(id: string, selector: string) {
    manualFieldsChangedRef.current = true;

    setFields((previousFields) =>
      previousFields.map((field) =>
        field.id === id ? { ...field, selector } : field
      )
    );

    setExtractionResults(null);
  }

  async function handleUseSavedConfig(config: ConfigDto) {
    if (
      manualFieldsChangedRef.current &&
      !window.confirm(
        'Ya modificaste campos o selectores. ¿Quieres reemplazarlos por los de esta configuración guardada?'
      )
    ) {
      return;
    }

    const mappedFields: ExtractField[] = config.fields
      .slice()
      .sort((left, right) => left.orderIndex - right.orderIndex)
      .map((field) => ({
        id: crypto.randomUUID(),
        label: field.label,
        selector: field.selector,
        attribute: field.attribute ?? undefined,
        type: field.type,
        transform: field.transform,
        isPrimary: field.isPrimary,
      }));

    manualFieldsChangedRef.current = false;
    setAppliedConfig(config);
    setFields(mappedFields);
    setExtractionResults(null);

    await runAnalyze(url.trim(), {
      preserveFields: true,
      includeDetectedFields: false,
      extractFields: mappedFields,
      step: 3,
    });
  }

  function handleTestExtraction() {
    if (!result) return;

    const extraction = runExtraction(
      result.html,
      fields,
      result.finalUrl,
      result.productImages.map((image) => image.url)
    );

    setExtractionResults(extraction);
  }

  function handleOpenSaveConfig() {
    setSaveError(null);
    setSaveModalOpen(true);
  }

  async function handleSaveConfig(name: string) {
    if (!result || fields.length === 0) return;

    setIsSavingConfig(true);
    setSaveError(null);

    try {
      const payload = {
        name,
        sourceUrl: result.url,
        fields: fields.map((field, index) => ({
          label: field.label,
          selector: field.selector,
          attribute: field.attribute || undefined,
          type: field.type,
          transform: field.transform,
          isPrimary: field.isPrimary ?? false,
          orderIndex: index,
        })),
      };

      if (isEditMode && configId) {
        await api.patch(
          `/configs/${configId}`,
          payload,
          accessToken,
        );

        setSaveModalOpen(false);
        navigate(`/configs/${configId}`);
      } else {
        const created = await api.post<{ id: string }>(
          '/configs',
          payload,
          accessToken,
        );

        setSaveModalOpen(false);
        navigate(`/configs/${created.id}`);
      }
    } catch (err) {
      const apiError = err as ApiError;
      setSaveError(apiError.error || 'Error al guardar la configuración');
    } finally {
      setIsSavingConfig(false);
    }
  }

  const suggestedConfigName = isEditMode
    ? editingConfigName
    : result?.finalUrl
      ? `Config ${new URL(result.finalUrl).hostname}`
      : 'Nueva configuración';

  const pageTitle = isEditMode
    ? 'Editando configuración'
    : 'Asistente de importación';

  const pageSubtitle = isEditMode
    ? 'Modificá los campos o la URL y guardá los cambios.'
    : 'Pega la URL de un producto para detectar su nombre, precio antiguo, precio nuevo e imagen.';

  const suggestionHostname = getHttpHostname(url);

  const currentConfigSuggestionState =
    configSuggestionState?.hostname === suggestionHostname
      ? configSuggestionState
      : null;

  const matchingConfigs =
    currentConfigSuggestionState?.status === 'loaded'
      ? currentConfigSuggestionState.configs
      : [];

  const showConfigSuggestions =
    Boolean(suggestionHostname) &&
    dismissedSuggestionHostname !== suggestionHostname;

  function goToStep(step: number) {
    if (!result || step < 1 || step > furthestStep) return;
    setCurrentStep(step);
  }

  function continueToStep(step: number) {
    if (!result || step < 1 || step > 4) return;

    setFurthestStep((furthest) => Math.max(furthest, step));
    setCurrentStep(step);
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary-container">
            {isEditMode ? (
              <Pencil className="w-5 h-5 text-on-primary-container" />
            ) : (
              <Sparkles className="w-5 h-5 text-on-primary-container" />
            )}
          </div>

          <h1 className="text-3xl font-bold text-on-surface">
            {pageTitle}
          </h1>
        </div>

        <p className="text-on-surface-variant">{pageSubtitle}</p>
      </div>

      <nav
        aria-label="Progreso del constructor"
        className="mb-8 rounded-xl border border-outline-variant bg-surface-container-lowest p-3 sm:p-4"
      >
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            'Ingresar URL',
            'Revisar información',
            'Configurar selectores',
            'Confirmar y guardar',
          ].map((label, index) => {
            const step = index + 1;
            const isCurrent = currentStep === step;
            const isComplete = step < currentStep;
            const isAvailable = step <= furthestStep && Boolean(result);

            return (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => goToStep(step)}
                  disabled={!isAvailable || isCurrent}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`flex min-h-12 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors sm:text-sm ${
                    isCurrent
                      ? 'bg-primary-container text-on-primary-container'
                      : isComplete
                        ? 'bg-surface-container text-on-surface'
                        : 'text-on-surface-variant'
                  } disabled:cursor-default disabled:opacity-80 enabled:hover:bg-surface-container`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      isCurrent
                        ? 'bg-primary text-white'
                        : isComplete
                          ? 'bg-secondary text-white'
                          : 'bg-surface-container-high text-on-surface-variant'
                    }`}
                  >
                    {isComplete ? '✓' : step}
                  </span>

                  <span>{label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <form
        onSubmit={handleSubmit}
        className={`mb-6 ${currentStep === 1 ? '' : 'hidden'}`}
      >
        <label
          htmlFor="builder-url"
          className="mb-2 block text-sm font-semibold text-on-surface"
        >
          URL de la página del producto
        </label>

        <div className="flex gap-3">
          <div className="relative flex items-center flex-1">
            <Globe className="absolute left-3 w-5 h-5 text-secondary pointer-events-none" />

            <input
              id="builder-url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://ejemplo.com/producto"
              required
              disabled={isLoading}
              className="w-full pl-10 pr-12 py-3.5 bg-surface-container-lowest text-on-surface placeholder:text-outline text-sm rounded-lg border border-outline-variant focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all disabled:opacity-60"
            />

            {url && !isLoading && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3 p-1.5 rounded-md text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
                aria-label="Limpiar URL"
                title="Limpiar"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || !url.trim()}
            className="px-6 py-3.5 bg-primary-container hover:bg-primary text-on-primary-container font-semibold text-sm rounded-lg flex items-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analizando...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Analizar página
              </>
            )}
          </button>
        </div>

        {showConfigSuggestions && (
          <section
            aria-label="Configuraciones compatibles"
            className="mt-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4"
          >
            {currentConfigSuggestionState?.status === 'loading' ? (
              <p
                role="status"
                className="flex items-center gap-2 text-sm text-on-surface-variant"
              >
                <Loader2
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin"
                />
                Buscando configuraciones para {suggestionHostname}…
              </p>
            ) : currentConfigSuggestionState?.status === 'error' ? (
              <div
                role="alert"
                className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-sm text-error">
                  {currentConfigSuggestionState.message}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setDismissedSuggestionHostname(suggestionHostname)
                  }
                  className="text-left text-sm font-semibold text-primary hover:underline"
                >
                  Configurar manualmente
                </button>
              </div>
            ) : matchingConfigs.length > 0 ? (
              <>
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                  <h2 className="text-sm font-semibold text-on-surface">
                    Configuraciones guardadas para este dominio
                  </h2>

                  <span className="text-xs text-on-surface-variant">
                    {suggestionHostname}
                  </span>
                </div>

                <ul className="space-y-2">
                  {matchingConfigs.map((config) => (
                    <li
                      key={config.id}
                      className="flex flex-col gap-3 rounded-lg border border-outline-variant bg-surface-container-low p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-on-surface">
                          {config.name}
                        </p>

                        <p className="mt-1 text-xs text-on-surface-variant">
                          {config.sourceDomain} · {config.fields.length} campos
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleUseSavedConfig(config)}
                        className="shrink-0 rounded-lg bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container transition hover:bg-primary"
                      >
                        Usar configuración
                      </button>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() =>
                    setDismissedSuggestionHostname(suggestionHostname)
                  }
                  className="mt-3 text-sm font-medium text-secondary hover:text-on-surface"
                >
                  Configurar manualmente
                </button>
              </>
            ) : null}
          </section>
        )}
      </form>

      {error && (
        <div className="mb-6 flex items-start gap-3 p-4 rounded-lg bg-error-container text-on-error-container text-sm">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />

          <div className="flex-1">
            <strong className="font-semibold block mb-1">
              No se pudo analizar la URL
            </strong>

            <p className="text-sm opacity-90">{error}</p>
          </div>

          <button
            type="button"
            onClick={handleClear}
            className="p-1 rounded text-on-error-container hover:bg-on-error-container/10 transition-colors"
            aria-label="Cerrar error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {currentStep === 1 && !isLoading && !error && !result && (
        <div className="bg-surface-container-lowest rounded-xl border border-dashed border-outline-variant p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-surface-container mb-4">
            <Globe className="w-8 h-8 text-outline" />
          </div>

          <h2 className="text-lg font-semibold text-on-surface mb-2">
            Esperando una URL
          </h2>

          <p className="text-on-surface-variant text-sm max-w-md mx-auto">
            Pega la URL de un producto en el campo de arriba y pulsa
            &quot;Analizar&quot; para inspeccionar su contenido.
          </p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className={currentStep === 2 ? 'space-y-4' : 'hidden'}>
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant bg-surface-container-low">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary-container" />

                  <h2 className="text-sm font-semibold text-on-surface">
                    Análisis completado
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={handleAnalyzeAnother}
                  className="text-xs font-medium text-primary-container hover:text-primary transition-colors flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  Analizar otra URL
                </button>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <Metric
                    icon={<Server className="w-4 h-4 text-secondary" />}
                    label="Status HTTP"
                    value={result.statusCode}
                  />

                  <Metric
                    icon={<FileCode className="w-4 h-4 text-secondary" />}
                    label="Método"
                    value={
                      result.method.charAt(0).toUpperCase() +
                      result.method.slice(1)
                    }
                  />

                  <Metric
                    icon={<Clock className="w-4 h-4 text-secondary" />}
                    label="Duración"
                    value={`${result.durationMs} ms`}
                  />

                  <Metric
                    icon={<FileCode className="w-4 h-4 text-secondary" />}
                    label="Tamaño HTML"
                    value={`${(result.htmlSize / 1024).toFixed(1)} KB`}
                  />
                </div>

                <div className="space-y-3 pt-4 border-t border-outline-variant">
                  <div>
                    <p className="text-xs text-on-surface-variant mb-1">
                      URL solicitada
                    </p>

                    <p className="text-sm font-mono text-on-surface break-all">
                      {result.url}
                    </p>
                  </div>

                  {result.finalUrl !== result.url && (
                    <div>
                      <p className="text-xs text-on-surface-variant mb-1">
                        URL final (tras redirects)
                      </p>

                      <p className="text-sm font-mono text-on-surface break-all">
                        {result.finalUrl}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DetectedFieldsDetails
              fields={result.detectedFields}
              baseUrl={result.finalUrl}
            />
          </div>

          <div className={currentStep === 4 ? '' : 'hidden'}>
            <ProductConfirmationForm
              key={`${result.url}:${result.finalUrl}:${savedProduct?.id ?? 'new'}`}
              originalUrl={result.url}
              fields={confirmationFields}
              images={confirmationImages}
              imageGalleryStatus={result.imageGalleryStatus}
              expectedImageCount={result.expectedImageCount}
              rejectedImageCount={result.rejectedImageCount}
              accessToken={accessToken}
              productId={editingProductId ?? undefined}
              savedProduct={savedProduct}
              syncDetectedFields={!savedProduct || Boolean(extractionResults)}
              submitLabel={
                editingProductId
                  ? 'Confirmar y guardar cambios'
                  : 'Confirmar y guardar producto'
              }
              onSaved={(productId) =>
                navigate(`/products/${productId}`, {
                  state: {
                    builderDraft: {
                      fields: fields.map(
                        ({
                          id,
                          label,
                          selector,
                          attribute,
                          type,
                          transform,
                          isPrimary,
                        }) => ({
                          id,
                          label,
                          selector,
                          attribute,
                          type,
                          transform,
                          isPrimary,
                        })
                      ),
                    } satisfies BuilderDraftState,
                  },
                })
              }
            />
          </div>

          <div className={currentStep === 3 ? 'space-y-4' : 'hidden'}>
            {appliedConfig && (
              <p
                role="status"
                className="rounded-lg border border-primary/30 bg-primary-container/30 px-4 py-3 text-sm text-on-surface"
              >
                Usando «{appliedConfig.name}» como plantilla. Esta selección no
                modifica ni duplica la configuración original.
              </p>
            )}

            <HtmlInspector
              html={result.html}
              onAddField={handleOpenAddField}
            />

            <FieldsPanel
              fields={fields}
              onRemove={handleRemoveField}
              onUpdateSelector={handleUpdateSelector}
              onTest={handleTestExtraction}
              onSaveConfig={handleOpenSaveConfig}
              canTest={fields.length > 0}
            />

            {extractionResults && (
              <ExtractionResults
                results={extractionResults}
                onClose={() => setExtractionResults(null)}
              />
            )}
          </div>
        </div>
      )}

      {result && (
        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-outline-variant pt-5 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={() => goToStep(currentStep - 1)}
            disabled={currentStep <= 1}
            className="rounded-lg border border-outline-variant px-4 py-2.5 text-sm font-semibold text-on-surface transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-50"
          >
            Anterior
          </button>

          {currentStep < 4 && (
            <button
              type="button"
              onClick={() => continueToStep(currentStep + 1)}
              className="rounded-lg bg-primary-container px-5 py-2.5 text-sm font-semibold text-on-primary-container transition hover:bg-primary"
            >
              {currentStep === 3
                ? 'Continuar a confirmar y guardar'
                : 'Continuar'}
            </button>
          )}
        </div>
      )}

      {saveError && (
        <div className="fixed bottom-6 right-6 z-50 flex items-start gap-3 p-4 rounded-lg bg-error-container text-on-error-container text-sm shadow-lg max-w-md">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />

          <div className="flex-1">
            <strong className="font-semibold block mb-1">
              Error al guardar
            </strong>

            <p className="text-sm opacity-90">{saveError}</p>
          </div>

          <button
            type="button"
            onClick={() => setSaveError(null)}
            className="p-1 rounded text-on-error-container hover:bg-on-error-container/10 transition-colors"
            aria-label="Cerrar error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <AddFieldModal
        key={modalOpen ? modalSelector : 'closed'}
        open={modalOpen}
        selector={modalSelector}
        suggestedAttribute={modalAttribute}
        onConfirm={handleConfirmAddField}
        onCancel={() => setModalOpen(false)}
      />

      <SaveConfigModal
        key={`${saveModalOpen}:${configId ?? 'new'}:${suggestedConfigName}`}
        open={saveModalOpen}
        defaultName={suggestedConfigName}
        isSaving={isSavingConfig}
        mode={isEditMode ? 'edit' : 'create'}
        onConfirm={handleSaveConfig}
        onCancel={() => setSaveModalOpen(false)}
      />
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="p-2 rounded-lg bg-surface-container">{icon}</div>

      <div>
        <p className="text-xs text-on-surface-variant">{label}</p>
        <p className="font-semibold text-on-surface">{value}</p>
      </div>
    </div>
  );
}

function DetectedFieldsDetails({
  fields,
  baseUrl,
}: {
  fields: AnalyzeResponse['detectedFields'];
  baseUrl: string;
}) {
  const productFields = prepareDetectedFields(fields);

  return (
    <details className="rounded-xl border border-outline-variant bg-surface-container-lowest">
      <summary className="cursor-pointer px-5 py-4 text-sm font-medium text-on-surface">
        Ver selectores detectados
      </summary>

      <div className="space-y-3 border-t border-outline-variant p-5">
        {productFields.map((field) => {
          let value = field.value;

          if (field.label === 'Imagen del producto' && value) {
            try {
              value = new URL(value, baseUrl).href;
            } catch {
              value = field.value;
            }
          }

          return (
            <div
              key={`${field.label}-${field.selector}`}
              className="rounded-lg border border-outline-variant p-3"
            >
              <p className="text-sm font-medium text-on-surface">
                {field.label}
              </p>

              <code className="mt-1 block break-all text-xs text-secondary">
                {field.selector}
                {field.attribute ? ` → ${field.attribute}` : ''}
              </code>

              <p className="mt-2 break-all text-sm text-on-surface-variant">
                {value}
              </p>
            </div>
          );
        })}

        {productFields.length === 0 && (
          <p className="text-sm text-on-surface-variant">
            No se detectaron campos compatibles.
          </p>
        )}
      </div>
    </details>
  );
}
