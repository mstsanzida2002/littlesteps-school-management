import { useCallback, useSyncExternalStore } from 'react';

/** True while the media query matches, e.g. useMediaQuery('(min-width: 48rem)'). */
export function useMediaQuery(query) {
  const subscribe = useCallback(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Tailwind's `md` breakpoint: tables become tables, filters go inline. */
export const useIsDesktop = () => useMediaQuery('(min-width: 48rem)');
