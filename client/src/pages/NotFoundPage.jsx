import { Link } from 'react-router';

import { LogoMark } from '../components/brand/Logo.jsx';
import { ROUTES } from '../config/constants.js';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <LogoMark size={64} />
      <p className="text-6xl font-extrabold text-brand-800">404</p>
      <h1 className="text-2xl font-bold">Page not found</h1>
      <Link to={ROUTES.HOME} className="font-semibold text-brand-700 underline">
        Go to home page
      </Link>
    </div>
  );
}
