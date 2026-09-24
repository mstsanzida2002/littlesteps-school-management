import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

/** Sets the browser tab title for pages that draw their own heading. Renders nothing. */
export function PageTitle({ title }) {
  useDocumentTitle(title);
  return null;
}
