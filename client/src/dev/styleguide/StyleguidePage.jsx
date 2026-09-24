import { Logo } from '../../components/brand/Logo.jsx';
import { PageTitle } from '../../components/ui/PageTitle.jsx';
import {
  ButtonSection,
  CardSection,
  FeedbackSection,
  FormSection,
  IdentitySection,
  StatusSection,
} from './ComponentSections.jsx';
import { BrandSection, ColourSection, TypeSection } from './FoundationsSections.jsx';
import {
  ChartSection,
  DataSection,
  NavigationSection,
  OverlaySection,
} from './InteractiveSections.jsx';

const LINKS = [
  ['brand', 'Brand'],
  ['colours', 'Colour'],
  ['type', 'Type'],
  ['buttons', 'Buttons'],
  ['forms', 'Forms'],
  ['status', 'Status'],
  ['cards', 'Cards'],
  ['feedback', 'Feedback'],
  ['overlays', 'Overlays'],
  ['navigation', 'Tabs'],
  ['data', 'Table'],
  ['identity', 'Avatars'],
  ['charts', 'Charts'],
];

/**
 * /styleguide — development only (the route and this chunk are excluded from production
 * builds). Every component and state, including Bangla text.
 */
export default function StyleguidePage() {
  return (
    <div className="min-h-dvh bg-page">
      <PageTitle title="Styleguide" />
      <header className="border-b-3 border-cerise-400 bg-surface pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <Logo width={72} priority />
          <div>
            <h1 className="text-xl font-bold text-brand-800 sm:text-2xl">
              LittleSteps design system
            </h1>
            <p className="text-sm text-muted">Direction D “Guava” · development only</p>
          </div>
        </div>
      </header>
      <nav
        aria-label="Styleguide sections"
        className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur"
      >
        <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2 [scrollbar-width:none] sm:px-6">
          {LINKS.map(([id, label]) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold whitespace-nowrap text-sand-700 hover:bg-brand-100 hover:text-brand-800 pointer-fine:min-h-9"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-8 sm:px-6">
        <BrandSection />
        <ColourSection />
        <TypeSection />
        <ButtonSection />
        <FormSection />
        <StatusSection />
        <CardSection />
        <FeedbackSection />
        <OverlaySection />
        <NavigationSection />
        <DataSection />
        <IdentitySection />
        <ChartSection />
      </main>
    </div>
  );
}
