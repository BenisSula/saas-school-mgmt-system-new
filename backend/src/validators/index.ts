/**
 * Backend Validators - Barrel Export
 * 
 * Centralized exports for all validation schemas
 * Use: import { schemaName } from '../validators'
 */

// User registration validators
export {
  adminCreateUserSchema,
  createHODSchema,
  createTeacherSchema,
  createStudentSchema
} from './userRegistrationValidator';

// User validators
export * from './userValidator';

// Student validators
export * from './studentValidator';

// Teacher validators
export * from './teacherValidator';

// School validators
export * from './schoolValidator';

// Exam validators
export * from './examValidator';

// Subject validators
export * from './subjectValidator';

// Term validators
export * from './termValidator';

// Invoice validators
export * from './invoiceValidator';

// Branding validators
export * from './brandingValidator';

// Superuser validators
export * from './superuserValidator';
export * from './superuserAuditValidator';
export * from './superuserInvestigationValidator';
export * from './superuserLoginAttemptsValidator';
export * from './superuserPasswordValidator';
export * from './superuserSessionValidator';

