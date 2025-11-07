import React from 'react';

export interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <span className="text-lg font-semibold tracking-tight">SaaS School Portal</span>
          <nav className="space-x-4 text-sm">
            <a className="text-slate-300 hover:text-white" href="#features">
              Features
            </a>
            <a className="text-slate-300 hover:text-white" href="#modules">
              Modules
            </a>
            <a className="text-slate-300 hover:text-white" href="#contact">
              Contact
            </a>
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-4 py-10">{children}</main>
      <footer className="border-t border-slate-800 bg-slate-900">
        <div className="container mx-auto px-4 py-6 text-sm text-slate-400">
          © {new Date().getFullYear()} SaaS School Management. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

export default MainLayout;

