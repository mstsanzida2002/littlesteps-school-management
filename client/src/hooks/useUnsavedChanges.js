import { useCallback, useEffect, useRef } from 'react';
import { useBlocker } from 'react-router';

/**
 * Warn before losing unsaved work: in-app navigation is held by React Router's blocker (render
 * <UnsavedChangesDialog blocker={blocker} />), and closing or reloading the tab gets the
 * browser's own "Leave site?" prompt.
 *
 *   const { blocker, allowNavigation } = useUnsavedChanges(isDirty);
 *   // after saving, before navigate(): allowNavigation();
 *
 * allowNavigation() is needed because navigate() right after a save runs before React has
 * re-rendered with the new "not dirty" state.
 */
export function useUnsavedChanges(when) {
  const allowed = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      when &&
      !allowed.current &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search),
  );

  useEffect(() => {
    if (!when) {
      allowed.current = false;
      return undefined;
    }
    const onBeforeUnload = (event) => {
      if (allowed.current) return;
      event.preventDefault();
      // Older browsers show the prompt only when returnValue is set.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [when]);

  const allowNavigation = useCallback(() => {
    allowed.current = true;
  }, []);

  return { blocker, allowNavigation };
}
