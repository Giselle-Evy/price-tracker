import { useState, type FormEvent } from 'react';
import { X, Save, Pencil } from 'lucide-react';

type Props = {
  open: boolean;
  defaultName: string;
  isSaving: boolean;
  mode?: 'create' | 'edit';
  onConfirm: (name: string) => void;
  onCancel: () => void;
};

export default function SaveConfigModal({
  open,
  defaultName,
  isSaving,
  mode = 'create',
  onConfirm,
  onCancel,
}: Props) {
  const [name, setName] = useState(defaultName);

  if (!open) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || isSaving) return;
    onConfirm(name.trim());
  }

  const isEdit = mode === 'edit';
  const title = isEdit ? 'Guardar cambios' : 'Guardar configuración';
  const submitLabel = isEdit ? 'Actualizar' : 'Guardar';
  const submittingLabel = isEdit ? 'Actualizando...' : 'Guardando...';
  const Icon = isEdit ? Pencil : Save;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md bg-surface-container-lowest rounded-xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-secondary" />
            <h2 className="text-lg font-semibold text-on-surface">
              {title}
            </h2>
          </div>
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="p-1 rounded text-secondary hover:text-on-surface hover:bg-surface-container transition-colors disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label
              htmlFor="config-name"
              className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider"
            >
              Nombre de la configuración
            </label>
            <input
              id="config-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ej. Config Books to Scrape"
              required
              autoFocus
              disabled={isSaving}
              className="w-full mt-1.5 px-3 py-2 bg-surface-container-low text-on-surface placeholder:text-outline text-sm rounded-lg border border-outline-variant focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all disabled:opacity-60"
            />
            <p className="text-xs text-on-surface-variant mt-1.5">
              Se guardará con los {name ? 'campos configurados actualmente' : 'campos actuales'}.
            </p>
          </div>

          {/* Footer */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium text-on-surface bg-surface-container-low hover:bg-surface-container transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSaving}
              className="flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold text-on-primary-container bg-primary-container hover:bg-primary transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-on-primary-container border-t-transparent rounded-full" />
                  {submittingLabel}
                </>
              ) : (
                submitLabel
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}