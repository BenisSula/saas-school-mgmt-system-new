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
    try {
      if (formMode === 'create') {
        await api.superuser.createSchool({
          name: formState.name,
          address: formState.address,
          contactPhone: formState.contactPhone,
          contactEmail: formState.contactEmail,
          registrationCode: formState.registrationCode,
          domain: formState.domain || undefined,
          subscriptionType: formState.subscriptionType,
          billingEmail: formState.billingEmail || undefined
        });
        toast.success(`School “${formState.name}” created`);
      } else if (formState.id) {
        await api.superuser.updateSchool(formState.id, {
          name: formState.name,
          address: formState.address || undefined,
          contactPhone: formState.contactPhone || undefined,
          contactEmail: formState.contactEmail || undefined,
          registrationCode: formState.registrationCode || undefined,
          domain: formState.domain || null,
          subscriptionType: formState.subscriptionType,
          billingEmail: formState.billingEmail || null,
          status: formState.status
        });
        toast.success(`School “${formState.name}” updated`);
      }
      setShowSchoolModal(false);
      await loadSchools();
    } catch (err) {
      const message = (err as Error).message;
      toast.error(message);
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
      render: (row) => new Date(row.createdAt).toLocaleDateString()
    },
    {
      header: 'Actions',
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => openEditModal(row)}>
            Edit
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
        title={formMode === 'create' ? 'Create school' : 'Edit school'}
        isOpen={showSchoolModal}
        onClose={() => setShowSchoolModal(false)}
      >
        <div className="space-y-4">
          <Input
            label="Name"
            required
            value={formState.name}
            onChange={(event) => setFormState((state) => ({ ...state, name: event.target.value }))}
          />
          <Input
            label="Address"
            required
            value={formState.address}
            onChange={(event) =>
              setFormState((state) => ({ ...state, address: event.target.value }))
            }
          />
          <Input
            label="Contact phone"
            required
            value={formState.contactPhone}
            onChange={(event) =>
              setFormState((state) => ({ ...state, contactPhone: event.target.value }))
            }
          />
          <Input
            label="Contact email"
            type="email"
            required
            value={formState.contactEmail}
            onChange={(event) =>
              setFormState((state) => ({ ...state, contactEmail: event.target.value }))
            }
          />
          <Input
            label="Registration code"
            required
            value={formState.registrationCode}
            onChange={(event) =>
              setFormState((state) => ({ ...state, registrationCode: event.target.value }))
            }
          />
          <Input
            label="Domain"
            placeholder="school.example.com"
            value={formState.domain}
            onChange={(event) =>
              setFormState((state) => ({ ...state, domain: event.target.value }))
            }
          />
          <Input
            label="Billing email"
            placeholder="billing@example.com"
            value={formState.billingEmail}
            onChange={(event) =>
              setFormState((state) => ({ ...state, billingEmail: event.target.value }))
            }
          />
          <Select
            label="Subscription"
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
          ) : null}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setShowSchoolModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveSchool}>{formMode === 'create' ? 'Create' : 'Save'}</Button>
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
    </RouteMeta>
  );
}

export default SuperuserManageSchoolsPage;
