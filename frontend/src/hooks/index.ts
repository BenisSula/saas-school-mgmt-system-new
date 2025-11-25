/**
 * Centralized hook exports
 */

// API hooks
export { useApi, useApiMutation } from './useApi';
export type { UseApiOptions } from './useApi';

// Pagination hook
export { usePagination } from './usePagination';
export type { PaginationOptions, PaginationState, PaginationControls } from './usePagination';

// Entity fetching hooks
export { useFetchEntity, useFetchEntities } from './useFetchEntity';
export type { UseFetchEntityOptions } from './useFetchEntity';

// Existing hooks
export { useQuery, useMutation, useQueryClient, queryKeys } from './useQuery';
export { useFilters } from './useFilters';
export type { BaseFilters } from './useFilters';
export { useExport, createExportHandlers } from './useExport';
export { useProfileData } from './useProfileData';
export { useProfileSync } from './useProfileSync';
export { usePermission } from './usePermission';
export { useSidebar } from './useSidebar';
export { useWebSocket } from './useWebSocket';
export { useAsyncFeedback } from './useAsyncFeedback';
export { useBulkOperations } from './useBulkOperations';
export { useDataLoader } from './useDataLoader';
export { useManagementPage } from './useManagementPage';
