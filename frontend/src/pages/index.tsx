import React from 'react';
import MainLayout from '../layouts/MainLayout';
import { Button } from '../components/Button';

function HomePage() {
  return (
    <MainLayout>
      <section className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Multi-tenant SaaS School Management Portal
        </h1>
        <p className="mt-4 text-lg text-slate-300">
          Manage attendance, exams, fees, and role-based dashboards with schema-per-tenant isolation and secure
          onboarding workflows.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button>Get Started</Button>
          <Button variant="secondary">View Modules</Button>
        </div>
      </section>

      <section id="features" className="mt-16 grid gap-6 sm:grid-cols-2">
        {[
          {
            title: 'RBAC & Auth',
            description: 'Role-scoped dashboards and MFA-ready authentication for Students, Teachers, Admins, and SuperAdmins.'
          },
          {
            title: 'Schema-per-Tenant Postgres',
            description: 'Automated provisioning, per-tenant quotas, and safe data isolation by default.'
          },
          {
            title: 'Observability-first',
            description: 'Health checks, audit logs, and CI-friendly tests to ensure resilient deployments.'
          },
          {
            title: 'Modular Frontend',
            description: 'Composable layouts and components with Tailwind CSS for rapid iteration.'
          }
        ].map((feature) => (
          <article key={feature.title} className="rounded-lg border border-slate-800 bg-slate-900/60 p-6 text-left">
            <h2 className="text-xl font-semibold text-white">{feature.title}</h2>
            <p className="mt-2 text-sm text-slate-300">{feature.description}</p>
          </article>
        ))}
      </section>
    </MainLayout>
  );
}

export default HomePage;

