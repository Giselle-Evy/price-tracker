import { Trash2, Tag, Hash, Image as ImageIcon, Link as LinkIcon, Type, FlaskConical } from 'lucide-react';

import type { FieldType } from './AddFieldModal';

export type ExtractField = {
  id: string;
  label: string;
  selector: string;
  attribute?: string;
  type: FieldType;
};

type Props = {
  fields: ExtractField[];
  onRemove: (id: string) => void;
  onTest: () => void;
  canTest: boolean;
};

const TYPE_ICONS: Record<FieldType, React.ReactNode> = {
  text: <Type className="w-3.5 h-3.5" />,
  price: <Hash className="w-3.5 h-3.5" />,
  image: <ImageIcon className="w-3.5 h-3.5" />,
  url: <LinkIcon className="w-3.5 h-3.5" />,
};

export default function FieldsPanel({ fields, onRemove, onTest, canTest }: Props) {
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant bg-surface-container-low">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-secondary" />
          <h2 className="text-sm font-semibold text-on-surface">
            Campos a extraer
          </h2>
          {fields.length > 0 && (
            <span className="text-xs bg-primary-container text-on-primary-container px-2 py-0.5 rounded-full font-semibold">
              {fields.length}
            </span>
          )}
        </div>
        {fields.length > 0 && (
          <button
            onClick={onTest}
            disabled={!canTest}
            className="flex items-center gap-1.5 text-xs font-medium text-primary-container hover:text-primary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            Probar extracción
          </button>
        )}
      </div>

      {/* Body */}
      {fields.length === 0 ? (
        <div className="p-8 text-center">
          <Tag className="w-8 h-8 text-outline mx-auto mb-3" />
          <p className="text-sm text-on-surface-variant">
            Aún no has agregado campos.
          </p>
          <p className="text-xs text-on-surface-variant mt-1 opacity-75">
            Selecciona un elemento del árbol y pulsa "Agregar como campo".
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-outline-variant">
          {fields.map((field) => (
            <li key={field.id} className="flex items-center gap-3 px-6 py-3 hover:bg-surface-container-low/50 transition-colors">
              {/* Icono tipo */}
              <div className="p-2 rounded-lg bg-surface-container">
                {TYPE_ICONS[field.type]}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-on-surface">
                    {field.label}
                  </span>
                  <span className="text-xs text-on-surface-variant">
                    · {field.type}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="text-xs font-mono text-on-surface-variant truncate">
                    {field.selector}
                  </code>
                  {field.attribute && (
                    <span className="text-xs text-secondary">
                      @{field.attribute}
                    </span>
                  )}
                </div>
              </div>

              {/* Remove */}
              <button
                onClick={() => onRemove(field.id)}
                className="p-2 rounded-lg text-secondary hover:text-error hover:bg-error-container/50 transition-colors"
                aria-label="Eliminar campo"
                title="Eliminar"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}