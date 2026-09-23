import { RouterProvider } from 'react-router';

import { AppProviders } from './app/providers.jsx';
import { router } from './app/router.jsx';

export default function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
