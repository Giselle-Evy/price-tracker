import { useState, type FormEvent, type ReactNode } from 'react';
import { X, Hash, Image as ImageIcon, Link as LinkIcon, Type } from 'lucide-react';

export type FieldType = 'text' | 'price' | 'image' | 'url';

export type NewField = {
  label: string;
  selector: string;
  attribute?: string;
  type: FieldType;
};

type Props = {
  open: boolean;
  selector: string;
  suggestedAttribute?: string;
  onConfirm: (field: NewField) => void;
  onCancel: () => void;
};

const FIELD_TYPES: { value: FieldType; label: string; icon: ReactNode }[] = [
  { value: 'text', label: 'Texto', icon: <Type className="w-4 h-4" /> },
  { value: 'price', label: 'Precio', icon: <Hash className="w-4 h-4" /> },
  { value: 'image', label: 'Imagen', icon: <ImageIcon className="w-4 h-4" /> },
  { value: 'url', label: 'URL', icon: <LinkIcon className="w-4 h-4" /> },
];

const COMMON_FIELDS: { label: string; type: FieldType }[] = [
  { label: 'Nombre', type: 'text' },
  { label: 'Precio', type: 'price' },
  { label: 'Imagen', type: 'image' },
  { label: 'Descripción', type: 'text' },
  { label: 'URL', type: 'url' },
  { label: 'Marca', type: 'text' },
];

export default function AddFieldModal({
  open,
  selector,
  suggestedAttribute,
  onConfirm,
  onCancel,
}: Props) {
  const [label, setLabel] = useState('');
  const [type, setType] = useState<FieldType>('text');
  const [attribute, setAttribute] = useState(suggestedAttribute || '');

  if (!open) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;

    onConfirm({
      label: label.trim(),
      selector,
      attribute: attribute.trim() || undefined,
      type,
    });
  }

  function handleQuickPick(commonLabel: string, commonType: FieldType) {
    setLabel(commonLabel);
    setType(commonType);
    if (commonType === 'image') setAttribute('src');
    if (commonType === 'url') setAttribute('href');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md bg-surface-container-lowest rounded-xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant">
          <h2 className="text-lg font-semibold text-on-surface">Agregar campo</h2>
          <button
            onClick={onCancel}
            className="p-1 rounded text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Selector (readonly) */}
          <div>
            <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
              Selector CSS
            </label>
            <code className="block mt-1.5 text-xs font-mono text-on-surface bg-surface-container px-3 py-2 rounded break-all">
              {selector}
            </code>
          </div>

          {/* Quick picks */}
          <div>
            <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2 block">
              Campos comunes
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_FIELDS.map((field) => (
                <button
                  key={field.label}
                  type="button"
                  onClick={() => handleQuickPick(field.label, field.type)}
                  className="px-2.5 py-1 text-xs bg-surface-container-low hover:bg-surface-container rounded transition-colors text-on-surface"
                >
                  {field.label}
                </button>
              ))}
            </div>
          </div>

          {/* Label */}
          <div>
            <label htmlFor="field-label" className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
              Nombre del campo
            </label>
            <input
              id="field-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="ej. Precio, Nombre, Marca"
              required
              autoFocus
              className="w-full mt-1.5 px-3 py-2 bg-surface-container-low text-on-surface placeholder:text-outline text-sm rounded-lg border border-outline-variant focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all"
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2 block">
              Tipo de dato
            </label>
            <div className="grid grid-cols-2 gap-2">
              {FIELD_TYPES.map((fieldType) => (
                <button
                  key={fieldType.value}
                  type="button"
                  onClick={() => setType(fieldType.value)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                    type === fieldType.value
                      ? 'bg-primary-container text-on-primary-container'
                      : 'bg-surface-container-low hover:bg-surface-container text-on-surface'
                  }`}
                >
                  {fieldType.icon}
                  {fieldType.label}
                </button>
              ))}
            </div>
          </div>

          {/* Attribute */}
          <div>
            <label htmlFor="field-attribute" className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
              Atributo (opcional)
            </label>
            <input
              id="field-attribute"
              type="text"
              value={attribute}
              onChange={(e) => setAttribute(e.target.value)}
              placeholder="ej. src, href, data-price (vacío = texto)"
              className="w-full mt-1.5 px-3 py-2 bg-surface-container-low text-on-surface placeholder:text-outline text-sm rounded-lg border border-outline-variant focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all"
            />
            <p className="text-xs text-on-surface-variant mt-1">
              Si se deja vacío, se extrae el texto del elemento.
            </p>
          </div>

          {/* Footer */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 px-4 rounded-lg text-sm font-medium text-on-surface bg-surface-container-low hover:bg-surface-container transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!label.trim()}
              className="flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold text-on-primary-container bg-primary-container hover:bg-primary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Agregar campo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}