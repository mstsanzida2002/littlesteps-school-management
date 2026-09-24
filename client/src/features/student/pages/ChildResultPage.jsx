import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { Card } from '../../../components/ui/Card.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { Skeleton, SkeletonCard } from '../../../components/ui/Skeleton.jsx';
import { studentPaths } from '../../../config/paths.js';
import { formatDateTime } from '../../../utils/date.js';
import { isObjectId } from '../../../utils/ids.js';
import {
  GradeScaleButton,
  Remarks,
  ResultFigure,
} from '../../results/components/GuardianResult.jsx';
import { testMeta } from '../../results/guardianFormat.js';
import { useStudentResults } from '../../results/hooks/useResults.js';
import { text } from '../../results/text/index.js';
import ChildNotFound, { ChildQuery } from '../components/ChildNotFound.jsx';
import { useChild } from '../hooks/useStudent.js';

/**
 * One published test. The server filters by the child and by `published`, so a draft test, a
 * mangled id or another child's test all come back empty and show "not found".
 */
export default function ChildResultPage() {
  const { assessmentId } = useParams();
  const child = useChild();
  const valid = isObjectId(assessmentId);
  // A mangled address never reaches the API: it is simply "not found".
  const query = useStudentResults(valid ? child.id : undefined, { assessmentId });
  if (!valid) return <ChildNotFound />;

  return (
    <>
      <Link
        to={studentPaths.results()}
        className="-ml-1 mb-2 inline-flex min-h-11 items-center gap-1.5 font-semibold text-brand-700"
      >
        <ArrowLeft aria-hidden="true" className="size-5" />
        {text.back}
      </Link>
      <ChildQuery
        query={query}
        loading={
          <div aria-busy="true" aria-label={text.loading} className="flex flex-col gap-4">
            <Skeleton className="h-9 w-64" />
            <SkeletonCard />
          </div>
        }
      >
        {([result]) => {
          if (!result) return <ChildNotFound />;
          const absent = result.attendance !== 'present';
          return (
            <>
              <PageHeader
                title={result.assessment.name}
                description={`${result.subject} · ${testMeta(result)}`}
              />
              <Card className="flex flex-col gap-4">
                <ResultFigure result={result} size="lg" />
                {absent && (
                  <p className="text-muted">
                    {result.attendance === 'excused'
                      ? text.excusedNote(child.displayName)
                      : text.absentNote(child.displayName)}
                  </p>
                )}
                {result.remarks ? (
                  <Remarks remarks={result.remarks} />
                ) : (
                  !absent && <p className="text-muted">{text.noRemarks}</p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                  <p className="text-sm text-muted">
                    {text.publishedOn(formatDateTime(result.assessment.publishedAt))}
                  </p>
                  {!absent && <GradeScaleButton result={result} />}
                </div>
              </Card>
            </>
          );
        }}
      </ChildQuery>
    </>
  );
}
