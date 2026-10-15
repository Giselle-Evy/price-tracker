import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  FileCode,
  Globe,
  Loader2,
  AlertCircle,
  Trash2,
  ChevronRight,
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
  fields?: ConfigFieldDto[] | null;
};

export default function ConfigsPage() {
  const accessToken = useAuthStore((state) => state.accessToken);

  const [configs, setConfigs] = useState<ConfigDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [configToDelete, setConfigToDelete] = useState<ConfigDto | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Fetch en el effect (patrón oficial de React: "Fetching data")
  // El setState ocurre DENTRO del .then(), no síncronamente.
  useEffect(() => {
    let ignore = false;

    api
      .get<{ configs: ConfigDto[] }>('/configs', accessToken)
      .then((data) => {
        if (!ignore) {
          setConfigs(data.configs);
          setError(null);
        }
      })
      .catch((err) => {
        if (!ignore) {
          const apiError = err as ApiError;
          setError(apiError.error || 'Error al cargar las configuraciones');
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [accessToken, reloadKey]);

  // Recarga manual (se usa en event handlers, no en effects)
  const reload = useCallback(() => {
    setIsLoading(true);
    setError(null);
    setReloadKey((k) => k + 1);
  }, []);

  async function handleDelete() {
    if (!configToDelete) return;

    const id = configToDelete.id;
    setDeletingId(id);

    try {
      await api.delete(`/configs/${id}`, accessToken);
      setConfigs((prev) => prev.filter((c) => c.id !== id));
      setConfigToDelete(null);
    } catch (err) {
      const apiError = err as ApiError;
      setError(apiError.error || 'Error al eliminar la configuración');
      setConfigToDelete(null);
    } finally {
      setDeletingId(null);
    }
  }

  // (Opcional) exponer reload si querés un botón "Recargar" en el futuro:
  void reload;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Encabezado */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-on-surface mb-2">
            Mis configuraciones
          </h1>
          <p className="text-on-surface-variant">
            Configuraciones de scraping guardadas. Reutilizables para distintos productos del mismo sitio.
          </p>
        </div>
        <Link
          to="/builder"
          className="px-4 py-2.5 bg-primary-container hover:bg-primary text-on-primary-container font-semibold text-sm rounded-lg flex items-center gap-2 transition-all whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Nueva configuración
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-start gap-3 p-4 rounded-lg bg-error-container text-on-error-container text-sm">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <strong className="font-semibold block mb-1">Error</strong>
            <p className="text-sm opacity-90">{error}</p>
          </div>
        </div>
      )}

      {/* Cargando */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-secondary animate-spin" />
        </div>
      )}

      {/* Estado vacío */}
      {!isLoading && configs.length === 0 && (
        <div className="bg-surface-container-lowest rounded-xl border border-dashed border-outline-variant p-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-surface-container mb-4">
            <FileCode className="w-8 h-8 text-outline" />
          </div>
          <h2 className="text-lg font-semibold text-on-surface mb-2">
            No tienes configuraciones guardadas
          </h2>
          <p className="text-on-surface-variant text-sm max-w-md mx-auto mb-6">
            Usá el asistente de importación para analizar una URL y guardar tu primera configuración.
          </p>
          <Link
            to="/builder"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-container hover:bg-primary text-on-primary-container font-semibold text-sm rounded-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            Crear configuración
          </Link>
        </div>
      )}

      {/* Lista de configs */}
      {!isLoading && configs.length > 0 && (
        <div className="space-y-3">
          {configs.map((config) => (
            <ConfigCard
              key={config.id}
              config={config}
              onDelete={() => setConfigToDelete(config)}
              isDeleting={deletingId === config.id}
            />
          ))}
        </div>
      )}

      {/* Modal de confirmación */}
      <ConfirmDialog
        isOpen={configToDelete !== null}
        title="Eliminar configuración"
        message={`¿Seguro que querés eliminar "${configToDelete?.name ?? ''}"?\n\nEsta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        isLoading={deletingId !== null}
        onConfirm={handleDelete}
        onCancel={() => setConfigToDelete(null)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CARD DE CONFIG
// ─────────────────────────────────────────────────────────────

function ConfigCard({
  config,
  onDelete,
  isDeleting,
}: {
  config: ConfigDto;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden hover:border-primary-container transition-colors group">
      <div className="flex items-stretch">
        {/* Contenido principal (clickeable) */}
        <Link
          to={`/configs/${config.id}`}
          className="flex-1 p-5 flex items-start gap-4 hover:bg-surface-container-low/50 transition-colors"
        >
          <div className="p-3 rounded-lg bg-surface-container">
            <FileCode className="w-5 h-5 text-secondary" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-on-surface truncate">
                {config.name}
              </h3>
              <StatusBadge status={config.status} />
            </div>

            <div className="flex items-center gap-4 text-xs text-on-surface-variant mb-2">
              <span className="flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {config.sourceDomain}
              </span>
              <span>
                {config.fields?.length ?? 0} campo{config.fields?.length !== 1 && 's'}
              </span>
            </div>

            <p className="text-xs text-on-surface-variant truncate font-mono opacity-75">
              {config.sourceUrl}
            </p>
          </div>

          <ChevronRight className="w-5 h-5 text-outline flex-shrink-0 mt-1" />
        </Link>

        {/* Botón eliminar */}
        <div className="flex items-center px-4 border-l border-outline-variant">
          <button
            onClick={(e) => {
              e.preventDefault();
              onDelete();
            }}
            disabled={isDeleting}
            className="p-2 rounded-lg text-secondary hover:text-error hover:bg-error-container/50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            aria-label="Eliminar"
            title="Eliminar"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
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