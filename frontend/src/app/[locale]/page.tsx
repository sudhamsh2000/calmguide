import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { WelcomeGate } from '@/components/auth/WelcomeGate';
import { LandingChromeSync } from '@/components/landing/LandingChromeSync';
import { LandingNav } from '@/components/landing/LandingNav';
import { ScrollReveal } from '@/components/landing/ScrollReveal';
import { LocaleSwitcher } from '@/components/ui/LocaleSwitcher';

export const metadata: Metadata = {
  title: 'CalmGuide — Guidance when caregiving gets hard',
  description:
    'CalmGuide is a multilingual AI companion that helps dementia caregivers respond to difficult moments with calm, structured guidance, day or night.',
};

function Container({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-landing px-5 md:px-8 ${className}`}>{children}</div>;
}

function Eyebrow({
  children,
  alwaysCenter = false,
  onDark = false,
}: {
  children: ReactNode;
  alwaysCenter?: boolean;
  onDark?: boolean;
}) {
  return (
    <p
      className={`flex items-center gap-2 text-sm font-semibold ${
        onDark ? 'text-white/50' : 'text-foreground-muted'
      } ${alwaysCenter ? 'justify-center' : 'justify-center lg:justify-start'}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-accentCoral" />
      {children}
    </p>
  );
}

