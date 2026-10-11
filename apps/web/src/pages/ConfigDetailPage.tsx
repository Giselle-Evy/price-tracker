import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  FileCode,
  Globe,
  Loader2,
  AlertCircle,
  Trash2,
  Pencil,
  Check,
  X,
  ExternalLink,
} from 'lucide-react';

import { api, type ApiError } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import ConfirmDialog from '../components/ui/ConfirmDialog';

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

export default function ConfigDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const accessToken = useAuthStore((state) => state.accessToken);

  const [config, setConfig] = useState<ConfigDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edición de nombre
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  // Eliminar
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ─────────────────────────────────────────────────────────
  // CARGAR
  // ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id || !accessToken) return;

    let ignore = false;

    api
      .get<ConfigDto>(`/configs/${id}`, accessToken)
      .then((data) => {
        if (!ignore) {
          setConfig(data);
          setNameDraft(data.name);
          setError(null);
        }
      })
      .catch((err) => {
        if (!ignore) {
          const apiError = err as ApiError;
          setError(apiError.error || 'Error al cargar la configuración');
        }
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [id, accessToken]);

  // ─────────────────────────────────────────────────────────
  // GUARDAR NOMBRE
  // ─────────────────────────────────────────────────────────
  async function handleSaveName() {
    if (!config || !id) return;
    const trimmed = nameDraft.trim();
    if (trimmed === '' || trimmed === config.name) {
      setIsEditingName(false);
      setNameDraft(config.name);
      return;
    }

    setIsSavingName(true);
    try {
      const updated = await api.patch<ConfigDto>(
        `/configs/${id}`,
        { name: trimmed },
        accessToken
      );
      setConfig(updated);
      setNameDraft(updated.name);
      setIsEditingName(false);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.error || 'Error al guardar el nombre');
    } finally {
      setIsSavingName(false);
    }
  }

  function handleCancelEditName() {
    if (!config) return;
    setNameDraft(config.name);
    setIsEditingName(false);
  }

  // ─────────────────────────────────────────────────────────
  // ELIMINAR
  // ─────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!id) return;
    setIsDeleting(true);
    try {
      await api.delete(`/configs/${id}`, accessToken);
      navigate('/configs');
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.error || 'Error al eliminar la configuración');
      setIsDeleteOpen(false);
    } finally {
      setIsDeleting(false);
    }
  }

  // ─────────────────────────────────────────────────────────
  // RE-ANALIZAR
  // ─────────────────────────────────────────────────────────
    function handleEdit() {
    if (!config) return;
    const encodedUrl = encodeURIComponent(config.sourceUrl);
    navigate(
      `/builder?configId=${config.id}&url=${encodedUrl}&autorun=1`
    );
  }

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 text-secondary animate-spin" />
        </div>
      </div>
    );
  }

  if (error && !config) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="mb-6 flex items-start gap-3 p-4 rounded-lg bg-error-container text-on-error-container text-sm">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <strong className="font-semibold block mb-1">Error</strong>
            <p className="text-sm opacity-90">{error}</p>
          </div>
        </div>
        <Link
          to="/configs"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary-container hover:text-primary"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a configuraciones
        </Link>
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Volver */}
      <Link
        to="/configs"
        className="inline-flex items-center gap-2 text-sm font-medium text-on-surface-variant hover:text-on-surface mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a configuraciones
      </Link>

      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="flex-1 min-w-0">
          {/* Nombre editable */}
          {isEditingName ? (
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                autoFocus
                disabled={isSavingName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') handleCancelEditName();
                }}
                className="text-3xl font-bold text-on-surface bg-surface-container-lowest border border-primary-container rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-primary-container/20 max-w-xl"
              />
              <button
                onClick={handleSaveName}
                disabled={isSavingName}
                className="p-2 rounded-lg text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-60"
                title="Guardar"
              >
                {isSavingName ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Check className="w-5 h-5" />
                )}
              </button>
              <button
                onClick={handleCancelEditName}
                disabled={isSavingName}
                className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-60"
                title="Cancelar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 mb-2 group">
              <h1 className="text-3xl font-bold text-on-surface truncate">
                {config.name}
              </h1>
              <button
                onClick={() => setIsEditingName(true)}
                className="p-2 rounded-lg text-on-surface-variant opacity-0 group-hover:opacity-100 hover:bg-surface-container transition-all"
                title="Editar nombre"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <StatusBadge status={config.status} />
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-4 text-sm text-on-surface-variant mt-2">
            <span className="flex items-center gap-1.5">
              <Globe className="w-4 h-4" />
              {config.sourceDomain}
            </span>
            <span>
              {config.fields.length} campo{config.fields.length !== 1 && 's'}
            </span>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleEdit}
            className="px-4 py-2.5 bg-primary-container hover:bg-primary text-on-primary-container font-semibold text-sm rounded-lg flex items-center gap-2 transition-all whitespace-nowrap"
            title="Editar esta configuración"
          >
            <Pencil className="w-4 h-4" />
            Editar
          </button>
          <button
            onClick={() => setIsDeleteOpen(true)}
            className="p-2.5 rounded-lg text-secondary hover:text-error hover:bg-error-container/50 transition-colors"
            title="Eliminar"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error banner (durante operaciones) */}
      {error && config && (
        <div className="mb-6 flex items-start gap-3 p-4 rounded-lg bg-error-container text-on-error-container text-sm">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <strong className="font-semibold block mb-1">Error</strong>
            <p className="text-sm opacity-90">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="p-1 rounded text-on-error-container hover:bg-on-error-container/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* URL original */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-5 mb-6">
        <p className="text-xs text-on-surface-variant mb-2 uppercase tracking-wider font-semibold">
          URL original
        </p>
        <a
          href={config.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-mono text-primary-container hover:text-primary break-all inline-flex items-center gap-2"
        >
          {config.sourceUrl}
          <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
        </a>
      </div>

      {/* Tabla de campos */}
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant bg-surface-container-low flex items-center gap-2">
          <FileCode className="w-5 h-5 text-secondary" />
          <h2 className="text-sm font-semibold text-on-surface">
            Campos a extraer
          </h2>
          <span className="text-xs text-on-surface-variant ml-1">
            ({config.fields.length})
          </span>
        </div>

        {config.fields.length === 0 ? (
          <div className="p-8 text-center text-sm text-on-surface-variant">
            Esta configuración no tiene campos.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-container-low/50 text-on-surface-variant">
                <tr>
                  <th className="text-left px-6 py-3 font-medium text-xs uppercase tracking-wider">
                    Campo
                  </th>
                  <th className="text-left px-6 py-3 font-medium text-xs uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="text-left px-6 py-3 font-medium text-xs uppercase tracking-wider">
                    Selector
                  </th>
                  <th className="text-left px-6 py-3 font-medium text-xs uppercase tracking-wider">
                    Atributo
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {config.fields
                  .slice()
                  .sort((a, b) => a.orderIndex - b.orderIndex)
                  .map((field) => (
                    <tr
                      key={field.id}
                      className="hover:bg-surface-container-low/40"
                    >
                      <td className="px-6 py-3 text-on-surface font-medium">
                        {field.label}
                      </td>
                      <td className="px-6 py-3 text-on-surface-variant">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-surface-container">
                          {field.type}
                        </span>
                      </td>
                      <td className="px-6 py-3 font-mono text-xs text-on-surface-variant break-all max-w-xs">
                        {field.selector}
                      </td>
                      <td className="px-6 py-3 font-mono text-xs text-on-surface-variant">
                        {field.attribute ?? '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Fechas */}
      <div className="mt-6 flex items-center gap-4 text-xs text-outline">
        <span>
          Creada: {new Date(config.createdAt).toLocaleString('es-MX')}
        </span>
        {config.updatedAt !== config.createdAt && (
          <span>
            Actualizada: {new Date(config.updatedAt).toLocaleString('es-MX')}
          </span>
        )}
      </div>

      {/* Modal eliminar */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        title="Eliminar configuración"
        message={`¿Seguro que querés eliminar "${config.name}"?\n\nEsta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setIsDeleteOpen(false)}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: ConfigDto['status'] }) {
  const styles: Record<ConfigDto['status'], string> = {
    draft: 'bg-surface-container text-on-surface-variant',
    active: 'bg-emerald-50 text-emerald-700',
    error: 'bg-red-50 text-red-700',
    archived: 'bg-surface-container text-on-surface-variant opacity-60',
  };

  const labels: Record<ConfigDto['status'], string> = {
    draft: 'Borrador',
    active: 'Activa',
    error: 'Error',
    archived: 'Archivada',
  };

  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}