import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { RouteMeta } from '../../components/layout/RouteMeta';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Table, type TableColumn } from '../../components/ui/Table';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { useAsyncFeedback } from '../../hooks/useAsyncFeedback';
import {
  api,
  type PlatformSchool,
  type SubscriptionTier,
  type TenantLifecycleStatus
} from '../../lib/api';
import { formatDate } from '../../lib/utils/date';

type FormMode = 'create' | 'edit';

interface SchoolFormState {
  id?: string;
  name: string;
  address: string;
  contactPhone: string;
  contactEmail: string;
  registrationCode: string;
  domain: string;
  subscriptionType: SubscriptionTier;
  billingEmail: string;
  status: TenantLifecycleStatus;
}

interface AdminFormState {
  schoolId: string;
  email: string;
  password: string;
  username: string;
  fullName: string;
  phone: string;
}

const defaultFormState: SchoolFormState = {
  name: '',
  address: '',
  contactPhone: '',
  contactEmail: '',
  registrationCode: '',
  domain: '',
  subscriptionType: 'trial',
  billingEmail: '',
  status: 'active'
};

const subscriptionOptions: Array<{ label: string; value: SubscriptionTier }> = [
  { label: 'Free', value: 'free' },
  { label: 'Trial', value: 'trial' },
  { label: 'Paid', value: 'paid' }
];

const statusOptions: Array<{ label: string; value: TenantLifecycleStatus }> = [
  { label: 'Active', value: 'active' },
  { label: 'Suspended', value: 'suspended' },
  { label: 'Deleted', value: 'deleted' }
];

