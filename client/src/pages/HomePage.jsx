import {
  CalendarCheck,
  CircleAlert,
  CircleCheck,
  Megaphone,
  ScrollText,
  UsersRound,
} from 'lucide-react';
import { Link } from 'react-router';

import { Badge } from '../components/ui/Badge.jsx';
import { Card } from '../components/ui/Card.jsx';
import { buttonClasses } from '../components/ui/buttonStyles.js';
import { ROUTES } from '../config/constants.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useHealth } from '../hooks/useHealth.js';

const CLASSES = ['Playgroup', 'Nursery', 'KG-1', 'KG-2'];

const FEATURES = [
  {
    icon: CalendarCheck,
    title: 'Attendance, taken in seconds',
    description:
      'Teachers mark a class in a couple of taps. Guardians see it the same day, with a gentle note if it needs attention.',
  },
  {
    icon: ScrollText,
    title: 'Results, explained plainly',
    description:
      'Marks, grades and remarks for every test — published once, ready for families to see straight away.',
  },
  {
    icon: UsersRound,
    title: 'Meetings, with one-tap replies',
    description:
      'Invitations guardians can accept or decline instantly, and add straight to their calendar.',
  },
  {
    icon: Megaphone,
    title: 'Notices that reach the right people',
    description: 'School news for guardians, teachers, or everyone — pinned when it matters most.',
  },
];

/** A quiet, honest signal, not the point of the page: is the school server reachable right now. */
function ConnectionStatus() {
  const { data, isPending, isError } = useHealth();
  if (isPending) return null;
  if (isError) {
    return (
      <Badge tone="absent" icon={CircleAlert}>
        Can&apos;t reach the school server right now
      </Badge>
    );
  }
  if (data.database !== 'connected') {
    return (
      <Badge tone="late" icon={CircleAlert}>
        Server is up, reconnecting to the database
      </Badge>
    );
  }
  return (
    <Badge tone="present" icon={CircleCheck}>
      Connected to the school server
    </Badge>
  );
}

export default function HomePage() {
  useDocumentTitle();

  return (
    <div className="flex flex-col gap-12 py-2 sm:gap-16 sm:py-6">
      <section className="flex flex-col items-center gap-5 text-center">
        <ConnectionStatus />
        <h1 className="max-w-2xl text-3xl leading-tight font-bold text-ink sm:text-5xl">
          One home for Playgroup, Nursery, KG-1 and KG-2.
        </h1>
        <p className="max-w-xl text-lg text-muted">
          Attendance, results, meetings and notices — for teachers, guardians and the school office,
          all in one place.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {CLASSES.map((label) => (
            <span
              key={label}
              className="rounded-full border border-line bg-surface px-3 py-1 text-sm font-semibold text-muted"
            >
              {label}
            </span>
          ))}
        </div>
        <Link to={ROUTES.LOGIN} className={buttonClasses({ size: 'lg' })}>
          Log in
        </Link>
      </section>

      <section aria-label="What LittleSteps does" className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <Card key={title}>
            <span className="mb-3 inline-flex size-11 items-center justify-center rounded-full bg-brand-50 text-brand-800">
              <Icon aria-hidden="true" className="size-6" />
            </span>
            <h2 className="mb-1 text-lg font-bold text-ink">{title}</h2>
            <p className="text-sm text-muted">{description}</p>
          </Card>
        ))}
      </section>

      <p className="text-center text-sm text-muted">
        New family? Ask the school office to set up your account.
      </p>
    </div>
  );
}
