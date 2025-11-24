import { useState } from 'react';
import { toast } from 'sonner';
import { RouteMeta } from '../../components/layout/RouteMeta';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { api } from '../../lib/api';

interface PlatformSettings {
  globalBranding: {
    platformName: string;
    defaultLogoUrl: string | null;
    defaultPrimaryColor: string;
  };
  authentication: {
    requireEmailVerification: boolean;
    allowSelfRegistration: boolean;
    sessionTimeoutMinutes: number;
  };
  features: {
    enableAuditLogging: boolean;
    enableNotifications: boolean;
    enableHighContrastMode: boolean;
  };
  integrations: {
    paymentProcessor: string;
    emailProvider: string;
    smsProvider: string | null;
  };
}

const defaultSettings: PlatformSettings = {
  globalBranding: {
    platformName: 'Sumano',
    defaultLogoUrl: null,
    defaultPrimaryColor: '#3b82f6',
  },
  authentication: {
    requireEmailVerification: true,
    allowSelfRegistration: true,
    sessionTimeoutMinutes: 60,
  },
  features: {
    enableAuditLogging: true,
    enableNotifications: true,
    enableHighContrastMode: true,
  },
  integrations: {
    paymentProcessor: 'stripe',
    emailProvider: 'sendgrid',
    smsProvider: null,
  },
};

