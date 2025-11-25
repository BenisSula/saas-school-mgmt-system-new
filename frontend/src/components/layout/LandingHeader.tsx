import { ThemeToggle } from '../ui/ThemeToggle';

const LINKS = [
  { label: 'About', section: 'about-section' },
  { label: 'Features', section: 'features-section' },
  { label: 'Pricing', section: 'pricing-section' },
  { label: 'Top schools', section: 'top-schools-section' },
  { label: 'Contact', section: 'contact-section' },
];

export interface LandingHeaderProps {
  onSignIn?: () => void;
}

export function LandingHeader({ onSignIn }: LandingHeaderProps) {
  const handleNavClick = (sectionId: string) => {
    if (typeof document === 'undefined') return;
    const element = document.getElementById(sectionId);
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <header className="border-b border-[var(--brand-border)] bg-slate-900/70 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 md:px-8">
        <span className="text-lg font-semibold tracking-tight">SaaS School Management</span>
        <nav className="hidden items-center gap-6 text-sm md:flex">
          {LINKS.map((link) => (
            <button
              key={link.section}
              type="button"
              className="text-slate-300 transition hover:text-white"
              onClick={() => handleNavClick(link.section)}
            >
              {link.label}
            </button>
          ))}
          <ThemeToggle />
          <button
            type="button"
            onClick={onSignIn}
            className="rounded-md border border-transparent bg-[var(--brand-primary)]/90 px-4 py-2 text-sm font-medium text-[var(--brand-primary-contrast)] transition hover:bg-[var(--brand-primary)]"
          >
            Sign in
          </button>
        </nav>
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={onSignIn}
            className="rounded-md border border-transparent bg-[var(--brand-primary)]/90 px-3 py-2 text-xs font-semibold text-[var(--brand-primary-contrast)] transition hover:bg-[var(--brand-primary)]"
          >
            Sign in
          </button>
        </div>
      </div>
    </header>
  );
}

export default LandingHeader;