export function SuperuserManageSchoolsPage() {
  const [schools, setSchools] = useState<PlatformSchool[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showSchoolModal, setShowSchoolModal] = useState<boolean>(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [formState, setFormState] = useState<SchoolFormState>(defaultFormState);
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);
  const [adminFormState, setAdminFormState] = useState<AdminFormState>({
    schoolId: '',
    email: '',
    password: '',
    username: '',
    fullName: '',
    phone: ''
  });
  const [showAnalyticsModal, setShowAnalyticsModal] = useState<boolean>(false);
  const [selectedSchoolForAnalytics, setSelectedSchoolForAnalytics] =
    useState<PlatformSchool | null>(null);
  const {
    status: feedbackStatus,
    message: feedbackMessage,
    setError: setFeedbackError,
    clear
  } = useAsyncFeedback();

  const loadSchools = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.superuser.listSchools();
      setSchools(result);
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSchools();
  }, [loadSchools]);

  const openCreateModal = () => {
    setFormMode('create');
    setFormState(defaultFormState);
    setShowSchoolModal(true);
  };

  const openEditModal = (school: PlatformSchool) => {
    setFormMode('edit');
    setFormState({
      id: school.id,
      name: school.name,
      address: school.address ?? '',
      contactPhone: school.contactPhone ?? '',
      contactEmail: school.contactEmail ?? '',
      registrationCode: school.registrationCode ?? '',
      domain: school.domain ?? '',
      subscriptionType: school.subscriptionType,
      billingEmail: school.billingEmail ?? '',
      status: school.status
    });
    setShowSchoolModal(true);
  };

  const openAdminModal = (school: PlatformSchool) => {
    setAdminFormState({
      schoolId: school.id,
      email: '',
      password: '',
      username: '',
      fullName: '',
      phone: ''
    });
    setShowAdminModal(true);
  };

  const handleSaveSchool = async () => {
    // Client-side validation
    if (!formState.name.trim()) {
      toast.error('School name is required');
      return;
    }
    if (!formState.address.trim()) {
      toast.error('School address is required');
      return;
    }
    if (!formState.contactPhone.trim()) {
      toast.error('Contact phone is required');
      return;
    }
    if (!formState.contactEmail.trim()) {
      toast.error('Contact email is required');
      return;
    }
    if (!formState.registrationCode.trim()) {
      toast.error('Registration code is required');
      return;
    }
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formState.contactEmail)) {
      toast.error('Please enter a valid contact email address');
      return;
    }
    if (formState.billingEmail && !emailRegex.test(formState.billingEmail)) {
      toast.error('Please enter a valid billing email address');
      return;
    }

    try {
      // Prepare payload - convert empty strings to undefined for optional fields
      const prepareOptionalField = (value: string | undefined): string | undefined => {
        const trimmed = value?.trim();
        return trimmed && trimmed.length > 0 ? trimmed : undefined;
      };

      if (formMode === 'create') {
        await api.superuser.createSchool({
          name: formState.name.trim(),
          address: formState.address.trim(),
          contactPhone: formState.contactPhone.trim(),
          contactEmail: formState.contactEmail.trim(),
          registrationCode: formState.registrationCode.trim(),
          domain: prepareOptionalField(formState.domain),
          subscriptionType: formState.subscriptionType,
          billingEmail: prepareOptionalField(formState.billingEmail)
        });
        toast.success(`School "${formState.name}" created successfully`);
      } else if (formState.id) {
        await api.superuser.updateSchool(formState.id, {
          name: formState.name.trim(),
          address: prepareOptionalField(formState.address),
          contactPhone: prepareOptionalField(formState.contactPhone),
          contactEmail: prepareOptionalField(formState.contactEmail),
          registrationCode: prepareOptionalField(formState.registrationCode),
          domain: prepareOptionalField(formState.domain),
          subscriptionType: formState.subscriptionType,
          billingEmail: prepareOptionalField(formState.billingEmail),
          status: formState.status
        });
        toast.success(`School "${formState.name}" updated successfully`);
      }
      setShowSchoolModal(false);
      await loadSchools();
    } catch (err) {
      // Handle API errors with user-friendly messages
      let errorMessage = 'Failed to save school. Please try again.';
      
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'object' && err !== null) {
        const apiError = err as { message?: string; errors?: Array<{ message: string; path: string[] }> };
        if (apiError.message) {
          errorMessage = apiError.message;
        } else if (apiError.errors && Array.isArray(apiError.errors) && apiError.errors.length > 0) {
          // Format Zod validation errors
          const formattedErrors = apiError.errors.map((e) => {
            const field = e.path.join(' ');
            return `${field}: ${e.message}`;
          });
          errorMessage = formattedErrors.join('; ');
        }
      }
      
      toast.error(errorMessage);
    }
  };

  const handleDeleteSchool = async (school: PlatformSchool) => {
    if (!window.confirm(`Delete ${school.name}? This will archive the tenant.`)) {
      return;
    }
    try {
      await api.superuser.deleteSchool(school.id);
      toast.success(`${school.name} archived`);
      await loadSchools();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleCreateAdmin = async () => {
    try {
      await api.superuser.createSchoolAdmin(adminFormState.schoolId, {
        email: adminFormState.email,
        password: adminFormState.password,
        username: adminFormState.username,
        fullName: adminFormState.fullName,
        phone: adminFormState.phone || undefined
      });
      toast.success('Admin user created');
      setShowAdminModal(false);
      clear();
    } catch (err) {
      const message = (err as Error).message;
      setFeedbackError(message);
      toast.error(message);
    }
  };

  const handleStatusToggle = useCallback(
    async (school: PlatformSchool, status: TenantLifecycleStatus) => {
      try {
        await api.superuser.updateSchool(school.id, { status });
        toast.success(`${school.name} marked as ${status}`);
        await loadSchools();
      } catch (err) {
        toast.error((err as Error).message);
      }
    },
    [loadSchools]
  );

  const openAnalyticsModal = (school: PlatformSchool) => {
    setSelectedSchoolForAnalytics(school);
    setShowAnalyticsModal(true);
  };

  const schoolColumns: TableColumn<PlatformSchool>[] = [
    {
      header: 'School',
      render: (row) => (
        <div>
          <p className="font-semibold text-[var(--brand-surface-contrast)]">{row.name}</p>
          <p className="text-xs text-[var(--brand-muted)]">
            {row.registrationCode ? `${row.registrationCode} • ` : ''}
            {row.domain ?? 'No domain assigned'}
          </p>
        </div>
      )
    },
    {
      header: 'Subscription',
      render: (row) => row.subscriptionType.charAt(0).toUpperCase() + row.subscriptionType.slice(1)
    },
    {
      header: 'Status',
      render: (row) => (
        <span
          className={`rounded-full px-2 py-1 text-xs font-semibold ${
            row.status === 'active'
              ? 'bg-emerald-500/20 text-emerald-200'
              : row.status === 'suspended'
                ? 'bg-amber-500/20 text-amber-200'
                : 'bg-rose-500/20 text-rose-200'
          }`}
        >
          {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
        </span>
      )
    },
    {
      header: 'Users',
      key: 'userCount',
      align: 'center'
    },
    {
      header: 'Created',
      render: (row) => formatDate(row.createdAt)
    },
    {
      header: 'Actions',
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => openEditModal(row)}>
            Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={() => openAnalyticsModal(row)}>
            Analytics
          </Button>
          <Button size="sm" variant="ghost" onClick={() => openAdminModal(row)}>
            Add admin
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              handleStatusToggle(row, row.status === 'active' ? 'suspended' : 'active')
            }
          >
            {row.status === 'active' ? 'Suspend' : 'Activate'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleDeleteSchool(row)}>
            Delete
          </Button>
        </div>
      )
    }
  ];

  return (
    <RouteMeta title="Manage schools">
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
              Manage schools
            </h1>
            <p className="text-sm text-[var(--brand-muted)]">
              Provision, update, or suspend tenant environments across the platform.
            </p>
          </div>
          <Button onClick={openCreateModal}>Create school</Button>
        </header>

        {error ? <StatusBanner status="error" message={error} /> : null}

        <Table
          columns={schoolColumns}
          data={schools}
          caption="Provisioned schools"
          emptyMessage={loading ? 'Loading schools…' : 'No schools have been created yet.'}
        />
      </div>

      <Modal
        title={formMode === 'create' ? 'Create New School' : 'Edit School'}
        isOpen={showSchoolModal}
        onClose={() => setShowSchoolModal(false)}
      >
        <div className="space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Basic Information Section */}
          <div className="space-y-4">
            <div className="border-b border-[var(--brand-border)]/60 pb-2">
              <h3 className="text-sm font-semibold text-[var(--brand-surface-contrast)] uppercase tracking-wide">
                Basic Information
              </h3>
              <p className="text-xs text-[var(--brand-muted)] mt-1">
                Essential details about the school
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Input
                  label="School Name"
                  required
                  placeholder="Enter school name"
                  value={formState.name}
                  onChange={(event) => setFormState((state) => ({ ...state, name: event.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <Input
                  label="Registration Code"
                  required
                  placeholder="Enter unique registration code"
                  value={formState.registrationCode}
                  onChange={(event) =>
                    setFormState((state) => ({ ...state, registrationCode: event.target.value }))
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-[var(--brand-surface-contrast)] mb-2">
                  Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="w-full px-3 py-2 text-sm bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-md text-[var(--brand-surface-contrast)] placeholder-[var(--brand-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                  rows={3}
                  placeholder="Enter complete school address"
                  value={formState.address}
                  onChange={(event) =>
                    setFormState((state) => ({ ...state, address: event.target.value }))
                  }
                  required
                />
              </div>
            </div>
          </div>

          {/* Contact Information Section */}
          <div className="space-y-4">
            <div className="border-b border-[var(--brand-border)]/60 pb-2">
              <h3 className="text-sm font-semibold text-[var(--brand-surface-contrast)] uppercase tracking-wide">
                Contact Information
              </h3>
              <p className="text-xs text-[var(--brand-muted)] mt-1">
                Primary contact details for the school
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Contact Email"
                type="email"
                required
                placeholder="contact@school.com"
                value={formState.contactEmail}
                onChange={(event) =>
                  setFormState((state) => ({ ...state, contactEmail: event.target.value }))
                }
              />
              <Input
                label="Contact Phone"
                type="tel"
                required
                placeholder="+1 (555) 123-4567"
                value={formState.contactPhone}
                onChange={(event) =>
                  setFormState((state) => ({ ...state, contactPhone: event.target.value }))
                }
              />
            </div>
          </div>

          {/* Subscription & Billing Section */}
          <div className="space-y-4">
            <div className="border-b border-[var(--brand-border)]/60 pb-2">
              <h3 className="text-sm font-semibold text-[var(--brand-surface-contrast)] uppercase tracking-wide">
                Subscription & Billing
              </h3>
              <p className="text-xs text-[var(--brand-muted)] mt-1">
                Configure subscription tier and billing preferences
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Subscription Tier"
                value={formState.subscriptionType}
                onChange={(event) =>
                  setFormState((state) => ({
                    ...state,
                    subscriptionType: event.target.value as SubscriptionTier
                  }))
                }
                options={subscriptionOptions.map((option) => ({
                  label: option.label,
                  value: option.value
                }))}
              />
              <Input
                label="Billing Email"
                type="email"
                placeholder="billing@school.com"
                value={formState.billingEmail}
                onChange={(event) =>
                  setFormState((state) => ({ ...state, billingEmail: event.target.value }))
                }
              />
            </div>
          </div>

          {/* Domain & Status Section */}
          <div className="space-y-4">
            <div className="border-b border-[var(--brand-border)]/60 pb-2">
              <h3 className="text-sm font-semibold text-[var(--brand-surface-contrast)] uppercase tracking-wide">
                Advanced Settings
              </h3>
              <p className="text-xs text-[var(--brand-muted)] mt-1">
                Optional configuration and status management
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Custom Domain"
                placeholder="school.example.com"
                value={formState.domain}
                onChange={(event) =>
                  setFormState((state) => ({ ...state, domain: event.target.value }))
                }
              />
              {formMode === 'edit' ? (
                <Select
                  label="Status"
                  value={formState.status}
                  onChange={(event) =>
                    setFormState((state) => ({
                      ...state,
                      status: event.target.value as TenantLifecycleStatus
                    }))
                  }
                  options={statusOptions.map((option) => ({
                    label: option.label,
                    value: option.value
                  }))}
                />
              ) : (
                <div />
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--brand-border)]/60">
            <Button variant="ghost" onClick={() => setShowSchoolModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSchool}>
              {formMode === 'create' ? 'Create School' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        title="Create admin account"
        isOpen={showAdminModal}
        onClose={() => {
          setShowAdminModal(false);
          clear();
        }}
      >
        <div className="space-y-4">
          <Input
            label="Email"
            type="email"
            required
            value={adminFormState.email}
            onChange={(event) =>
              setAdminFormState((state) => ({ ...state, email: event.target.value }))
            }
          />
          <Input
            label="Username"
            required
            value={adminFormState.username}
            onChange={(event) =>
              setAdminFormState((state) => ({ ...state, username: event.target.value }))
            }
          />
          <Input
            label="Full name"
            required
            value={adminFormState.fullName}
            onChange={(event) =>
              setAdminFormState((state) => ({ ...state, fullName: event.target.value }))
            }
          />
          <Input
            label="Contact phone"
            value={adminFormState.phone}
            onChange={(event) =>
              setAdminFormState((state) => ({ ...state, phone: event.target.value }))
            }
          />
          <Input
            label="Temporary password"
            type="password"
            required
            value={adminFormState.password}
            onChange={(event) =>
              setAdminFormState((state) => ({ ...state, password: event.target.value }))
            }
          />
          {feedbackMessage ? (
            <StatusBanner status={feedbackStatus} message={feedbackMessage} onDismiss={clear} />
          ) : null}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowAdminModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateAdmin}>Create admin</Button>
          </div>
        </div>
      </Modal>

      {showAnalyticsModal && selectedSchoolForAnalytics && (
        <Modal
          title={`Usage analytics: ${selectedSchoolForAnalytics.name}`}
          isOpen={showAnalyticsModal}
          onClose={() => {
            setShowAnalyticsModal(false);
            setSelectedSchoolForAnalytics(null);
          }}
        >
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-[var(--brand-border)]/60 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--brand-muted)]">
                  Total users
                </p>
                <p className="mt-1 text-2xl font-semibold text-[var(--brand-surface-contrast)]">
                  {selectedSchoolForAnalytics.userCount || 0}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--brand-border)]/60 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--brand-muted)]">
                  Schema name
                </p>
                <p className="mt-1 text-sm font-mono text-[var(--brand-surface-contrast)] break-all">
                  {selectedSchoolForAnalytics.schemaName}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--brand-border)]/60 bg-slate-950/40 p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--brand-muted)]">Created</p>
                <p className="mt-1 text-sm text-[var(--brand-surface-contrast)]">
                  {formatDate(selectedSchoolForAnalytics.createdAt)}
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-[var(--brand-border)]/60 bg-slate-950/40 p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--brand-muted)] mb-2">
                Tenant information
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--brand-muted)]">Subscription:</span>
                  <span className="text-[var(--brand-surface-contrast)] capitalize">
                    {selectedSchoolForAnalytics.subscriptionType}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--brand-muted)]">Status:</span>
                  <span className="text-[var(--brand-surface-contrast)] capitalize">
                    {selectedSchoolForAnalytics.status}
                  </span>
                </div>
                {selectedSchoolForAnalytics.domain && (
                  <div className="flex justify-between">
                    <span className="text-[var(--brand-muted)]">Domain:</span>
                    <span className="text-[var(--brand-surface-contrast)]">
                      {selectedSchoolForAnalytics.domain}
                    </span>
                  </div>
                )}
                {selectedSchoolForAnalytics.registrationCode && (
                  <div className="flex justify-between">
                    <span className="text-[var(--brand-muted)]">Registration code:</span>
                    <span className="text-[var(--brand-surface-contrast)]">
                      {selectedSchoolForAnalytics.registrationCode}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => setShowAnalyticsModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </RouteMeta>
  );
}

export default SuperuserManageSchoolsPage;
