import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

/** Page title (h1, also the browser tab title), optional description and actions. */
export function PageHeader({ title, description, actions }) {
  useDocumentTitle(title);
  return (
    <header className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl leading-tight font-bold text-ink sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
