import { CheckCircle2, AlertTriangle, XCircle, Circle } from 'lucide-react';

import type { ExtractionResult } from './utils/runExtraction';

type Props = {
  results: ExtractionResult[];
  onClose: () => void;
};

export default function ExtractionResults({ results, onClose }: Props) {
  const successCount = results.filter((r) => r.status === 'success').length;
  const warningCount = results.filter((r) => r.status === 'warning').length;
  const errorCount = results.filter(
    (r) => r.status === 'error' || r.status === 'empty'
  ).length;

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant bg-surface-container-low">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-on-surface">
            Resultado de la extracción
          </h2>
        </div>
        <button
          onClick={onClose}
          className="text-xs text-secondary hover:text-on-surface transition-colors"
        >
          Cerrar
        </button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 divide-x divide-outline-variant border-b border-outline-variant">
        <div className="px-6 py-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-semibold text-on-surface">
              {successCount} exitoso{successCount !== 1 && 's'}
            </span>
          </div>
        </div>
        <div className="px-6 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-semibold text-on-surface">
              {warningCount} advertencia{warningCount !== 1 && 's'}
            </span>
          </div>
        </div>
        <div className="px-6 py-3">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-600" />
            <span className="text-xs font-semibold text-on-surface">
              {errorCount} error{errorCount !== 1 && 'es'}
            </span>
          </div>
        </div>
      </div>

      {/* Lista de resultados */}
      <ul className="divide-y divide-outline-variant">
        {results.map((result) => (
          <ResultRow key={result.fieldId} result={result} />
        ))}
      </ul>
    </div>
  );
}

function ResultRow({ result }: { result: ExtractionResult }) {
  const { icon, color, bgColor } = getStatusStyle(result.status);

  return (
    <li className={`px-6 py-4 ${bgColor}`}>
      <div className="flex items-start gap-3">
        {/* Icono de estado */}
        <div className="pt-0.5">{icon}</div>

        {/* Contenido */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm text-on-surface">
              {result.label}
            </span>
            <span className="text-xs text-on-surface-variant">
              · {result.type}
            </span>
          </div>

          {/* Selector */}
          <code className="block text-xs font-mono text-on-surface-variant truncate mb-2">
            {result.selector}
            {result.attribute && ` @${result.attribute}`}
          </code>

          {/* Valor extraído */}
          {result.value && (
            <div className={`p-2 rounded-lg text-xs font-mono break-all ${color}`}>
              {result.value}
            </div>
          )}

          {/* Mensaje */}
          {result.message && (
            <p className={`text-xs mt-1.5 ${color}`}>{result.message}</p>
          )}
        </div>
      </div>
    </li>
  );
}

function getStatusStyle(status: ExtractionResult['status']): {
  icon: React.ReactNode;
  color: string;
  bgColor: string;
} {
  switch (status) {
    case 'success':
      return {
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
        color: 'text-emerald-700 bg-emerald-50',
        bgColor: '',
      };
    case 'warning':
      return {
        icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
        color: 'text-amber-700 bg-amber-50',
        bgColor: '',
      };
    case 'empty':
      return {
        icon: <Circle className="w-5 h-5 text-slate-400" />,
        color: 'text-slate-500',
        bgColor: '',
      };
    case 'error':
      return {
        icon: <XCircle className="w-5 h-5 text-red-600" />,
        color: 'text-red-700',
        bgColor: 'bg-red-50/40',
      };
  }
}