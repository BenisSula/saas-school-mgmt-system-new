/**
 * Tenant Branding Preview Component
 * Allows SuperUser to preview tenant branding without switching context
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type BrandingConfig, type PlatformSchool } from '../../lib/api';
import { useTenantStore } from '../../lib/store/tenantStore';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { StatusBanner } from '../ui/StatusBanner';
import { X, Eye } from 'lucide-react';

interface TenantBrandingPreviewProps {
  schools: PlatformSchool[];
  className?: string;
}

export function TenantBrandingPreview({ schools, className = '' }: TenantBrandingPreviewProps) {
  const { selectedTenantId: previewTenantId, setSelectedTenantId: setPreviewTenant } = useTenantStore();
  const clearPreview = () => setPreviewTenant(null);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const isPreviewMode = !!previewTenantId;

  // Fetch branding for selected tenant
  const {
    data: branding,
    isLoading,
    error,
  } = useQuery<BrandingConfig | null>({
    queryKey: ['superuser', 'tenant-branding', selectedTenantId],
    queryFn: () => api.getBranding(),
    enabled: !!selectedTenantId && selectedTenantId !== previewTenantId,
  });

  const handlePreview = () => {
    if (selectedTenantId) {
      setPreviewTenant(selectedTenantId);
    }
  };

  const handleClear = () => {
    clearPreview();
    setSelectedTenantId('');
  };

  const selectedSchool = schools.find((s) => s.id === selectedTenantId);

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Select
            label="Preview Tenant Branding"
            value={selectedTenantId}
            onChange={(e) => setSelectedTenantId(e.target.value)}
            options={[
              { value: '', label: 'Select a tenant...' },
              ...schools.map((school) => ({
                value: school.id,
                label: school.name,
              })),
            ]}
          />
        </div>
        {selectedTenantId && (
          <Button
            onClick={handlePreview}
            disabled={isLoading || !branding || selectedTenantId === previewTenantId}
            leftIcon={<Eye className="h-4 w-4" />}
          >
            {isLoading ? 'Loading...' : 'Preview'}
          </Button>
        )}
        {isPreviewMode && (
          <Button variant="outline" onClick={handleClear} leftIcon={<X className="h-4 w-4" />}>
            Clear Preview
          </Button>
        )}
      </div>

      {error && (
        <StatusBanner
          status="error"
          message={`Failed to load branding: ${(error as Error).message}`}
        />
      )}

      {isPreviewMode && (
        <StatusBanner
          status="info"
          message={
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              <span>
                Previewing branding for: <strong>{selectedSchool?.name || previewTenantId}</strong>
              </span>
            </div>
          }
        />
      )}

      {selectedTenantId && branding && (
        <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4">
          <h3 className="mb-2 text-sm font-semibold text-[var(--brand-text-primary)]">
            Branding Preview
          </h3>
          <div className="space-y-2 text-xs text-[var(--brand-text-secondary)]">
            <div>
              <strong>Primary:</strong> {branding.primary_color || 'Not set'}
            </div>
            <div>
              <strong>Secondary:</strong> {branding.secondary_color || 'Not set'}
            </div>
            {branding.logo_url && (
              <div>
                <strong>Logo:</strong>{' '}
                <a
                  href={branding.logo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--brand-primary)] hover:underline"
                >
                  View Logo
                </a>
              </div>
            )}
            {branding.typography &&
              typeof branding.typography === 'object' &&
              branding.typography !== null &&
              'fontFamily' in branding.typography &&
              branding.typography.fontFamily ? (
                <div>
                  <strong>Font:</strong>{' '}
                  <span>{String(branding.typography.fontFamily)}</span>
                </div>
              ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

export default TenantBrandingPreview;
