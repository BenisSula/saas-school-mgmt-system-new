import { z } from 'zod';

/**
 * Formats Zod validation errors into user-friendly messages
 */
export function formatValidationErrors(error: z.ZodError): string {
  if (error.issues.length === 0) {
    return 'Validation failed';
  }

  if (error.issues.length === 1) {
    const err = error.issues[0];
    const field = err.path.join('.');
    const message = err.message;

    // If message already contains the field name, return as is
    if (message.toLowerCase().includes(field.toLowerCase())) {
      return message;
    }

    // Otherwise, format with field name
    const fieldLabel = formatFieldName(field);
    return `${fieldLabel}: ${message}`;
  }

  // Multiple errors - format as a list
  const messages = error.issues.map((err: z.ZodIssue) => {
    const field = err.path.join('.');
    const fieldLabel = formatFieldName(field);
    return `${fieldLabel}: ${err.message}`;
  });

  return messages.join('; ');
}

/**
 * Formats field names to be more user-friendly
 */
function formatFieldName(field: string): string {
  const fieldMap: Record<string, string> = {
    name: 'School name',
    address: 'Address',
    contactPhone: 'Contact phone',
    contactEmail: 'Contact email',
    registrationCode: 'Registration code',
    domain: 'Domain',
    subscriptionType: 'Subscription tier',
    billingEmail: 'Billing email',
    status: 'Status',
    email: 'Email',
    password: 'Password',
    username: 'Username',
    fullName: 'Full name',
    phone: 'Phone',
  };

  return (
    fieldMap[field] ||
    field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim()
  );
}

/**
 * Handles Zod validation with user-friendly error messages
 */
export function validateWithZod<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    error: formatValidationErrors(result.error),
  };
}
