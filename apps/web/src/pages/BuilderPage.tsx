import { useEffect, useState, useRef, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
} from '../components/html-inspector/FieldsPanel';
import ExtractionResults from '../components/html-inspector/ExtractionResults';
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
};

type ConfigFieldDto = {
  id: string;
  label: string;
  selector: string;
  attribute: string | null;
  type: 'text' | 'price' | 'image' | 'url';
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

export default function BuilderPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const accessToken = useAuthStore((state) => state.accessToken);

  // Modo: 'create' o 'edit'.
  // Importante: el configId se guarda en estado con un initializer que
  // lee el searchParam UNA SOLA VEZ. Así, cuando limpiamos los query
  // params con setSearchParams({}), el modo edición NO se pierde.
  const [configId] = useState<string | null>(() =>
    searchParams.get('configId')
  );
  const isEditMode = configId !== null;

  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  // Info de la config en modo edición
  const [editingConfigName, setEditingConfigName] = useState<string>('');

  // Campos a extraer
  const [fields, setFields] = useState<ExtractField[]>([]);

  // Modal de agregar campo
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSelector, setModalSelector] = useState('');
  const [modalAttribute, setModalAttribute] = useState<string | undefined>();

  // Resultados de extracción
  const [extractionResults, setExtractionResults] = useState<
    ExtractionResult[] | null
  >(null);

  // Guardar configuración
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Refs para inicialización única
  const bootstrappedRef = useRef(false);

  // ─────────────────────────────────────────────────────────
  // ANALIZAR
  // ─────────────────────────────────────────────────────────
  async function runAnalyze(urlToAnalyze: string) {
    setError(null);
    setResult(null);
    setExtractionResults(null);
    setIsLoading(true);

    try {
      const data = await api.post<AnalyzeResponse>('/analyze', {
        url: urlToAnalyze,
      });
      setResult(data);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.error || 'Error al analizar la URL');
    } finally {
      setIsLoading(false);
    }
  }

  // ─────────────────────────────────────────────────────────
  // BOOTSTRAP (leer query params al montar)
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (bootstrappedRef.current) return;

    const urlParam = searchParams.get('url');
    const autorun = searchParams.get('autorun');
    const configIdParam = searchParams.get('configId');

    if (!urlParam && !configIdParam) return;

    bootstrappedRef.current = true;

    // Diferimos a un microtask para no hacer setState síncrono en el effect.
    queueMicrotask(async () => {
      // Limpiar los query params de la URL del navegador.
      // El configId ya está guardado en estado, así que esto no lo pierde.
      setSearchParams({}, { replace: true });

      // Si estamos editando, traemos la config completa primero.
      if (configIdParam) {
        try {
          const existing = await api.get<ConfigDto>(
            `/configs/${configIdParam}`,
            accessToken
          );

          setEditingConfigName(existing.name);
          setUrl(existing.sourceUrl);

          // Convertir ConfigFieldDto[] a ExtractField[]
          const mapped: ExtractField[] = existing.fields
            .slice()
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((f) => ({
              id: crypto.randomUUID(),
              label: f.label,
              selector: f.selector,
              attribute: f.attribute ?? undefined,
              type: f.type,
            }));
          setFields(mapped);

          // Analizar la URL original para tener el HTML
          if (autorun === '1' || urlParam) {
            void runAnalyze(existing.sourceUrl);
          }
        } catch (err) {
          const apiError = err as ApiError;
          setError(apiError.error || 'Error al cargar la configuración');
        }
      } else if (urlParam) {
        // Modo normal: URL desde query, sin config
        setUrl(urlParam);
        if (autorun === '1') {
          void runAnalyze(urlParam);
        }
      }
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─────────────────────────────────────────────────────────
  // SUBMIT MANUAL
  // ─────────────────────────────────────────────────────────
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await runAnalyze(url);
  }

  function handleClear() {
    setUrl('');
    setResult(null);
    setError(null);
    setFields([]);
    setExtractionResults(null);
  }

  function handleAnalyzeAnother() {
    setResult(null);
    setError(null);
    setUrl('');
    setFields([]);
    setExtractionResults(null);
  }

  function handleOpenAddField(selector: string, suggestedAttribute?: string) {
    setModalSelector(selector);
    setModalAttribute(suggestedAttribute);
    setModalOpen(true);
  }

  function handleConfirmAddField(newField: NewField) {
    setFields((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        ...newField,
      },
    ]);
    setExtractionResults(null);
    setModalOpen(false);
  }

  function handleRemoveField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id));
    setExtractionResults(null);
  }

  function handleTestExtraction() {
    if (!result) return;
    const extraction = runExtraction(result.html, fields);
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
        fields: fields.map((f, index) => ({
          label: f.label,
          selector: f.selector,
          attribute: f.attribute || undefined,
          type: f.type,
          orderIndex: index,
        })),
      };

      if (isEditMode && configId) {
        // PATCH: actualizar config existente
        await api.patch(`/configs/${configId}`, payload, accessToken);
        setSaveModalOpen(false);
        navigate(`/configs/${configId}`);
      } else {
        // POST: crear nueva config
        const created = await api.post<{ id: string }>(
          '/configs',
          payload,
          accessToken
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

  // Calcular el nombre sugerido para la config
  const suggestedConfigName = isEditMode
    ? editingConfigName
    : result?.finalUrl
      ? `Config ${new URL(result.finalUrl).hostname}`
      : 'Nueva configuración';

  // Título según modo
  const pageTitle = isEditMode
    ? 'Editando configuración'
    : 'Asistente de importación';
  const pageSubtitle = isEditMode
    ? 'Modificá los campos o la URL y guardá los cambios.'
    : 'Pega la URL de un producto. Lo analizaremos para extraer automáticamente su nombre, precio, imagen y más.';

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Encabezado */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary-container">
            {isEditMode ? (
              <Pencil className="w-5 h-5 text-on-primary-container" />
            ) : (
              <Sparkles className="w-5 h-5 text-on-primary-container" />
            )}
          </div>
          <h1 className="text-3xl font-bold text-on-surface">{pageTitle}</h1>
        </div>
        <p className="text-on-surface-variant">{pageSubtitle}</p>
      </div>

      {/* Card de instrucciones (solo si no hay resultado y no estamos editando) */}
      {!result && !isLoading && !isEditMode && (
        <div className="mb-8 bg-surface-container-low rounded-xl border border-outline-variant p-6">
          <h2 className="text-sm font-semibold text-on-surface mb-3 uppercase tracking-wider">
            Cómo funciona
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Step number={1} text="Pega la URL del producto" />
            <Step number={2} text="Analizamos la página" />
            <Step number={3} text="Ves los datos extraídos" />
            <Step number={4} text="Los guardás o monitoreás" />
          </div>
        </div>
      )}

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-3">
          <div className="relative flex items-center flex-1">
            <Globe className="absolute left-3 w-5 h-5 text-secondary pointer-events-none" />
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://ejemplo.com/producto"
              required
              disabled={isLoading}
              className="w-full pl-10 pr-12 py-3.5 bg-surface-container-lowest text-on-surface placeholder:text-outline text-sm rounded-lg border border-outline-variant focus:outline-none focus:border-primary-container focus:ring-2 focus:ring-primary-container/20 transition-all disabled:opacity-60"
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
            disabled={isLoading || !url}
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
                Analizar
              </>
            )}
          </button>
        </div>
      </form>

      {/* Error banner */}
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
            onClick={handleClear}
            className="p-1 rounded text-on-error-container hover:bg-on-error-container/10 transition-colors"
            aria-label="Cerrar error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Estado vacío */}
      {!isLoading && !error && !result && (
        <div className="bg-surface-container-lowest rounded-xl border border-dashed border-outline-variant p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-surface-container mb-4">
            <Globe className="w-8 h-8 text-outline" />
          </div>
          <h2 className="text-lg font-semibold text-on-surface mb-2">
            Esperando una URL
          </h2>
          <p className="text-on-surface-variant text-sm max-w-md mx-auto">
            Pega la URL de un producto en el campo de arriba y pulsa "Analizar" para
            inspeccionar su contenido.
          </p>
        </div>
      )}

      {/* Resultado */}
      {result && (
        <div className="space-y-4">
          {/* Metadatos */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant bg-surface-container-low">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary-container" />
                <h2 className="text-sm font-semibold text-on-surface">
                  Análisis completado
                </h2>
              </div>
              <button
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
                    result.method.charAt(0).toUpperCase() + result.method.slice(1)
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

          {/* Inspector de HTML */}
          <HtmlInspector html={result.html} onAddField={handleOpenAddField} />

          {/* Panel de campos */}
          <FieldsPanel
            fields={fields}
            onRemove={handleRemoveField}
            onTest={handleTestExtraction}
            onSaveConfig={handleOpenSaveConfig}
            canTest={fields.length > 0}
          />

          {/* Resultados de extracción */}
          {extractionResults && (
            <ExtractionResults
              results={extractionResults}
              onClose={() => setExtractionResults(null)}
            />
          )}
        </div>
      )}

      {/* Toast de error al guardar */}
      {saveError && (
        <div className="fixed bottom-6 right-6 z-50 flex items-start gap-3 p-4 rounded-lg bg-error-container text-on-error-container text-sm shadow-lg max-w-md">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <strong className="font-semibold block mb-1">Error al guardar</strong>
            <p className="text-sm opacity-90">{saveError}</p>
          </div>
          <button
            onClick={() => setSaveError(null)}
            className="p-1 rounded text-on-error-container hover:bg-on-error-container/10 transition-colors"
            aria-label="Cerrar error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Modal de agregar campo */}
      <AddFieldModal
        key={modalOpen ? modalSelector : 'closed'}
        open={modalOpen}
        selector={modalSelector}
        suggestedAttribute={modalAttribute}
        onConfirm={handleConfirmAddField}
        onCancel={() => setModalOpen(false)}
      />

      {/* Modal de guardar config */}
      <SaveConfigModal
        key={saveModalOpen ? 'save-open' : 'save-closed'}
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

// ─────────────────────────────────────────────────────────────
// SUBCOMPONENTES
// ─────────────────────────────────────────────────────────────

function Step({ number, text }: { number: number; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-xs font-bold">
        {number}
      </div>
      <p className="text-sm text-on-surface-variant leading-snug pt-0.5">{text}</p>
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