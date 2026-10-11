import { Copy, Check, Plus } from 'lucide-react';
import { useState } from 'react';

import { buildSelector } from './utils/buildSelector';
import type { HtmlNode } from './utils/parseHtml';

type Props = {
  node: HtmlNode | null;
  onAddField: (selector: string, suggestedAttribute?: string) => void;
};

export default function ElementDetails({ node, onAddField }: Props) {
  const [copied, setCopied] = useState(false);

  if (!node) {
    return (
      <div className="p-6 text-center text-on-surface-variant text-sm">
        <p>Selecciona un elemento del árbol para ver sus detalles.</p>
      </div>
    );
  }

  const selector = buildSelector(node.element);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(selector);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Tag */}
      <div>
        <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
          Etiqueta HTML
        </label>
        <div className="mt-1.5">
          <code className="text-sm font-mono text-on-surface bg-surface-container px-2 py-1 rounded">
            &lt;{node.tag}&gt;
          </code>
        </div>
      </div>

      {/* Selector CSS */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            Selector CSS
          </label>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-primary-container hover:text-primary transition-colors"
            title="Copiar selector"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                Copiar
              </>
            )}
          </button>
        </div>
        <code className="block text-xs font-mono text-on-surface bg-surface-container px-3 py-2 rounded break-all">
          {selector}
        </code>
      </div>

      {/* Botón agregar como campo */}
      <button
        onClick={() => onAddField(selector, node.tag === 'img' ? 'src' : undefined)}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-primary-container hover:bg-primary text-on-primary-container font-semibold text-sm transition-colors"
      >
        <Plus className="w-4 h-4" />
        Agregar como campo
      </button>

      {/* ID */}
      {node.id && (
        <div>
          <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            ID
          </label>
          <div className="mt-1.5">
            <code className="text-sm font-mono text-on-surface">#{node.id}</code>
          </div>
        </div>
      )}

      {/* Clases */}
      {node.classes.length > 0 && (
        <div>
          <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            Clases ({node.classes.length})
          </label>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {node.classes.map((cls) => (
              <span
                key={cls}
                className="text-xs font-mono bg-surface-container px-2 py-0.5 rounded"
              >
                .{cls}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Texto */}
      {node.textPreview && (
        <div>
          <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            Texto
          </label>
          <p className="mt-1.5 text-sm text-on-surface">
            {node.textPreview}
            {node.textPreview.length >= 100 && '...'}
          </p>
        </div>
      )}

      {/* Atributos */}
      {Object.keys(node.attributes).length > 0 && (
        <div>
          <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            Atributos
          </label>
          <div className="mt-1.5 space-y-1">
            {Object.entries(node.attributes).map(([key, value]) => (
              <div key={key} className="flex gap-2 text-xs">
                <span className="font-mono text-secondary">{key}:</span>
                <span className="font-mono text-on-surface break-all">
                  "{value}"
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hijos */}
      <div>
        <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
          Elementos hijos
        </label>
        <p className="mt-1.5 text-sm text-on-surface">
          {node.children.length} elemento{node.children.length !== 1 && 's'}
        </p>
      </div>
    </div>
  );
}