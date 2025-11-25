import { type ReactNode } from 'react';
import { Button } from '../components/ui/Button';
import { TopSchools } from '../components/landing/TopSchools';
import { StatusBanner } from '../components/ui/StatusBanner';

const SECTION_IDS = {
  hero: 'hero-section',
  about: 'about-section',
  features: 'features-section',
  pricing: 'pricing-section',
  topSchools: 'top-schools-section',
  contact: 'contact-section',
} as const;

export interface LandingPageProps {
  onShowAuth?: (mode: 'login' | 'register') => void;
  children?: ReactNode;
}

export function LandingPage({ onShowAuth, children }: LandingPageProps) {
  const handleScroll = (section: keyof typeof SECTION_IDS) => {
    if (typeof window === 'undefined') return;
    const element = document.getElementById(SECTION_IDS[section]);
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-24">
      <section
        id={SECTION_IDS.hero}
        role="region"
        aria-label="Hero"
        className="mt-6 grid gap-8 rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 px-6 py-12 shadow-lg md:grid-cols-[1.2fr,1fr] md:px-12"
      >
        <div className="space-y-6">
          <h1 className="text-4xl font-bold leading-tight text-[var(--brand-surface-contrast)] sm:text-5xl">
            Powering modern school operations across every tenant
          </h1>
          <p className="text-lg text-[var(--brand-muted)]">
            Real-time attendance, exam analytics, fee tracking, and branded experiences tailored to
            your institution.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Button size="lg" onClick={() => onShowAuth?.('register')}>
              Start onboarding
            </Button>
            <Button size="lg" variant="ghost" onClick={() => onShowAuth?.('login')}>
              Go to dashboard
            </Button>
            <Button size="lg" variant="outline" onClick={() => handleScroll('features')}>
              Explore features
            </Button>
          </div>
        </div>
        <div className="relative rounded-3xl border border-[var(--brand-border)] bg-gradient-to-br from-[var(--brand-primary)]/30 via-transparent to-[var(--brand-accent)]/20 p-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_45%)]" />
          <div className="relative z-10 flex h-full flex-col justify-between gap-6">
            {children ?? <StatusBanner status="success" message="99.98% uptime across districts" />}
            <StatusBanner status="info" message="SOC2 Type II compliance in progress" />
          </div>
        </div>
      </section>

      <section id={SECTION_IDS.about} role="region" aria-label="About" className="space-y-6">
        <h2 className="text-3xl font-semibold text-[var(--brand-surface-contrast)]">
          Why schools choose us
        </h2>
        <p className="max-w-3xl text-[var(--brand-muted)]">
          We combine schema-per-tenant isolation, accessibility-first UI, and enterprise-grade
          security so districts can scale confidently without sacrificing their branding or workflow
          needs.
        </p>
      </section>

      <section id={SECTION_IDS.features} role="region" aria-label="Features" className="space-y-8">
        <h2 className="text-3xl font-semibold text-[var(--brand-surface-contrast)]">
          Platform pillars
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: 'Attendance intelligence',
              description: 'Live roll calls, teacher snapshots, and AI-assisted anomaly detection.',
            },
            {
              title: 'Exam lifecycle',
              description:
                'Schedule, invigilate, and analyse results with automated grading workflows.',
            },
            {
              title: 'Fee transparency',
              description:
                'Invoices, payments, and ledger reconciliation with guardian notifications.',
            },
            {
              title: 'Reporting suite',
              description:
                'Multi-tenant dashboards with export-ready analytics for your leadership team.',
            },
            {
              title: 'Branding control',
              description: 'Tenant-specific typography, colour palettes, and navigation tokens.',
            },
          ].map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm"
            >
              <h3 className="text-xl font-semibold text-[var(--brand-surface-contrast)]">
                {feature.title}
              </h3>
              <p className="mt-3 text-[var(--brand-muted)]">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id={SECTION_IDS.pricing} role="region" aria-label="Pricing" className="space-y-8">
        <h2 className="text-3xl font-semibold text-[var(--brand-surface-contrast)]">MVP pricing</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              name: 'Starter',
              price: '$299/mo',
              perks: ['Up to 2 schools', 'Core attendance + exams', 'Email support'],
            },
            {
              name: 'Growth',
              price: '$699/mo',
              perks: ['Up to 10 schools', 'Advanced reporting', 'Priority onboarding'],
            },
            {
              name: 'Enterprise',
              price: 'Custom',
              perks: ['Unlimited tenants', 'Dedicated success', 'SLA-backed uptime'],
            },
          ].map((tier) => (
            <article
              key={tier.name}
              className="flex h-full flex-col gap-4 rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6"
            >
              <header>
                <h3 className="text-xl font-semibold text-[var(--brand-surface-contrast)]">
                  {tier.name}
                </h3>
                <p className="text-3xl font-bold text-[var(--brand-primary)]">{tier.price}</p>
              </header>
              <ul className="flex-1 space-y-2 text-sm text-[var(--brand-muted)]">
                {tier.perks.map((perk) => (
                  <li key={perk}>{perk}</li>
                ))}
              </ul>
              <Button variant="outline" onClick={() => onShowAuth?.('register')}>
                Talk to sales
              </Button>
            </article>
          ))}
        </div>
      </section>

      <section
        id={SECTION_IDS.topSchools}
        role="region"
        aria-label="Top schools"
        className="space-y-8"
      >
        <h2 className="text-3xl font-semibold text-[var(--brand-surface-contrast)]">
          Top schools in our network
        </h2>
        <p className="max-w-2xl text-[var(--brand-muted)]">
          Highlights from districts running mission-critical operations on our platform.
        </p>
        <TopSchools />
      </section>

      <section
        id={SECTION_IDS.contact}
        role="region"
        aria-label="Contact"
        className="rounded-3xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-8"
      >
        <div className="space-y-4 text-center md:text-left">
          <h2 className="text-3xl font-semibold text-[var(--brand-surface-contrast)]">
            Let’s align your district
          </h2>
          <p className="text-[var(--brand-muted)]">
            Email{' '}
            <a href="mailto:hello@saasschool.io" className="underline">
              hello@saasschool.io
            </a>{' '}
            or schedule a consult to see multi-tenant operations in action.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-4 md:justify-start">
            <Button onClick={() => onShowAuth?.('register')}>Request demo</Button>
            <Button variant="ghost" onClick={() => handleScroll('about')}>
              Explore platform
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default LandingPage;
