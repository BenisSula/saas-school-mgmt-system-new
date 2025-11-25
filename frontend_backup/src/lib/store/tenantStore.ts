/**
 * Zustand store for tenant state (UI state only)
 * Actual tenant management is in AuthContext
 */
import { create } from 'zustand';

interface TenantStore {
  selectedTenantId: string | null;
  setSelectedTenantId: (tenantId: string | null) => void;
}

export const useTenantStore = create<TenantStore>((set) => ({
  selectedTenantId: null,
  setSelectedTenantId: (tenantId) => set({ selectedTenantId: tenantId })
}));