function StepNumber({ n, onDark = false }: { n: number; onDark?: boolean }) {
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
        onDark ? 'bg-accentSky text-white' : 'bg-primary text-onPrimary'
      }`}
    >
      {n}
    </span>
  );
}

function CheckItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-0.5 shrink-0 text-accentSky"
        aria-hidden="true"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
      <span className="text-sm font-medium text-foreground">{children}</span>
    </li>
  );
}

/** Minimal line icons for the value strip — deliberately generic/geometric,
 * matching the existing checkmark's stroke weight, not drawn from any
 * external icon set. */
const VALUE_ICON_PATHS: Record<string, ReactNode> = {
  ai_guided: <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />,
  personalized: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" />
    </>
  ),
  multilingual: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 3.5 6 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-6-3.5-9s1-6.5 3.5-9Z" />
    </>
  ),
  privacy: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
};

function ValueIcon({ name }: { name: string }) {
  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accentSky-soft text-accentSky">
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {VALUE_ICON_PATHS[name]}
      </svg>
    </span>
  );
}

export default async function LandingPage() {
  const t = await getTranslations('common');

  const valueItems = ['ai_guided', 'personalized', 'multilingual', 'privacy'] as const;
  const whatIsChecklist = t.raw('landing.what_is.checklist') as string[];
  const howSteps = ['describe', 'context', 'guidance', 'feedback'] as const;
  const behavioralItems = t.raw('landing.behavioral_context.items') as string[];
  const safetySteps = t.raw('landing.safety.steps') as string[];
  const threeAmItems = t.raw('landing.three_am.items') as string[];
  const techItems = t.raw('landing.technology.items') as string[];

  return (
    <WelcomeGate>
      <LandingChromeSync />
      <ScrollReveal />
      <noscript>
        <style>{'[data-reveal] { opacity: 1 !important; transform: none !important; }'}</style>
      </noscript>
      <div className="animate-page-enter">
        <LandingNav />

        <main id="main-content">
          {/* Hero. A real caregiver-and-parent moment (photo, not an
           * abstract render) carries the warmth; a real product screenshot
           * floats on top of it as proof this is a working app, not just a
           * mood board — the same "photo + floating detail card" pairing
           * repeats at smaller scale in What Is CalmGuide and Behavioral
           * Context below, so it reads as one deliberate system rather
           * than a one-off hero treatment. */}
          {/* -mt-20/pt-20 cancel out for layout (matches the header's h-20)
           * but let the gradient paint from y=0, behind the transparent
           * header, instead of stopping at the header's bottom edge and
           * leaving a visible seam against the page's flat background. */}
          <section className="landing-hero-bg relative -mt-20 overflow-hidden pt-20">
            <Container className="relative grid grid-cols-1 items-center gap-12 py-16 md:py-20 lg:grid-cols-2 lg:gap-16 lg:py-24">
              <div className="text-center lg:text-start">
                <Eyebrow>{t('landing.hero.eyebrow')}</Eyebrow>
                <h1
                  className="mx-auto mt-4 max-w-xl text-5xl font-bold leading-[1.1] tracking-tight text-navy md:text-6xl lg:mx-0"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {t('landing.hero.title_pre')}
                  <span>{t('landing.hero.title_highlight')}</span>
                  {t('landing.hero.title_post')}
                </h1>
                <p className="mx-auto mt-7 max-w-lg text-lg leading-relaxed text-foreground-muted lg:mx-0">
                  {t('landing.hero.subtitle')}
                </p>

                <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
                  <Link
                    href="/profile/setup"
                    className="focus-ring inline-flex min-h-tap w-full items-center justify-center rounded-full bg-primary px-8 text-lg font-semibold text-onPrimary shadow-lg transition-colors hover:bg-primary-light active:bg-primary-dark sm:w-auto"
                  >
                    {t('landing.hero.cta_primary')}
                  </Link>
                  <a
                    href="#how-it-works"
                    className="ghost-button focus-ring inline-flex min-h-tap w-full items-center justify-center rounded-full border border-theme-strong px-8 text-lg font-semibold text-foreground sm:w-auto"
                  >
                    {t('landing.hero.cta_secondary')}
                  </a>
                </div>

                <p className="mt-5 text-sm text-foreground-muted">
                  {t('welcome.have_access_code')}{' '}
                  <Link
                    href="/login"
                    className="font-medium text-accentSky underline-offset-2 hover:underline"
                  >
                    {t('login.title')}
                  </Link>
                  <span
                    aria-hidden="true"
                    className="mx-2"
                    style={{ color: 'color-mix(in srgb, var(--color-foreground-muted) 40%, transparent)' }}
                  >
                    /
                  </span>
                  <Link
                    href="/facility/login"
                    className="font-medium text-accentSky underline-offset-2 hover:underline"
                  >
                    {t('welcome.facility_login')}
                  </Link>
                </p>

                <div className="mt-8 flex items-center justify-center gap-3 lg:justify-start">
                  <a
                    href="https://www.leapoffaith.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="focus-ring shrink-0 rounded-xl bg-white px-2 py-1.5"
                  >
                    <Image
                      src="/brand/leap-of-faith-logo.webp"
                      alt="Leap of Faith"
                      width={1500}
                      height={449}
                      className="h-6 w-auto shrink-0"
                    />
                  </a>
                  <span className="text-sm text-foreground-muted">{t('landing.partner_line')}</span>
                </div>

                <p
                  className="mx-auto mt-8 max-w-lg text-xs leading-relaxed lg:mx-0"
                  style={{ color: 'color-mix(in srgb, var(--color-foreground-muted) 70%, transparent)' }}
                >
                  {t('landing.hero.disclaimer')}
                </p>
              </div>

              <div className="relative mx-auto w-full max-w-md">
                {/* Abstract translucent shape, gently rotating — evokes the
                 * same mood as the user's reference clip without
                 * reproducing its specific render, which belongs to
                 * another site (see design/design.md changelog). Pure
                 * SVG/CSS, no video file. */}
                {/* Parallax (scroll) and rotation (time) are two separate
                 * transforms, so they live on two nested elements — a CSS
                 * animation targeting `transform` fully overrides any
                 * static `transform` on the same element, they don't
                 * compose on one node. */}
                <div className="landing-glass-parallax pointer-events-none absolute -end-16 -top-16 -z-10 h-[70%] w-[70%] opacity-90">
                  <svg aria-hidden="true" viewBox="0 0 200 200" className="landing-glass-shape h-full w-full">
                    <defs>
                      <linearGradient id="landingGlass" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#dcebfa" stopOpacity="0.95" />
                        <stop offset="55%" stopColor="#3e8fd0" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="#ffffff" stopOpacity="0.85" />
                      </linearGradient>
                    </defs>
                    <path
                      fill="url(#landingGlass)"
                      d="M100 18c26 0 40 22 56 40 16 18 32 30 22 50-10 19-36 18-56 30-20 12-34 34-56 28-22-6-30-32-40-52-10-20-20-40-6-58 14-18 54-38 80-38Z"
                    />
                  </svg>
                </div>
                <div className="landing-glass-parallax pointer-events-none absolute -bottom-14 -start-14 -z-10 h-[55%] w-[55%] opacity-70">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 200 200"
                    className="landing-glass-shape h-full w-full"
                    style={{ animationDirection: 'reverse', animationDuration: '28s' }}
                  >
                    <defs>
                      <linearGradient id="landingGlass2" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#3e8fd0" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="#dcebfa" stopOpacity="0.85" />
                      </linearGradient>
                    </defs>
                    <path
                      fill="url(#landingGlass2)"
                      d="M100 18c26 0 40 22 56 40 16 18 32 30 22 50-10 19-36 18-56 30-20 12-34 34-56 28-22-6-30-32-40-52-10-20-20-40-6-58 14-18 54-38 80-38Z"
                    />
                  </svg>
                </div>
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[2rem] shadow-2xl ring-1 ring-black/5">
                  <Image
                    src="/brand/caregivers/caregiver-companionship.png"
                    alt="A caregiver sitting with an older woman, hands clasped, both smiling"
                    fill
                    priority
                    sizes="(min-width: 1024px) 28rem, 90vw"
                    className="object-cover"
                  />
                </div>
                <Image
                  src="/brand/screens/calmguide-home-coach.png"
                  alt="CalmGuide home screen"
                  width={1122}
                  height={1402}
                  className="absolute -bottom-8 -start-10 w-[42%] -rotate-3 rounded-[1.5rem] shadow-2xl ring-1 ring-black/10"
                />
              </div>
            </Container>
          </section>

          {/* Value strip */}
          <section data-reveal className="border-b border-theme-soft py-14 md:py-16">
            <Container>
              <h2
                className="text-2xl font-bold tracking-tight text-ink md:text-3xl"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {t('landing.value_strip.title')}
              </h2>
              <div className="mt-9 grid grid-cols-1 divide-y divide-theme-soft sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
                {valueItems.map((key, i) => (
                  <div
                    key={key}
                    className={`flex items-start gap-3 py-5 sm:py-0 sm:ps-6 ${
                      i > 0 ? 'sm:border-s sm:border-theme-soft' : ''
                    }`}
                  >
                    <ValueIcon name={key} />
                    <div>
                      <h3 className="text-base font-semibold text-foreground">
                        {t(`landing.value_strip.items.${key}.title`)}
                      </h3>
                      <p className="mt-1 text-sm text-foreground-muted">
                        {t(`landing.value_strip.items.${key}.desc`)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Container>
          </section>

          {/* What is CalmGuide */}
          <section id="what-we-do" data-reveal className="bg-accent-aqua/30 py-16 md:py-24">
            <Container className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
              <div className="text-center lg:text-start">
                <Eyebrow>{t('landing.what_is.eyebrow')}</Eyebrow>
                <h2
                  className="mt-3 text-4xl font-bold tracking-tight text-ink"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {t('landing.what_is.title')}
                </h2>
                <p className="mx-auto mt-4 max-w-lg text-lg leading-relaxed text-foreground-muted lg:mx-0">
                  {t('landing.what_is.desc')}
                </p>
              </div>
              <div className="relative mx-auto w-full max-w-md pb-24 sm:pb-8">
                <div className="relative aspect-[5/4] w-full overflow-hidden rounded-[2rem] shadow-xl ring-1 ring-black/5">
                  <Image
                    src="/brand/caregivers/caregiver-medication-review.png"
                    alt="A caregiver reviewing medication with an older couple"
                    fill
                    sizes="(min-width: 1024px) 28rem, 90vw"
                    className="object-cover"
                  />
                </div>
                <div className="card-shell absolute bottom-0 start-1/2 w-[92%] -translate-x-1/2 rounded-2xl p-5 sm:bottom-auto sm:start-auto sm:end-[-2rem] sm:top-[calc(100%-4.5rem)] sm:w-[85%] sm:translate-x-0">
                  <ul className="grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2">
                    {whatIsChecklist.map((item) => (
                      <CheckItem key={item}>{item}</CheckItem>
                    ))}
                  </ul>
                </div>
              </div>
            </Container>
          </section>

          {/* How CalmGuide works — the one dark panel on the page, echoing
           * the reference's own black "How It Works" section. Everything
           * else on the page stays light, so this is the single deliberate
           * moment of contrast rather than one of several. */}
          <section id="how-it-works" data-reveal className="bg-panelDark py-16 md:py-24">
            <Container>
              <div className="mx-auto max-w-2xl text-center">
                <Eyebrow alwaysCenter onDark>
                  {t('landing.how.eyebrow')}
                </Eyebrow>
                <h2
                  className="mt-3 text-4xl font-bold tracking-tight text-white"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {t('landing.how.title')}
                </h2>
              </div>

              <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {howSteps.map((key, i) => (
                  <div
                    key={key}
                    className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center"
                  >
                    <div className="flex justify-center">
                      <StepNumber n={i + 1} onDark />
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-white">
                      {t(`landing.how.steps.${key}.title`)}
                    </h3>
                    <p className="mt-1.5 text-sm text-white/60">
                      {t(`landing.how.steps.${key}.desc`)}
                    </p>
                  </div>
                ))}
              </div>
            </Container>
          </section>

          {/* Moment Coach showcase */}
          <section data-reveal className="py-16 md:py-24">
            <Container className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
              <div className="relative mx-auto w-full max-w-xs lg:order-2">
                <Image
                  src="/brand/screens/calmguide-moment-coach-response.png"
                  alt="Moment Coach showing Right Now, Why This Is Happening, and What Not To Do guidance"
                  width={1122}
                  height={1402}
                  className="w-full rounded-[1.75rem] shadow-2xl ring-1 ring-black/5"
                />
                <Image
                  src="/brand/screens/calmguide-moment-coach-why.png"
                  alt="Moment Coach explaining why a behavior may be happening"
                  width={1122}
                  height={1402}
                  className="absolute -bottom-6 -start-10 hidden w-[45%] -rotate-6 rounded-2xl shadow-2xl ring-1 ring-black/5 sm:block"
                />
              </div>
              <div className="lg:order-1">
                <Eyebrow>{t('landing.coach.eyebrow')}</Eyebrow>
                <h2
                  className="mt-3 text-center text-4xl font-bold tracking-tight text-ink lg:text-start"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {t('landing.coach.title')}
                </h2>
                <p className="mt-4 text-center text-lg text-foreground-muted lg:text-start">
                  {t('landing.coach.subtitle')}
                </p>

                <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {(['right_now', 'why', 'when_help', 'not_to_do'] as const).map((key) => (
                    <div key={key} className="card-shell rounded-2xl p-4">
                      <h3 className="text-sm font-semibold text-accentSky">
                        {t(`landing.coach.${key}.title`)}
                      </h3>
                      <p className="mt-1 text-sm text-foreground-muted">
                        {t(`landing.coach.${key}.desc`)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </Container>
          </section>

          {/* Behavioral context */}
          <section data-reveal className="bg-accent-lavender/50 py-16 md:py-24">
            <Container className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
              <div className="text-center lg:text-start">
                <Eyebrow>{t('landing.behavioral_context.eyebrow')}</Eyebrow>
                <h2
                  className="mt-3 text-4xl font-bold tracking-tight text-ink"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {t('landing.behavioral_context.title')}
                </h2>
                <p className="mx-auto mt-4 max-w-lg text-lg leading-relaxed text-foreground-muted lg:mx-0">
                  {t('landing.behavioral_context.desc')}
                </p>
                <ul className="mx-auto mt-6 grid max-w-lg grid-cols-1 gap-3 text-start sm:grid-cols-2 lg:mx-0">
                  {behavioralItems.map((item) => (
                    <CheckItem key={item}>{item}</CheckItem>
                  ))}
                </ul>
              </div>
              <div className="relative mx-auto w-full max-w-md">
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[2rem] shadow-xl ring-1 ring-black/5">
                  <Image
                    src="/brand/caregivers/caregiver-mobility-support.png"
                    alt="A caregiver helping an older man walk across a living room"
                    fill
                    sizes="(min-width: 1024px) 28rem, 90vw"
                    className="object-cover"
                  />
                </div>
                <Image
                  src="/brand/screens/calmguide-behavior-profile.png"
                  alt="CalmGuide behavior profile and memory insights"
                  width={1122}
                  height={1402}
                  className="absolute -bottom-8 -end-6 w-[38%] rotate-3 rounded-2xl shadow-2xl ring-1 ring-black/10"
                />
              </div>
            </Container>
          </section>

          {/* Safety */}
          <section id="safety" data-reveal className="bg-accent-peach/40 py-16 md:py-24">
            <Container className="max-w-2xl">
              <div className="text-center">
                <Eyebrow alwaysCenter>{t('landing.safety.eyebrow')}</Eyebrow>
                <h2
                  className="mt-3 text-4xl font-bold tracking-tight text-ink"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {t('landing.safety.title')}
                </h2>
                <p className="mt-4 text-lg text-foreground-muted">{t('landing.safety.subtitle')}</p>
              </div>

              <ol className="mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-stretch sm:justify-center sm:gap-2">
                {safetySteps.map((step, i) => (
                  <li
                    key={step}
                    className="flex flex-1 items-center gap-3 sm:flex-row sm:items-center sm:gap-2"
                  >
                    <span className="card-shell flex w-full flex-1 items-center gap-3 self-stretch rounded-xl p-4 sm:flex-col sm:justify-center sm:gap-2 sm:text-center">
                      <StepNumber n={i + 1} />
                      <span className="text-sm font-medium text-foreground">{step}</span>
                    </span>
                    {i < safetySteps.length - 1 && (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="hidden shrink-0 sm:block"
                        style={{ color: 'color-mix(in srgb, var(--color-foreground-muted) 50%, transparent)' }}
                        aria-hidden="true"
                      >
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    )}
                  </li>
                ))}
              </ol>

              <p className="mx-auto mt-8 max-w-xl rounded-xl border border-theme-soft bg-surface p-4 text-center text-sm leading-relaxed text-foreground-muted">
                {t('landing.safety.disclaimer')}
              </p>
            </Container>
          </section>

          {/* 3 a.m. experience — "For Caregivers" */}
          <section id="for-caregivers" data-reveal className="py-16 md:py-24">
            <Container className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
              <div className="text-center lg:text-start">
                <Eyebrow>{t('landing.three_am.eyebrow')}</Eyebrow>
                <h2
                  className="mt-3 text-4xl font-bold tracking-tight text-ink"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {t('landing.three_am.title')}
                </h2>
                <ul className="mx-auto mt-8 grid max-w-md grid-cols-1 gap-3 sm:grid-cols-2 lg:mx-0">
                  {threeAmItems.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-3 rounded-xl border border-theme-soft bg-surface p-4 text-start"
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="mt-0.5 shrink-0 text-accentSky"
                        aria-hidden="true"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      <span className="text-sm font-medium text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Image
                src="/brand/screens/calmguide-daily-checkin.png"
                alt="CalmGuide daily check-in, used anytime, anywhere"
                width={1122}
                height={1402}
                className="mx-auto w-full max-w-xs rounded-[1.75rem] shadow-2xl ring-1 ring-black/5"
              />
            </Container>
          </section>

          {/* Healthcare / Technology — "For Healthcare" */}
          <section id="technology" data-reveal className="bg-accent-lavender/40 py-16 md:py-24">
            <Container className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
              <div id="for-healthcare" className="text-center lg:text-start">
                <Eyebrow>{t('landing.interop.eyebrow')}</Eyebrow>
                <h2
                  className="mt-3 text-4xl font-bold tracking-tight text-ink"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {t('landing.interop.title')}
                </h2>
                <p className="mt-4 leading-relaxed text-foreground-muted">
                  {t('landing.interop.desc')}
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                  {['FHIR', 'HL7', 'OMOP', 'SNOMED CT', 'LOINC'].map((standard) => (
                    <span
                      key={standard}
                      className="rounded-full border border-theme-soft bg-surface px-3 py-1.5 text-sm font-medium text-foreground"
                    >
                      {standard}
                    </span>
                  ))}
                </div>
                <p className="mx-auto mt-4 max-w-xl text-sm text-foreground-muted lg:mx-0">
                  {t('landing.interop.caveat')}
                </p>

                <div className="mt-10 border-t border-theme-soft pt-8">
                  <p className="text-sm font-semibold text-foreground-muted">
                    {t('landing.technology.eyebrow')}
                  </p>
                  <div className="mx-auto mt-4 flex max-w-xl flex-wrap items-center justify-center gap-2 lg:mx-0 lg:justify-start">
                    {techItems.map((tech) => (
                      <span
                        key={tech}
                        className="rounded-full bg-accentSky-soft px-3.5 py-1.5 text-sm font-medium text-accentSky"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-[2rem] shadow-xl ring-1 ring-black/5">
                <Image
                  src="/brand/caregivers/caregiver-telehealth.png"
                  alt="A caregiver and older woman on a video call with a clinician"
                  fill
                  sizes="(min-width: 1024px) 28rem, 90vw"
                  className="object-cover"
                />
              </div>
            </Container>
          </section>

          {/* Final CTA */}
          <section data-reveal className="py-16 md:py-20">
            <Container className="max-w-2xl">
              <div className="rounded-3xl bg-panelDark px-8 py-14 text-center shadow-xl">
                <h2
                  className="text-3xl font-bold tracking-tight text-panelDark-on md:text-4xl"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {t('landing.final_cta.title')}
                </h2>
                <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-white/70">
                  {t('landing.final_cta.desc')}
                </p>
                <Link
                  href="/profile/setup"
                  className="focus-ring mt-8 inline-flex min-h-tap items-center justify-center rounded-full bg-white px-8 text-lg font-semibold text-panelDark shadow-lg transition-colors hover:bg-white/90"
                >
                  {t('landing.hero.cta_primary')}
                </Link>
              </div>
            </Container>
          </section>
        </main>

        {/* Footer */}
        <footer className="landing-gradient-footer text-footer-text">
          <Container className="py-12">
            <div className="flex flex-col items-center gap-10 text-center md:flex-row md:items-start md:justify-between md:text-start">
              <div className="flex flex-col items-center md:items-start">
                <Image
                  src="/brand/calmguide-logo-transparent.png"
                  alt="CalmGuide"
                  width={2172}
                  height={724}
                  className="h-11 w-auto"
                />
                <p className="mt-3 max-w-xs text-sm text-footer-muted">
                  {t('landing.partner_line')}
                </p>
              </div>

              <nav
                aria-label={t('landing.footer.nav_heading')}
                className="flex flex-col items-center gap-2 md:items-start"
              >
                <p className="text-sm font-semibold text-footer-text">
                  {t('landing.footer.nav_heading')}
                </p>
                <a href="#what-we-do" className="text-sm text-footer-muted hover:text-footer-text">
                  {t('landing.nav.what_we_do')}
                </a>
                <a
                  href="#how-it-works"
                  className="text-sm text-footer-muted hover:text-footer-text"
                >
                  {t('landing.nav.how_it_works')}
                </a>
                <a href="#safety" className="text-sm text-footer-muted hover:text-footer-text">
                  {t('landing.nav.safety')}
                </a>
                <a href="#technology" className="text-sm text-footer-muted hover:text-footer-text">
                  {t('landing.nav.technology')}
                </a>
              </nav>

              <nav
                aria-label={t('landing.footer.for_you_heading')}
                className="flex flex-col items-center gap-2 md:items-start"
              >
                <p className="text-sm font-semibold text-footer-text">
                  {t('landing.footer.for_you_heading')}
                </p>
                <a
                  href="#for-caregivers"
                  className="text-sm text-footer-muted hover:text-footer-text"
                >
                  {t('landing.nav.for_caregivers')}
                </a>
                <a
                  href="#for-healthcare"
                  className="text-sm text-footer-muted hover:text-footer-text"
                >
                  {t('landing.nav.for_healthcare')}
                </a>
                <a href="#about" className="text-sm text-footer-muted hover:text-footer-text">
                  {t('landing.nav.about')}
                </a>
                <Link
                  href="/profile/setup"
                  className="text-sm text-footer-muted hover:text-footer-text"
                >
                  {t('landing.nav.cta')}
                </Link>
              </nav>

              <nav
                aria-label={t('landing.footer.resources_heading')}
                className="flex flex-col items-center gap-2 md:items-start"
              >
                <p className="text-sm font-semibold text-footer-text">
                  {t('landing.footer.resources_heading')}
                </p>
                <Link href="/login" className="text-sm text-footer-muted hover:text-footer-text">
                  {t('welcome.have_access_code')}
                </Link>
                <Link href="/privacy" className="text-sm text-footer-muted hover:text-footer-text">
                  {t('landing.footer.privacy')}
                </Link>
                <Link href="/terms" className="text-sm text-footer-muted hover:text-footer-text">
                  {t('landing.footer.terms')}
                </Link>
              </nav>

              <a
                href="https://www.leapoffaith.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring shrink-0 rounded-xl bg-white px-4 py-2.5"
              >
                <Image
                  src="/brand/leap-of-faith-logo.webp"
                  alt="Leap of Faith"
                  width={1500}
                  height={449}
                  className="h-8 w-auto"
                />
              </a>
            </div>

            <p
              id="about"
              className="mt-10 max-w-3xl border-t border-[color:var(--color-footer-border)] pt-6 text-center text-xs leading-relaxed text-footer-muted md:text-start"
            >
              {t('landing.about.body')}
            </p>

            <div className="mt-6 flex flex-col items-center gap-3 border-t border-[color:var(--color-footer-border)] pt-6 text-center text-xs text-footer-muted md:flex-row md:justify-between">
              <p>
                © {new Date().getFullYear()} CalmGuide. {t('landing.footer.rights')}
              </p>
              <LocaleSwitcher triggerClassName="text-footer-muted hover:text-footer-text" />
            </div>
          </Container>
        </footer>
      </div>
    </WelcomeGate>
  );
}
