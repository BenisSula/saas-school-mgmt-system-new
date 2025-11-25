/**
 * Backend Library Utilities - Barrel Export
 *
 * Centralized exports for all backend utility modules
 * Use: import { functionName } from '../lib'
 */

// Request utilities
export { extractIpAddress, getClientIdentifier } from './requestUtils';

// Response helpers
export {
  createSuccessResponse,
  createErrorResponse,
  createPaginatedSuccessResponse,
  type ApiResponse,
  type ApiErrorResponse,
} from './responseHelpers';

// Context validation
export { validateContextOrRespond } from './contextHelpers';

// Route helpers (deprecated functions removed - use contextHelpers.validateContextOrRespond)

// Database helpers
export * from './dbHelpers';
export * from './queryUtils';

// Validation helpers
export * from './validationHelpers';

// Authentication & Authorization
export * from './authErrors';
export * from './roleUtils';

// Other utilities
export * from './logger';
export * from './crudHelpers';
export * from './serviceUtils';
export * from './auditHelpers';
export * from './friendlyMessages';
export * from './envValidation';
export * from './passwordRouteHelpers';
export * from './profileTransformUtils';
export * from './superuserHelpers';
export * from './websocket';

// Serializers
export * from './serializers/deviceInfoSerializer';
export * from './serializers/userSerializer';
