/**
 * Class Resources Service
 *
 * Unified service for Class Resources domain.
 * Consolidates teacher-scoped and admin-scoped resources.
 * Re-exports from unified service for backward compatibility.
 */

// Re-export from unified service
export {
  listClassResources,
  getClassResource,
  createClassResource,
  updateClassResource,
  deleteClassResource,
  getClassResources,
  uploadClassResource,
  type UnifiedClassResource as ClassResource,
  type CreateClassResourceInput,
  type ClassResourceFilters,
  type UploadClassResourceInput,
} from './unifiedClassResourcesService';
