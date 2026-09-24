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

// The app waits for the session check before it renders; fetch the login logo meanwhile.
if (window.location.pathname === ROUTES.LOGIN) preloadLoginLogo();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