export function SuperuserSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings>(defaultSettings);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus(null);
    try {
      await api.superuser.updateSettings(settings);
      setSaveStatus({ type: 'success', message: 'Platform settings saved successfully' });
      toast.success('Settings saved');
    } catch (err) {
      const message = (err as Error).message;
      setSaveStatus({ type: 'error', message });
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <RouteMeta title="Platform settings">
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
              Platform settings
            </h1>
            <p className="text-sm text-[var(--brand-muted)]">
              Configure global branding, authentication policies, feature flags, and integrations
              shared across every tenant.
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </header>

        {saveStatus && (
          <StatusBanner
            status={saveStatus.type}
            message={saveStatus.message}
            onDismiss={() => setSaveStatus(null)}
          />
        )}

        <section
          className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm"
          aria-label="Global branding"
        >
          <h2 className="mb-4 text-lg font-semibold text-[var(--brand-surface-contrast)]">
            Global branding
          </h2>
          <div className="space-y-4">
            <Input
              label="Platform name"
              value={settings.globalBranding.platformName}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  globalBranding: { ...s.globalBranding, platformName: e.target.value },
                }))
              }
            />
            <Input
              label="Default logo URL"
              placeholder="https://example.com/logo.png"
              value={settings.globalBranding.defaultLogoUrl || ''}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  globalBranding: { ...s.globalBranding, defaultLogoUrl: e.target.value || null },
                }))
              }
            />
            <Input
              label="Default primary color"
              type="color"
              value={settings.globalBranding.defaultPrimaryColor}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  globalBranding: { ...s.globalBranding, defaultPrimaryColor: e.target.value },
                }))
              }
            />
          </div>
        </section>

        <section
          className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm"
          aria-label="Authentication policies"
        >
          <h2 className="mb-4 text-lg font-semibold text-[var(--brand-surface-contrast)]">
            Authentication policies
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--brand-surface-contrast)]">
                  Require email verification
                </p>
                <p className="text-xs text-[var(--brand-muted)]">
                  Users must verify their email before accessing the platform
                </p>
              </div>
              <Select
                value={settings.authentication.requireEmailVerification ? 'true' : 'false'}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    authentication: {
                      ...s.authentication,
                      requireEmailVerification: e.target.value === 'true',
                    },
                  }))
                }
                options={[
                  { label: 'Enabled', value: 'true' },
                  { label: 'Disabled', value: 'false' },
                ]}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--brand-surface-contrast)]">
                  Allow self-registration
                </p>
                <p className="text-xs text-[var(--brand-muted)]">
                  Users can create accounts without admin approval
                </p>
              </div>
              <Select
                value={settings.authentication.allowSelfRegistration ? 'true' : 'false'}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    authentication: {
                      ...s.authentication,
                      allowSelfRegistration: e.target.value === 'true',
                    },
                  }))
                }
                options={[
                  { label: 'Enabled', value: 'true' },
                  { label: 'Disabled', value: 'false' },
                ]}
              />
            </div>
            <Input
              label="Session timeout (minutes)"
              type="number"
              value={settings.authentication.sessionTimeoutMinutes}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  authentication: {
                    ...s.authentication,
                    sessionTimeoutMinutes: Number(e.target.value),
                  },
                }))
              }
            />
          </div>
        </section>

        <section
          className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm"
          aria-label="Feature flags"
        >
          <h2 className="mb-4 text-lg font-semibold text-[var(--brand-surface-contrast)]">
            Feature flags
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--brand-surface-contrast)]">
                  Audit logging
                </p>
                <p className="text-xs text-[var(--brand-muted)]">
                  Track all user actions and system events
                </p>
              </div>
              <Select
                value={settings.features.enableAuditLogging ? 'true' : 'false'}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    features: { ...s.features, enableAuditLogging: e.target.value === 'true' },
                  }))
                }
                options={[
                  { label: 'Enabled', value: 'true' },
                  { label: 'Disabled', value: 'false' },
                ]}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--brand-surface-contrast)]">
                  Notifications
                </p>
                <p className="text-xs text-[var(--brand-muted)]">
                  Enable in-app and email notifications
                </p>
              </div>
              <Select
                value={settings.features.enableNotifications ? 'true' : 'false'}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    features: { ...s.features, enableNotifications: e.target.value === 'true' },
                  }))
                }
                options={[
                  { label: 'Enabled', value: 'true' },
                  { label: 'Disabled', value: 'false' },
                ]}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--brand-surface-contrast)]">
                  High contrast mode
                </p>
                <p className="text-xs text-[var(--brand-muted)]">
                  Enable accessibility high contrast theme option
                </p>
              </div>
              <Select
                value={settings.features.enableHighContrastMode ? 'true' : 'false'}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    features: { ...s.features, enableHighContrastMode: e.target.value === 'true' },
                  }))
                }
                options={[
                  { label: 'Enabled', value: 'true' },
                  { label: 'Disabled', value: 'false' },
                ]}
              />
            </div>
          </div>
        </section>

        <section
          className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm"
          aria-label="Integrations"
        >
          <h2 className="mb-4 text-lg font-semibold text-[var(--brand-surface-contrast)]">
            Integrations
          </h2>
          <div className="space-y-4">
            <Select
              label="Payment processor"
              value={settings.integrations.paymentProcessor}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  integrations: { ...s.integrations, paymentProcessor: e.target.value },
                }))
              }
              options={[
                { label: 'Stripe', value: 'stripe' },
                { label: 'PayPal', value: 'paypal' },
                { label: 'Razorpay', value: 'razorpay' },
              ]}
            />
            <Select
              label="Email provider"
              value={settings.integrations.emailProvider}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  integrations: { ...s.integrations, emailProvider: e.target.value },
                }))
              }
              options={[
                { label: 'SendGrid', value: 'sendgrid' },
                { label: 'AWS SES', value: 'ses' },
                { label: 'Mailgun', value: 'mailgun' },
              ]}
            />
            <Select
              label="SMS provider (optional)"
              value={settings.integrations.smsProvider || ''}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  integrations: { ...s.integrations, smsProvider: e.target.value || null },
                }))
              }
              options={[
                { label: 'None', value: '' },
                { label: 'Twilio', value: 'twilio' },
                { label: 'AWS SNS', value: 'sns' },
              ]}
            />
          </div>
        </section>
      </div>
    </RouteMeta>
  );
}

export default SuperuserSettingsPage;
