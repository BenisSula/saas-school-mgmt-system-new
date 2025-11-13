import { useBrand } from '../ui/BrandProvider';

export function LandingFooter() {
  const year = new Date().getFullYear();
  const { tokens } = useBrand();
  return (
    <footer className="border-t bg-slate-900/70" style={{ borderColor: tokens.border }}>
      <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-slate-400 md:px-8">
        © {year} SaaS School Management. All rights reserved.
      </div>
    </footer>
  );
}

export default LandingFooter;
