import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Self-hosted fonts (no third-party request). Both files use unicode-range subsets and
// font-display: swap, so an English page downloads only Outfit's Latin subset (~32 KB) and the
// Bangla faces load only when Bangla text is on screen.
import '@fontsource-variable/outfit/wght.css';
import '@fontsource/hind-siliguri/400.css';
import '@fontsource/hind-siliguri/600.css';
import '@fontsource/hind-siliguri/700.css';

import App from './App.jsx';
import { preloadLoginLogo } from './components/brand/logoAssets.js';
import { ROUTES } from './config/constants.js';
import './index.css';

// The app waits for the session check before it renders; use that time. On /login, fetch the
// logo. On the guardian's home page (often opened on slow mobile data), start downloading its
// code now instead of after the session check.
if (window.location.pathname === ROUTES.LOGIN) preloadLoginLogo();
if (window.location.pathname === ROUTES.STUDENT) {
  import('./features/student/pages/StudentDashboardPage.jsx').catch(() => {});
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
