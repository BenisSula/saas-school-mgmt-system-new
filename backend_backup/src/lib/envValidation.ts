/**
 * Validates required environment variables at application startup
 * Throws error if critical variables are missing
 */

export function validateRequiredEnvVars(): void {
  const required = [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET'
  ];

  const missing: string[] = [];

  for (const varName of required) {
    const value = process.env[varName];
    if (!value || value.trim() === '' || value === 'change-me-access' || value === 'change-me-refresh') {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing or invalid required environment variables: ${missing.join(', ')}\n` +
      'Please set these variables in your .env file or environment.\n' +
      'For security, do not use default values in production.'
    );
  }
}

