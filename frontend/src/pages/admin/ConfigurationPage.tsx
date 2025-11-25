import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import { api, type AcademicTerm, type BrandingConfig, type SchoolClass } from '../../lib/api';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { DatePicker } from '../../components/ui/DatePicker';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { useAsyncFeedback } from '../../hooks/useAsyncFeedback';
import { sanitizeText } from '../../lib/sanitize';
import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../lib/utils/date';
import { EditButton, DeleteButton, ActionButtonGroup } from '../../components/table-actions';
import { FormModal } from '../../components/shared';
import {
  useTerms,
  useCreateTerm,
  useUpdateTerm,
  useDeleteTerm,
} from '../../hooks/queries/useTerms';
import {
  useClasses,
  useCreateClass,
  useUpdateClass,
  useDeleteClass,
} from '../../hooks/queries/useClasses';
import { queryKeys } from '../../hooks/useQuery';

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
  themeFlags: {},
};

function toDateInput(value: string | null | undefined): string {
  if (!value) {
    return '';
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  if (value.length >= 10) {
    return value.slice(0, 10);
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return '';
}

// Using shared formatDate from utils

function validateTermInput(input: {
  name: string;
  startsOn: string;
  endsOn: string;
}): string | null {
  if (!input.name.trim()) {
    return 'Term name is required.';
  }
  if (!input.startsOn) {
    return 'Start date is required.';
  }
  if (!input.endsOn) {
    return 'End date is required.';
  }
  const start = new Date(input.startsOn);
  const end = new Date(input.endsOn);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 'Dates must be valid.';
  }
  if (start > end) {
    return 'End date must be after the start date.';
  }
  return null;
}

function validateClassInput(input: { name: string; description?: string }): string | null {
  if (!input.name.trim()) {
    return 'Class name is required.';
  }
  if (input.description && input.description.trim().length === 0) {
    return 'Description cannot be empty.';
  }
  return null;
}

function AdminConfigurationPage() {
  const { user } = useAuth();
  const [branding, setBranding] = useState<BrandingFormState>(defaultBranding);
  const [termForm, setTermForm] = useState({ name: '', startsOn: '', endsOn: '' });
  const [classForm, setClassForm] = useState({ name: '', description: '' });
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [termEditor, setTermEditor] = useState<{
    id: string;
    name: string;
    startsOn: string;
    endsOn: string;
  } | null>(null);
  const [classEditor, setClassEditor] = useState<{
    id: string;
    name: string;
    description: string;
  } | null>(null);
  const termModalInitialRef = useRef<HTMLInputElement>(null);
  const classModalInitialRef = useRef<HTMLInputElement>(null);
  const { status, message, setSuccess, setError, clear } = useAsyncFeedback();

  // Use React Query hooks
  const { data: terms = [] } = useTerms();
  const { data: classes = [] } = useClasses();
  const createTermMutation = useCreateTerm();
  const updateTermMutation = useUpdateTerm();
  const deleteTermMutation = useDeleteTerm();
  const createClassMutation = useCreateClass();
  const updateClassMutation = useUpdateClass();
  const deleteClassMutation = useDeleteClass();

  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    (async () => {
      try {
        const brandingResponse = await api.getBranding();
        if (!isMounted) return;

        if (brandingResponse) {
          setBranding({
            logoUrl: brandingResponse.logo_url ?? '',
            primaryColor: brandingResponse.primary_color ?? '',
            secondaryColor: brandingResponse.secondary_color ?? '',
            themeFlags: (brandingResponse.theme_flags as Record<string, boolean> | null) ?? {},
          });
        }
      } catch (error) {
        setError((error as Error).message);
        toast.error((error as Error).message);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [user, setError]);

  const brandingColumns = useMemo(
    () => [
      { header: 'Key', key: 'key' },
      { header: 'Value', key: 'value' },
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
        value:
          Object.entries(branding.themeFlags)
            .map(([flag, enabled]) => `${flag}: ${enabled ? 'on' : 'off'}`)
            .join(', ') || 'Not set',
      },
    ],
    [branding]
  );

  async function handleBrandingSave() {
    try {
      setPendingAction('save-branding');
      clear();
      const payload: Partial<BrandingConfig> = {
        logo_url: sanitizeText(branding.logoUrl),
        primary_color: sanitizeText(branding.primaryColor),
        secondary_color: sanitizeText(branding.secondaryColor),
        theme_flags: branding.themeFlags,
      };
      await api.updateBranding(payload);
      setSuccess('Branding saved.');
      toast.success('Branding updated');
    } catch (error) {
      setError((error as Error).message);
      toast.error((error as Error).message);
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCreateTerm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clear();
    const payload = {
      name: sanitizeText(termForm.name),
      startsOn: termForm.startsOn,
      endsOn: termForm.endsOn,
    };
    const validationMessage = validateTermInput(payload);
    if (validationMessage) {
      setError(validationMessage);
      toast.error(validationMessage);
      return;
    }
    try {
      await createTermMutation.mutateAsync(payload);
      setTermForm({ name: '', startsOn: '', endsOn: '' });
      setSuccess('Academic term recorded.');
    } catch (error) {
      setError((error as Error).message);
    }
  }

  async function handleCreateClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clear();
    const payload = {
      name: sanitizeText(classForm.name),
      description: classForm.description.trim() ? sanitizeText(classForm.description) : undefined,
    };
    const validationMessage = validateClassInput(payload);
    if (validationMessage) {
      setError(validationMessage);
      toast.error(validationMessage);
      return;
    }
    try {
      await createClassMutation.mutateAsync(payload);
      setClassForm({ name: '', description: '' });
      setSuccess('Class saved.');
    } catch (error) {
      setError((error as Error).message);
    }
  }

  const openTermEditor = useCallback(
    (term: AcademicTerm) => {
      clear();
      setTermEditor({
        id: term.id,
        name: term.name,
        startsOn: toDateInput(term.starts_on),
        endsOn: toDateInput(term.ends_on),
      });
    },
    [clear]
  );

  const closeTermEditor = useCallback(() => {
    setTermEditor(null);
  }, []);

  const getTermUpdateVariables = ():
    | { id: string; data: { name: string; startsOn: string; endsOn: string } }
    | undefined => {
    if (!termEditor) return undefined;

    const payload = {
      name: sanitizeText(termEditor.name),
      startsOn: termEditor.startsOn,
      endsOn: termEditor.endsOn,
    };
    const validationMessage = validateTermInput(payload);
    if (validationMessage) {
      setError(validationMessage);
      toast.error(validationMessage);
      return undefined;
    }

    return {
      id: termEditor.id,
      data: payload,
    };
  };

  const openClassEditor = useCallback(
    (classItem: SchoolClass) => {
      clear();
      setClassEditor({
        id: classItem.id,
        name: classItem.name,
        description: classItem.description ?? '',
      });
    },
    [clear]
  );

  const closeClassEditor = useCallback(() => {
    setClassEditor(null);
  }, []);

  const getClassUpdateVariables = ():
    | { id: string; data: { name: string; description?: string } }
    | undefined => {
    if (!classEditor) return undefined;

    const payload = {
      name: sanitizeText(classEditor.name),
      description: classEditor.description.trim()
        ? sanitizeText(classEditor.description)
        : undefined,
    };
    const validationMessage = validateClassInput(payload);
    if (validationMessage) {
      setError(validationMessage);
      toast.error(validationMessage);
      return undefined;
    }

    return {
      id: classEditor.id,
      data: payload,
    };
  };

  const termColumns = useMemo(
    () => [
      { header: 'Term', key: 'name' },
      {
        header: 'Starts',
        key: 'starts_on',
        render: (row: AcademicTerm) => formatDate(row.starts_on),
      },
      {
        header: 'Ends',
        key: 'ends_on',
        render: (row: AcademicTerm) => formatDate(row.ends_on),
      },
      {
        header: 'Actions',
        key: 'actions',
        render: (row: AcademicTerm) => {
          return (
            <ActionButtonGroup>
              <EditButton
                onClick={() => {
                  openTermEditor(row);
                }}
                disabled={deleteTermMutation.isPending || updateTermMutation.isPending}
              />
              <DeleteButton
                mutation={deleteTermMutation}
                variables={row.id}
                invalidateQueries={[queryKeys.admin.subjects()] as unknown as unknown[][]}
                messages={{
                  pending: 'Deleting term...',
                  success: 'Term deleted successfully',
                  error: 'Failed to delete term',
                }}
                confirmMessage={`Delete "${row.name}"? This cannot be undone and may impact reporting tied to this term.`}
                onSuccess={() => {
                  if (termEditor?.id === row.id) {
                    setTermEditor(null);
                  }
                }}
              />
            </ActionButtonGroup>
          );
        },
      },
    ],
    [openTermEditor, deleteTermMutation, updateTermMutation, termEditor]
  );

  const classColumns = useMemo(
    () => [
      { header: 'Class', key: 'name' },
      {
        header: 'Description',
        key: 'description',
        render: (row: SchoolClass) => row.description ?? '—',
      },
      {
        header: 'Actions',
        key: 'actions',
        render: (row: SchoolClass) => {
          return (
            <ActionButtonGroup>
              <EditButton
                onClick={() => {
                  openClassEditor(row);
                }}
                disabled={deleteClassMutation.isPending || updateClassMutation.isPending}
              />
              <DeleteButton
                mutation={deleteClassMutation}
                variables={row.id}
                invalidateQueries={[queryKeys.admin.classes()] as unknown as unknown[][]}
                messages={{
                  pending: 'Deleting class...',
                  success: 'Class deleted successfully',
                  error: 'Failed to delete class',
                }}
                confirmMessage={`Delete class "${row.name}"? Students mapped to this class may appear in unassigned listings.`}
                onSuccess={() => {
                  if (classEditor?.id === row.id) {
                    setClassEditor(null);
                  }
                }}
              />
            </ActionButtonGroup>
          );
        },
      },
    ],
    [openClassEditor, deleteClassMutation, updateClassMutation, classEditor]
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Tenant Configuration</h1>
        <p className="text-sm text-slate-300">
          Manage branding, academic terms, and classes for the active tenant.
        </p>
      </div>

      {message ? <StatusBanner status={status} message={message} onDismiss={clear} /> : null}

      <section className="rounded-lg border border-[var(--brand-border)] bg-slate-900/60 p-6 shadow-lg">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Branding</h2>
            <p className="text-sm text-slate-400">
              Update logos, colors, and feature flags. Changes apply across all tenant pages.
            </p>
          </div>
          <Button
            onClick={handleBrandingSave}
            loading={pendingAction === 'save-branding'}
            disabled={pendingAction !== null && pendingAction !== 'save-branding'}
          >
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
            disabled={pendingAction === 'save-branding'}
          />
          <Input
            label="Primary color"
            placeholder="#1d4ed8"
            value={branding.primaryColor}
            onChange={(event) =>
              setBranding((state) => ({ ...state, primaryColor: event.target.value }))
            }
            disabled={pendingAction === 'save-branding'}
          />
          <Input
            label="Secondary color"
            placeholder="#0f172a"
            value={branding.secondaryColor}
            onChange={(event) =>
              setBranding((state) => ({ ...state, secondaryColor: event.target.value }))
            }
            disabled={pendingAction === 'save-branding'}
          />
          <Select
            label="Dark mode"
            value={branding.themeFlags.darkMode ? 'enabled' : 'disabled'}
            onChange={(event) =>
              setBranding((state) => ({
                ...state,
                themeFlags: { ...state.themeFlags, darkMode: event.target.value === 'enabled' },
              }))
            }
            options={[
              { label: 'Enabled', value: 'enabled' },
              { label: 'Disabled', value: 'disabled' },
            ]}
            disabled={pendingAction === 'save-branding'}
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
            disabled={pendingAction === 'create-term'}
          />
          <DatePicker
            label="Start date"
            required
            value={termForm.startsOn}
            onChange={(event) =>
              setTermForm((state) => ({ ...state, startsOn: event.target.value }))
            }
            disabled={pendingAction === 'create-term'}
          />
          <DatePicker
            label="End date"
            required
            value={termForm.endsOn}
            onChange={(event) => setTermForm((state) => ({ ...state, endsOn: event.target.value }))}
            disabled={pendingAction === 'create-term'}
          />
          <Button
            type="submit"
            loading={pendingAction === 'create-term'}
            className="self-end"
            disabled={pendingAction !== null && pendingAction !== 'create-term'}
          >
            Add term
          </Button>
        </form>
        <div className="mt-4">
          <Table
            columns={termColumns}
            data={terms}
            caption="Academic terms"
            emptyMessage="No academic terms recorded yet."
          />
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
            onChange={(event) => setClassForm((state) => ({ ...state, name: event.target.value }))}
            disabled={pendingAction === 'create-class'}
          />
          <Input
            label="Description"
            placeholder="Lower senior"
            value={classForm.description}
            onChange={(event) =>
              setClassForm((state) => ({ ...state, description: event.target.value }))
            }
            disabled={pendingAction === 'create-class'}
          />
          <Button
            type="submit"
            loading={pendingAction === 'create-class'}
            className="self-end"
            disabled={pendingAction !== null && pendingAction !== 'create-class'}
          >
            Add class
          </Button>
        </form>
        <div className="mt-4">
          <Table
            columns={classColumns}
            data={classes}
            caption="Classes"
            emptyMessage="No classes created for this tenant."
          />
        </div>
      </section>
      <FormModal
        title="Edit academic term"
        isOpen={Boolean(termEditor)}
        onClose={closeTermEditor}
        mutation={updateTermMutation}
        variables={getTermUpdateVariables()}
        invalidateQueries={[queryKeys.admin.subjects()] as unknown as unknown[][]}
        messages={{
          pending: 'Updating term...',
          success: 'Term updated successfully',
          error: 'Failed to update term',
        }}
        onSuccess={() => {
          setTermEditor(null);
          setSuccess('Academic term updated.');
        }}
      >
        {termEditor ? (
          <div className="space-y-4">
            <Input
              ref={termModalInitialRef}
              label="Term name"
              value={termEditor.name}
              onChange={(event) =>
                setTermEditor((state) => (state ? { ...state, name: event.target.value } : state))
              }
              required
              disabled={updateTermMutation.isPending}
            />
            <DatePicker
              label="Start date"
              value={termEditor.startsOn}
              onChange={(event) =>
                setTermEditor((state) =>
                  state ? { ...state, startsOn: event.target.value } : state
                )
              }
              required
              disabled={updateTermMutation.isPending}
            />
            <DatePicker
              label="End date"
              value={termEditor.endsOn}
              onChange={(event) =>
                setTermEditor((state) => (state ? { ...state, endsOn: event.target.value } : state))
              }
              required
              disabled={updateTermMutation.isPending}
            />
            <p className="text-xs text-slate-400">
              Updating a term will reflect across schedules, attendance windows, and reporting
              rollups.
            </p>
          </div>
        ) : null}
      </FormModal>
      <FormModal
        title="Edit class"
        isOpen={Boolean(classEditor)}
        onClose={closeClassEditor}
        mutation={updateClassMutation}
        variables={getClassUpdateVariables()}
        invalidateQueries={[queryKeys.admin.classes()] as unknown as unknown[][]}
        messages={{
          pending: 'Updating class...',
          success: 'Class updated successfully',
          error: 'Failed to update class',
        }}
        onSuccess={() => {
          setClassEditor(null);
          setSuccess('Class updated.');
        }}
      >
        {classEditor ? (
          <div className="space-y-4">
            <Input
              ref={classModalInitialRef}
              label="Class name"
              value={classEditor.name}
              onChange={(event) =>
                setClassEditor((state) => (state ? { ...state, name: event.target.value } : state))
              }
              required
              disabled={updateClassMutation.isPending}
            />
            <Input
              label="Description"
              value={classEditor.description}
              onChange={(event) =>
                setClassEditor((state) =>
                  state ? { ...state, description: event.target.value } : state
                )
              }
              placeholder="e.g. Lower senior"
              disabled={updateClassMutation.isPending}
            />
            <p className="text-xs text-slate-400">
              Editing a class will propagate to attendance rosters, gradebooks, and fee schedules.
            </p>
          </div>
        ) : null}
      </FormModal>
    </div>
  );
}

export default AdminConfigurationPage;
