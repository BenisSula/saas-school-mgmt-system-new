import React, { useEffect, useMemo, useState } from 'react';
import { api, type AcademicTerm, type BrandingConfig, type SchoolClass } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Table } from '../components/ui/Table';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { DatePicker } from '../components/ui/DatePicker';

interface BrandingFormState {
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  themeFlags: Record<string, boolean>;
}

const defaultBranding: BrandingFormState = {
  logoUrl: '',
  primaryColor: '#1d4ed8',
  secondaryColor: '#0f172a',
  themeFlags: {}
};

function AdminConfigurationPage() {
  const [branding, setBranding] = useState<BrandingFormState>(defaultBranding);
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [termForm, setTermForm] = useState({ name: '', startsOn: '', endsOn: '' });
  const [classForm, setClassForm] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'info' | 'error'>('info');

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [brandingResponse, termsResponse, classesResponse] = await Promise.all([
          api.getBranding(),
          api.listTerms(),
          api.listClasses()
        ]);
        if (!isMounted) return;

        if (brandingResponse) {
          setBranding({
            logoUrl: brandingResponse.logo_url ?? '',
            primaryColor: brandingResponse.primary_color ?? '',
            secondaryColor: brandingResponse.secondary_color ?? '',
            themeFlags: (brandingResponse.theme_flags as Record<string, boolean> | null) ?? {}
          });
        }
        setTerms(termsResponse);
        setClasses(classesResponse);
      } catch (error) {
        setMessage((error as Error).message);
        setStatusType('error');
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const brandingColumns = useMemo(
    () => [
      { header: 'Key', key: 'key' },
      { header: 'Value', key: 'value' }
    ],
    []
  );

  const termColumns = useMemo(
    () => [
      { header: 'Term', key: 'name' },
      { header: 'Starts', key: 'starts_on' },
      { header: 'Ends', key: 'ends_on' }
    ],
    []
  );

  const classColumns = useMemo(
    () => [
      { header: 'Class', key: 'name' },
      { header: 'Description', key: 'description' }
    ],
    []
  );

  const brandingData = useMemo(
    () => [
      { key: 'Logo URL', value: branding.logoUrl || 'Not set' },
      { key: 'Primary Color', value: branding.primaryColor || 'Not set' },
      { key: 'Secondary Color', value: branding.secondaryColor || 'Not set' },
      {
        key: 'Theme Flags',
        value: Object.entries(branding.themeFlags)
          .map(([flag, enabled]) => `${flag}: ${enabled ? 'on' : 'off'}`)
          .join(', ') || 'Not set'
      }
    ],
    [branding]
  );

  async function handleBrandingSave() {
    try {
      setLoading(true);
      setMessage(null);
      const payload: Partial<BrandingConfig> = {
        logo_url: branding.logoUrl,
        primary_color: branding.primaryColor,
        secondary_color: branding.secondaryColor,
        theme_flags: branding.themeFlags
      };
      await api.updateBranding(payload);
      setMessage('Branding saved.');
      setStatusType('info');
    } catch (error) {
      setMessage((error as Error).message);
      setStatusType('error');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateTerm(event: React.FormEvent) {
    event.preventDefault();
    try {
      setLoading(true);
      setMessage(null);
      const created = await api.createTerm(termForm);
      setTerms((current) => [created, ...current]);
      setTermForm({ name: '', startsOn: '', endsOn: '' });
      setMessage('Academic term recorded.');
      setStatusType('info');
    } catch (error) {
      setMessage((error as Error).message);
      setStatusType('error');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateClass(event: React.FormEvent) {
    event.preventDefault();
    try {
      setLoading(true);
      setMessage(null);
      const created = await api.createClass(classForm);
      setClasses((current) => [created, ...current]);
      setClassForm({ name: '', description: '' });
      setMessage('Class saved.');
      setStatusType('info');
    } catch (error) {
      setMessage((error as Error).message);
      setStatusType('error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Tenant Configuration</h1>
        <p className="text-sm text-slate-300">
          Manage branding, academic terms, and classes for the active tenant.
        </p>
      </div>

      {message ? (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-md px-4 py-3 text-sm ${
            statusType === 'error'
              ? 'border border-red-500 bg-red-500/10 text-red-200'
              : 'border border-[var(--brand-border)] bg-slate-900/70 text-slate-100'
          }`}
        >
          {message}
        </div>
      ) : null}

      <section className="rounded-lg border border-[var(--brand-border)] bg-slate-900/60 p-6 shadow-lg">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Branding</h2>
            <p className="text-sm text-slate-400">
              Update logos, colors, and feature flags. Changes apply across all tenant pages.
            </p>
          </div>
          <Button onClick={handleBrandingSave} loading={loading}>
            Save branding
          </Button>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Logo URL"
            placeholder="https://cdn.school/logo.svg"
            value={branding.logoUrl}
            onChange={(event) =>
              setBranding((state) => ({ ...state, logoUrl: event.target.value }))
            }
          />
          <Input
            label="Primary color"
            placeholder="#1d4ed8"
            value={branding.primaryColor}
            onChange={(event) =>
              setBranding((state) => ({ ...state, primaryColor: event.target.value }))
            }
          />
          <Input
            label="Secondary color"
            placeholder="#0f172a"
            value={branding.secondaryColor}
            onChange={(event) =>
              setBranding((state) => ({ ...state, secondaryColor: event.target.value }))
            }
          />
          <Select
            label="Dark mode"
            value={branding.themeFlags.darkMode ? 'enabled' : 'disabled'}
            onChange={(event) =>
              setBranding((state) => ({
                ...state,
                themeFlags: { ...state.themeFlags, darkMode: event.target.value === 'enabled' }
              }))
            }
            options={[
              { label: 'Enabled', value: 'enabled' },
              { label: 'Disabled', value: 'disabled' }
            ]}
          />
        </div>

        <div className="mt-6">
          <Table columns={brandingColumns} data={brandingData} caption="Branding overview" />
        </div>
      </section>

      <section className="rounded-lg border border-[var(--brand-border)] bg-slate-900/60 p-6 shadow-lg">
        <header className="mb-4">
          <h2 className="text-xl font-semibold">Academic terms</h2>
          <p className="text-sm text-slate-400">
            Define school calendar segments for reporting, attendance, and exams.
          </p>
        </header>
        <form className="grid gap-4 sm:grid-cols-4" onSubmit={handleCreateTerm}>
          <Input
            label="Term name"
            placeholder="e.g. Spring 2025"
            required
            value={termForm.name}
            onChange={(event) => setTermForm((state) => ({ ...state, name: event.target.value }))}
          />
          <DatePicker
            label="Start date"
            required
            value={termForm.startsOn}
            onChange={(event) =>
              setTermForm((state) => ({ ...state, startsOn: event.target.value }))
            }
          />
          <DatePicker
            label="End date"
            required
            value={termForm.endsOn}
            onChange={(event) =>
              setTermForm((state) => ({ ...state, endsOn: event.target.value }))
            }
          />
          <Button type="submit" loading={loading} className="self-end">
            Add term
          </Button>
        </form>
        <div className="mt-4">
          <Table columns={termColumns} data={terms} caption="Academic terms" />
        </div>
      </section>

      <section className="rounded-lg border border-[var(--brand-border)] bg-slate-900/60 p-6 shadow-lg">
        <header className="mb-4">
          <h2 className="text-xl font-semibold">Classes</h2>
          <p className="text-sm text-slate-400">
            Manage class groupings used throughout attendance, results, and invoicing.
          </p>
        </header>
        <form className="grid gap-4 sm:grid-cols-3" onSubmit={handleCreateClass}>
          <Input
            label="Class name"
            placeholder="Grade 9"
            required
            value={classForm.name}
            onChange={(event) =>
              setClassForm((state) => ({ ...state, name: event.target.value }))
            }
          />
          <Input
            label="Description"
            placeholder="Lower senior"
            value={classForm.description}
            onChange={(event) =>
              setClassForm((state) => ({ ...state, description: event.target.value }))
            }
          />
          <Button type="submit" loading={loading} className="self-end">
            Add class
          </Button>
        </form>
        <div className="mt-4">
          <Table columns={classColumns} data={classes} caption="Classes" />
        </div>
      </section>
    </div>
  );
}

export default AdminConfigurationPage;

