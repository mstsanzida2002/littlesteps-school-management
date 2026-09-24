import { useEffect } from 'react';

import { APP_NAME } from '../config/constants.js';

/** Sets the browser tab title ("Attendance · LittleSteps"), which screen readers announce. */
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
  }, [title]);
}
