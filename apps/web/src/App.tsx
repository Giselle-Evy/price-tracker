function App() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-sm border border-silver-200 p-8">
        <h1 className="text-3xl font-bold text-brand-700 mb-2">
          Price Tracker
        </h1>
        <p className="text-silver-500 mb-6">
          TailwindCSS funcionando con la paleta del proyecto.
        </p>

        <div className="flex flex-wrap gap-3 mb-6">
          <button className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition">
            Botón primario
          </button>
          <button className="px-4 py-2 bg-silver-100 text-silver-900 rounded-lg hover:bg-silver-200 transition">
            Botón secundario
          </button>
          <button className="px-4 py-2 bg-white text-brand-700 border border-brand-600 rounded-lg hover:bg-brand-50 transition">
            Outline
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          <span className="inline-block px-3 py-1 bg-success-light text-success rounded-full text-sm font-medium">
            ↓ Bajó
          </span>
          <span className="inline-block px-3 py-1 bg-danger-light text-danger rounded-full text-sm font-medium">
            ↑ Subió
          </span>
          <span className="inline-block px-3 py-1 bg-warning-light text-warning rounded-full text-sm font-medium">
            ⚠ Advertencia
          </span>
        </div>
      </div>
    </div>
  );
}

export default App;