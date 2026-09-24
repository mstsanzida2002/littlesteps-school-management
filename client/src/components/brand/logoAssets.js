/**
 * The full LittleSteps logo (3D render, transparent). Exported from logo-original.png at 280 and
 * 560 px wide (WebP + PNG fallback); aspect ratio 280 × 241.
 */
import png280 from '../../assets/brand/logo-280.png';
import webp280 from '../../assets/brand/logo-280.webp';
import png560 from '../../assets/brand/logo-560.png';
import webp560 from '../../assets/brand/logo-560.webp';

export const LOGO_RATIO = 241 / 280;

export const logoSources = {
  webpSrcSet: `${webp280} 280w, ${webp560} 560w`,
  pngSrcSet: `${png280} 280w, ${png560} 560w`,
  fallback: png280,
};

/** Display width of the logo on the login page; the preload must use the same sizes. */
export const LOGIN_LOGO_SIZES = '(min-width: 48rem) 260px, 200px';

/**
 * Start downloading the login logo while the app restores the session (the whole app waits for
 * that), so the logo is ready when the login page appears. Called for /login only.
 */
export function preloadLoginLogo() {
  if (document.querySelector('link[data-preload="login-logo"]')) return;
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.type = 'image/webp';
  link.setAttribute('imagesrcset', logoSources.webpSrcSet);
  link.setAttribute('imagesizes', LOGIN_LOGO_SIZES);
  link.setAttribute('fetchpriority', 'high');
  link.dataset.preload = 'login-logo';
  document.head.append(link);
}
