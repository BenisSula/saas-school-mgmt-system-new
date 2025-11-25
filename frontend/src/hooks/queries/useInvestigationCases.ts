import { useQuery } from '../useQuery';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { toast } from 'sonner';

// Type for case filters
type CaseFilters = Parameters<typeof api.superuser.getCases>[0];

// Query keys for investigation cases
export const investigationKeys = {
  all: ['investigations'] as const,
  lists: () => [...investigationKeys.all, 'list'] as const,
  list: (filters?: CaseFilters) => [...investigationKeys.lists(), filters] as const,
  details: () => [...investigationKeys.all, 'detail'] as const,
  detail: (id: string) => [...investigationKeys.details(), id] as const,
  anomalies: (filters?: {
    userId?: string;
    tenantId?: string | null;
    startDate?: string;
    endDate?: string;
  }) => [...investigationKeys.all, 'anomalies', filters] as const,
  userActions: (
    userId: string,
    filters?: {
      tenantId?: string | null;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }
  ) => [...investigationKeys.all, 'user-actions', userId, filters] as const,
};

/**
 * Hook to fetch investigation cases with filters
 */
export function useInvestigationCases(filters?: CaseFilters) {
  return useQuery(investigationKeys.list(filters), () => api.superuser.getCases(filters), {
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Hook to fetch a single investigation case with notes and evidence
 */
export function useInvestigationCase(caseId: string) {
  return useQuery(investigationKeys.detail(caseId), () => api.superuser.getCase(caseId), {
    enabled: !!caseId,
    staleTime: 30000,
  });
}

/**
 * Hook to create a new investigation case
 */
export function useCreateInvestigationCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      title: string;
      description?: string;
      priority?: 'low' | 'medium' | 'high' | 'critical';
      caseType: 'anomaly' | 'security' | 'compliance' | 'abuse' | 'other';
      relatedUserId?: string;
      relatedTenantId?: string | null;
      assignedTo?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
    }) => api.superuser.createCase(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: investigationKeys.lists() });
      toast.success('Investigation case created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create investigation case');
    },
  });
}

/**
 * Hook to update case status
 */
export function useUpdateCaseStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      caseId,
      ...payload
    }: {
      caseId: string;
      status: 'open' | 'investigating' | 'resolved' | 'closed';
      resolution?: string;
      resolutionNotes?: string;
    }) => api.superuser.updateCaseStatus(caseId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: investigationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: investigationKeys.detail(variables.caseId) });
      toast.success('Case status updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update case status');
    },
  });
}

/**
 * Hook to add a note to a case
 */
export function useAddCaseNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      caseId,
      ...payload
    }: {
      caseId: string;
      note: string;
      noteType?: 'note' | 'finding' | 'evidence' | 'action';
      metadata?: Record<string, unknown>;
    }) => api.superuser.addCaseNote(caseId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: investigationKeys.detail(variables.caseId) });
      toast.success('Note added successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add note');
    },
  });
}

/**
 * Hook to add evidence to a case
 */
export function useAddCaseEvidence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      caseId,
      ...payload
    }: {
      caseId: string;
      evidenceType:
        | 'audit_log'
        | 'session'
        | 'login_attempt'
        | 'password_change'
        | 'file'
        | 'other';
      evidenceId: string;
      evidenceSource: string;
      description?: string;
      metadata?: Record<string, unknown>;
    }) => api.superuser.addCaseEvidence(caseId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: investigationKeys.detail(variables.caseId) });
      toast.success('Evidence added successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add evidence');
    },
  });
}

/**
 * Hook to detect anomalies
 */
export function useDetectAnomalies(filters?: {
  userId?: string;
  tenantId?: string | null;
  startDate?: string;
  endDate?: string;
}) {
  return useQuery(
    investigationKeys.anomalies(filters),
    () => api.superuser.detectAnomalies(filters),
    {
      enabled: false, // Manual trigger only
      staleTime: 60000,
    }
  );
}

/**
 * Hook to get user actions
 */
export function useUserActions(
  userId: string,
  filters?: {
    tenantId?: string | null;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }
) {
  return useQuery(
    investigationKeys.userActions(userId, filters),
    () => api.superuser.getUserActions(userId, filters),
    {
      enabled: !!userId,
      staleTime: 30000,
    }
  );
}

/**
 * Hook to export case audit trail
 */
export function useExportCaseAuditTrail() {
  return useMutation({
    mutationFn: ({ caseId, format }: { caseId: string; format?: 'csv' | 'pdf' | 'json' }) =>
      api.superuser.exportCaseAuditTrail(caseId, format),
    onSuccess: (blob, variables) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `case-${variables.caseId}-audit-trail.${variables.format || 'json'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Audit trail exported successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to export audit trail');
    },
  });
}
