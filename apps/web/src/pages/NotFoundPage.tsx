import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="p-8 text-center">
      <h1 className="text-6xl font-bold text-brand-700 mb-4">404</h1>
      <p className="text-silver-500 mb-6">
        La página que buscas no existe.
      </p>
      <Link
        to="/"
        className="inline-block px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition"
      >
        Volver al inicio
      </Link>
    </div>
  );
}