import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RouteMeta } from '../../../../components/layout/RouteMeta';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Select } from '../../../../components/ui/Select';
import { Textarea } from '../../../../components/ui/Textarea';
import { useCreateInvestigationCase } from '../../../../hooks/queries/useInvestigationCases';
import { ArrowLeft } from 'lucide-react';
import type { InvestigationCase } from '../../../../lib/api';

export function InvestigationCreatePage() {
  const navigate = useNavigate();
  const createCase = useCreateInvestigationCase();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    caseType: 'anomaly' as 'anomaly' | 'security' | 'compliance' | 'abuse' | 'other',
    relatedUserId: '',
    relatedTenantId: '',
    assignedTo: '',
    tags: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const tags = formData.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      const case_ = await createCase.mutateAsync({
        title: formData.title,
        description: formData.description || undefined,
        priority: formData.priority,
        caseType: formData.caseType,
        relatedUserId: formData.relatedUserId || undefined,
        relatedTenantId: formData.relatedTenantId || null,
        assignedTo: formData.assignedTo || undefined,
        tags: tags.length > 0 ? tags : undefined
      }) as InvestigationCase;

      navigate(`/dashboard/superuser/investigations/${case_.id}`);
    } catch {
      // Error handled in hook
    }
  };

  return (
    <RouteMeta title="Create Investigation Case">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/dashboard/superuser/investigations')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-[var(--brand-text-primary)]">Create Investigation Case</h1>
            <p className="mt-1 text-sm text-[var(--brand-text-secondary)]">
              Create a new investigation case to track security incidents or anomalies
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card-base p-6 space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <Input
                label="Title *"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                placeholder="Brief case title"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-sm font-medium mb-1 text-[var(--brand-text-primary)]">
                Description
              </label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed description of the case"
                rows={4}
              />
            </div>

            <div>
              <Select
                label="Case Type *"
                value={formData.caseType}
                onChange={(e) =>
                  setFormData({ ...formData, caseType: e.target.value as typeof formData.caseType })
                }
                required
                options={[
                  { label: 'Anomaly', value: 'anomaly' },
                  { label: 'Security', value: 'security' },
                  { label: 'Compliance', value: 'compliance' },
                  { label: 'Abuse', value: 'abuse' },
                  { label: 'Other', value: 'other' }
                ]}
              />
            </div>

            <div>
              <Select
                label="Priority *"
                value={formData.priority}
                onChange={(e) =>
                  setFormData({ ...formData, priority: e.target.value as typeof formData.priority })
                }
                required
                options={[
                  { label: 'Low', value: 'low' },
                  { label: 'Medium', value: 'medium' },
                  { label: 'High', value: 'high' },
                  { label: 'Critical', value: 'critical' }
                ]}
              />
            </div>

            <div>
              <Input
                label="Related User ID"
                value={formData.relatedUserId}
                onChange={(e) => setFormData({ ...formData, relatedUserId: e.target.value })}
                placeholder="User UUID"
              />
            </div>

            <div>
              <Input
                label="Related Tenant ID"
                value={formData.relatedTenantId}
                onChange={(e) => setFormData({ ...formData, relatedTenantId: e.target.value })}
                placeholder="Tenant UUID"
              />
            </div>

            <div>
              <Input
                label="Assigned To"
                value={formData.assignedTo}
                onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                placeholder="User UUID"
              />
            </div>

            <div>
              <Input
                label="Tags (comma-separated)"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="security, anomaly, urgent"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--brand-border)]">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/dashboard/superuser/investigations')}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createCase.isPending || !formData.title.trim()}>
              {createCase.isPending ? 'Creating...' : 'Create Case'}
            </Button>
          </div>
        </form>
      </div>
    </RouteMeta>
  );
}

export default InvestigationCreatePage;

