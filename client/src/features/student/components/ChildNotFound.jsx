import { House, SearchX } from 'lucide-react';
import { Link } from 'react-router';

import { buttonClasses } from '../../../components/ui/buttonStyles.js';
import { Card } from '../../../components/ui/Card.jsx';
import { PageTitle } from '../../../components/ui/PageTitle.jsx';
import { QueryState } from '../../../components/ui/QueryState.jsx';
import { studentPaths } from '../../../config/paths.js';
import { text } from '../text/index.js';

/**
 * Shown for any address a guardian can't open: an unknown page, another child's record, a draft
 * test, a meeting they're not invited to. Always the same words, so it never hints at whether
 * the other record exists.
 */
export function ChildNotFound() {
  const t = text.notFound;
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <PageTitle title={t.title} />
      <span className="grid size-14 place-items-center rounded-full bg-brand-100 text-brand-700">
        <SearchX aria-hidden="true" className="size-7" />
      </span>
      <h1 className="text-xl font-bold text-ink">{t.title}</h1>
      <p className="max-w-sm text-muted">{t.description}</p>
      <Link to={studentPaths.dashboard()} className={buttonClasses({ variant: 'primary' })}>
        <House aria-hidden="true" className="size-5" />
        {t.home}
      </Link>
    </Card>
  );
}

/** QueryState for guardian screens: a 403 or 404 shows ChildNotFound instead of an error. */
export function ChildQuery({ query, loading, compact, children }) {
  if (query.isError && [403, 404].includes(query.error?.status)) return <ChildNotFound />;
  return (
    <QueryState query={query} loading={loading} compact={compact}>
      {children}
    </QueryState>
  );
}

export default ChildNotFound;
