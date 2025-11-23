import type { Response } from 'express';

export const FRIENDLY_FORBIDDEN_MESSAGE =
  'Access denied. Please contact your administrator if you believe this is an error. Thank you for your understanding.';

export const FRIENDLY_MISSING_TARGET_ID =
  'Missing target identifier. Please ensure all required parameters are provided.';

export const FRIENDLY_TENANT_CONTEXT_ERROR =
  'We could not load your workspace right now. Please refresh or contact your administrator if the issue continues. Thank you for your patience.';

export const FRIENDLY_TENANT_NOT_FOUND =
  'The requested school or tenant could not be found. Please check the URL or contact support.';

export const FRIENDLY_TENANT_MISMATCH =
  'Access to this resource is restricted to your assigned school. Please ensure you are logged into the correct account.';

export const FRIENDLY_TEACHER_CONTEXT_MISSING =
  'Teacher context unavailable. Please ensure you are logged in as a teacher and your profile is complete.';

export const FRIENDLY_STUDENT_CONTEXT_MISSING =
  'Student context unavailable. Please ensure you are logged in as a student and your profile is complete.';

export const FRIENDLY_USER_CONTEXT_MISSING =
  'User context unavailable. Please ensure you are logged in.';

export function respondTenantContextMissing(res: Response) {
  return res.status(500).json({ message: FRIENDLY_TENANT_CONTEXT_ERROR });
}

export function respondTenantNotFound(res: Response) {
  return res.status(404).json({ message: FRIENDLY_TENANT_NOT_FOUND });
}

export function respondTenantMismatch(res: Response) {
  return res.status(403).json({ message: FRIENDLY_TENANT_MISMATCH });
}

export function respondTeacherContextMissing(res: Response) {
  return res.status(500).json({ message: FRIENDLY_TEACHER_CONTEXT_MISSING });
}

export function respondStudentContextMissing(res: Response) {
  return res.status(500).json({ message: FRIENDLY_STUDENT_CONTEXT_MISSING });
}

export function respondUserContextMissing(res: Response) {
  return res.status(500).json({ message: FRIENDLY_USER_CONTEXT_MISSING });
}
