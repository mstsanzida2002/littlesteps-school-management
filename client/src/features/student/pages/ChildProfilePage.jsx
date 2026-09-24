import { ArrowLeftRight, Info, KeyRound } from 'lucide-react';
import { Link } from 'react-router';

import { Avatar } from '../../../components/ui/Avatar.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { buttonClasses } from '../../../components/ui/buttonStyles.js';
import { Card } from '../../../components/ui/Card.jsx';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { SkeletonCard } from '../../../components/ui/Skeleton.jsx';
import { ROUTES } from '../../../config/constants.js';
import { formatSchoolDate } from '../../../utils/date.js';
import { ChildQuery } from '../components/ChildNotFound.jsx';
import { useChild, useMyProfile } from '../hooks/useStudent.js';
import { useSwitchChild } from '../hooks/useSwitchChild.js';
import { text } from '../text/index.js';

const t = text.profile;
const BANGLA = /[ঀ-৿]/;

/** Label/value pairs, two per row; rows marked `wide` (email, address) take the full width. */
function Fields({ rows }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      {rows.map(([label, value, wide]) => (
        <div key={label} className={wide ? 'col-span-2 min-w-0' : 'min-w-0'}>
          <dt className="text-sm font-semibold text-muted">{label}</dt>
          <dd
            lang={typeof value === 'string' && BANGLA.test(value) ? 'bn' : undefined}
            className={value ? 'break-words text-ink' : 'text-muted'}
          >
            {value || t.notGiven}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** The child's profile (FR-STU-01): read-only; the school office changes these details. */
export default function ChildProfilePage() {
  const child = useChild();
  const profile = useMyProfile();
  const { switchChild, switching } = useSwitchChild();

  return (
    <>
      <PageHeader title={t.title} description={t.description(child.displayName)} />
      <ChildQuery
        query={profile}
        loading={
          <div aria-busy="true" aria-label={t.title} className="grid gap-4 lg:grid-cols-2">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        }
      >
        {({ student, session, guardian, teachers }) => (
          <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
            <Card title={t.childTitle}>
              <div className="mb-4 flex items-center gap-3">
                <Avatar name={student.name} size="lg" />
                <div className="min-w-0 leading-tight">
                  <p
                    lang={BANGLA.test(student.name) ? 'bn' : undefined}
                    className="text-lg font-bold"
                  >
                    {student.name}
                  </p>
                  <p className="text-muted">{student.classSection}</p>
                </div>
              </div>
              <Fields
                rows={[
                  [t.fields.nickname, student.nickname],
                  [t.fields.classSection, student.classSection],
                  [t.fields.rollNo, String(student.rollNo)],
                  [t.fields.dateOfBirth, formatSchoolDate(student.dateOfBirth)],
                  [t.fields.admissionDate, formatSchoolDate(student.admissionDate)],
                  [t.fields.schoolYear, session.name],
                  [t.fields.username, student.username, true],
                ]}
              />
            </Card>

            <Card title={t.teachersTitle} description={t.teachersDescription(child.displayName)}>
              {teachers.length ? (
                <ul className="flex flex-col divide-y divide-line">
                  {teachers.map((row) => (
                    <li
                      key={row.subject._id}
                      className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-2.5"
                    >
                      <span className="font-semibold">{row.subject.name}</span>
                      <span className="text-muted">
                        {row.teachers.map((x) => x.name).join(', ')}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted">{t.teachersEmpty}</p>
              )}
            </Card>

            <Card title={t.guardianTitle}>
              <Fields
                rows={[
                  [t.guardianFields.name, guardian.name],
                  [t.guardianFields.relation, t.relations[guardian.relation] ?? guardian.relation],
                  [t.guardianFields.phone, guardian.phone],
                  [t.guardianFields.email, guardian.email, true],
                  [t.guardianFields.address, guardian.address, true],
                ]}
              />
              <p className="mt-4 flex items-start gap-2 rounded-control bg-brand-50 p-3 text-brand-800">
                <Info aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                {t.updateNote}
              </p>
            </Card>

            <Card title={t.accountTitle}>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link
                  to={ROUTES.CHANGE_PASSWORD}
                  className={buttonClasses({ variant: 'secondary' })}
                >
                  <KeyRound aria-hidden="true" className="size-5" />
                  {t.changePassword}
                </Link>
                <Button
                  variant="secondary"
                  icon={ArrowLeftRight}
                  onClick={switchChild}
                  loading={switching}
                >
                  {t.switchChild}
                </Button>
              </div>
              <p className="mt-2 text-sm text-muted">{t.switchChildHint}</p>
            </Card>
          </div>
        )}
      </ChildQuery>
    </>
  );
}
