/**
 * React Query hooks for billing operations
 * Phase 8.1 - Billing & Stripe Integration
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Subscription, type BillingInvoice, type BillingPayment } from '../../lib/api';
import { toast } from 'sonner';

/**
 * Get current subscription
 */
export function useSubscription() {
  return useQuery({
    queryKey: ['billing', 'subscription'],
    queryFn: () => api.billing.getSubscription(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Create subscription mutation
 */
export function useCreateSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { priceId: string; trialDays?: number }) =>
      api.billing.createSubscription(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'subscription'] });
      toast.success('Subscription created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create subscription');
    }
  });
}

/**
 * Cancel subscription mutation
 */
export function useCancelSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { cancelImmediately?: boolean }) =>
      api.billing.cancelSubscription(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'subscription'] });
      toast.success('Subscription canceled successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to cancel subscription');
    }
  });
}

/**
 * Update subscription plan mutation
 */
export function useUpdatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { newPriceId: string; prorate?: boolean }) =>
      api.billing.updatePlan(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing', 'subscription'] });
      toast.success('Subscription plan updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update subscription plan');
    }
  });
}

/**
 * Get invoices
 */
export function useInvoices(params?: { status?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['billing', 'invoices', params],
    queryFn: () => api.billing.getInvoices(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Get invoice by ID
 */
export function useInvoice(invoiceId: string) {
  return useQuery({
    queryKey: ['billing', 'invoices', invoiceId],
    queryFn: () => api.billing.getInvoice(invoiceId),
    enabled: !!invoiceId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Get payment history
 */
export function usePayments(params?: {
  invoiceId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['billing', 'payments', params],
    queryFn: () => api.billing.getPayments(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

