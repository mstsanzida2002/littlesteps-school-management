import { Logo, LogoMark } from '../../components/brand/Logo.jsx';
import { Example, Section } from './Section.jsx';

const SWATCHES = [
  [
    'Brand (Charleston)',
    [
      ['brand-50', '#f5f8ee'],
      ['brand-100', '#e9f0da'],
      ['brand-200', '#d3e0b5'],
      ['brand-500', '#5f7a2c'],
      ['brand-700', '#2f4a12'],
      ['brand-800', '#1e3309'],
    ],
  ],
  [
    'Citron',
    [
      ['citron-100', '#eef3d6'],
      ['citron-300', '#c3d474'],
      ['citron-500', '#849a28'],
      ['citron-700', '#4a5a0e'],
    ],
  ],
  [
    'Cerise and blush',
    [
      ['blush-50', '#fff8f5'],
      ['blush-200', '#fcd4d6'],
      ['blush-300', '#fca9aa'],
      ['cerise-400', '#f2678e'],
      ['cerise-500', '#e23260'],
      ['cerise-700', '#b0173f'],
    ],
  ],
  [
    'Warm neutrals',
    [
      ['sand-100', '#f3efeb'],
      ['sand-300', '#d9d0c8'],
      ['sand-500', '#736b63'],
      ['sand-600', '#5f5a52'],
      ['ink', '#1e2616'],
    ],
  ],
];

const TONES = [
  ['present', 'bg-present-soft text-present-ink', 'Present, active, will attend, success'],
  ['absent', 'bg-absent-soft text-absent-ink', 'Absent, suspended, cannot attend, errors'],
  ['late', 'bg-late-soft text-late-ink', 'Late, pending, warnings'],
  ['excused', 'bg-excused-soft text-excused-ink', 'Excused'],
  ['neutral', 'bg-neutral-soft text-neutral-ink', 'Draft, rejected, no response'],
  ['info', 'bg-info-soft text-info-ink', 'Published, upcoming, information'],
];

export function BrandSection() {
  return (
    <Section
      id="brand"
      title="Brand"
      description="The full logo on light surfaces only (its dark green “Little” disappears on dark backgrounds). The flat footprint mark is used where the logo would be too small: favicon, collapsed sidebar, mobile header."
    >
      <Example title="Full logo — cream, white, tint" className="grid gap-4 sm:grid-cols-3">
        {['bg-page', 'bg-white', 'bg-brand-100'].map((bg) => (
          <div
            key={bg}
            className={`grid place-items-center rounded-card border border-line p-6 ${bg}`}
          >
            <Logo width={200} />
          </div>
        ))}
      </Example>
      <Example
        title="Sizes used: login 260 px, sidebar 128 px, public header 84 px"
        className="flex flex-wrap items-end gap-6"
      >
        <Logo width={260} />
        <Logo width={128} />
        <Logo width={84} />
      </Example>
      <Example title="Compact mark and icons" className="flex flex-wrap items-end gap-6">
        {[64, 40, 32, 24, 16].map((size) => (
          <div key={size} className="flex flex-col items-center gap-1 text-xs text-muted">
            <LogoMark size={size} />
            {size}px
          </div>
        ))}
        <div className="flex flex-col items-center gap-1 text-xs text-muted">
          <img src="/favicon.svg" width={48} height={48} alt="Favicon (SVG)" />
          favicon.svg
        </div>
        <div className="flex flex-col items-center gap-1 text-xs text-muted">
          <img src="/favicon-32.png" width={32} height={32} alt="Favicon 32 px" />
          favicon-32.png
        </div>
        <div className="flex flex-col items-center gap-1 text-xs text-muted">
          <img
            src="/apple-touch-icon.png"
            width={60}
            height={60}
            alt="Apple touch icon"
            className="rounded-xl"
          />
          apple-touch-icon
        </div>
      </Example>
    </Section>
  );
}

export function ColourSection() {
  return (
    <Section
      id="colours"
      title="Colour"
      description="Guava palette. Citron and Cerise are fills and graphics; text uses the -700 shades for WCAG AA. Cerise is never used for success."
    >
      {SWATCHES.map(([group, swatches]) => (
        <Example key={group} title={group} className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {swatches.map(([name, hex]) => (
            <div
              key={name}
              className="overflow-hidden rounded-control border border-line bg-surface"
            >
              <div className="h-14" style={{ background: hex }} />
              <p className="px-2 pt-1 text-xs font-semibold">{name}</p>
              <p className="px-2 pb-1.5 font-mono text-xs text-muted">{hex}</p>
            </div>
          ))}
        </Example>
      ))}
      <Example
        title="Status tones (soft background + AA text)"
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
      >
        {TONES.map(([tone, classes, use]) => (
          <div key={tone} className={`rounded-control px-4 py-3 ${classes}`}>
            <p className="font-bold">{tone}</p>
            <p className="text-sm">{use}</p>
          </div>
        ))}
      </Example>
    </Section>
  );
}

export function TypeSection() {
  return (
    <Section
      id="type"
      title="Typography"
      description='Outfit (Latin, variable) with Hind Siliguri for Bangla. Base size 17px. Bangla text is marked lang="bn" for its font and taller lines.'
    >
      <div className="flex flex-col gap-3">
        <p className="text-3xl font-bold">Page title — Good morning, Sharmin</p>
        <p className="text-2xl font-bold">Section title — Attendance this week</p>
        <p className="text-lg font-bold">Card title — Parent-teacher meeting</p>
        <p>Body — Ayaan was present all week. Large, calm body text for reading on a phone.</p>
        <p className="text-sm text-muted">Secondary — Thu, 24 Sep 2026 · Playgroup-A · Roll 1</p>
        <p className="text-2xl font-bold tabular-nums">Numbers — 95.5% · 21 of 22 days · 1,234</p>
      </div>
      <Example
        title="Bangla"
        className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4"
      >
        <p lang="bn" className="text-2xl font-bold">
          সুপ্রভাত, শারমিন
        </p>
        <p lang="bn">আয়ান রহমান — আজ উপস্থিত। খুব সুন্দর ছবি এঁকেছে!</p>
        <p lang="bn" className="text-sm text-muted">
          অভিভাবক সভা: বৃহস্পতিবার, ১ অক্টোবর, সকাল ১০টা
        </p>
        <p>
          Mixed: <span lang="bn">নুসরাত জাহান</span> scored 18 / 20 —{' '}
          <span lang="bn">“খুব ভালো পড়েছে!”</span>
        </p>
      </Example>
    </Section>
  );
}
