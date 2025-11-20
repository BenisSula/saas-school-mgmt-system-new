/**
 * Email Configuration Validator
 * Validates email service configuration at startup
 */

export interface EmailConfigValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  provider: string;
}

/**
 * Validate email configuration
 */
export function validateEmailConfig(): EmailConfigValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const provider = (process.env.EMAIL_PROVIDER || 'console').toLowerCase();

  // Check required variables
  if (!process.env.EMAIL_FROM) {
    errors.push('EMAIL_FROM is required');
  } else {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(process.env.EMAIL_FROM)) {
      errors.push('EMAIL_FROM must be a valid email address');
    }
  }

  if (!process.env.FRONTEND_URL) {
    warnings.push('FRONTEND_URL is not set - email links may not work correctly');
  }

  // Provider-specific validation
  if (provider === 'ses') {
    if (!process.env.AWS_SES_SMTP_USER && !process.env.AWS_SES_ACCESS_KEY_ID) {
      errors.push('AWS_SES_SMTP_USER or AWS_SES_ACCESS_KEY_ID is required for SES provider');
    }
    if (!process.env.AWS_SES_SMTP_PASSWORD && !process.env.AWS_SES_SECRET_ACCESS_KEY) {
      errors.push('AWS_SES_SMTP_PASSWORD or AWS_SES_SECRET_ACCESS_KEY is required for SES provider');
    }
  } else if (provider === 'smtp') {
    if (!process.env.SMTP_HOST) {
      errors.push('SMTP_HOST is required for SMTP provider');
    }
    // SMTP_USER and SMTP_PASSWORD are optional (some servers don't require auth)
  } else if (provider !== 'console') {
    errors.push(`Unknown EMAIL_PROVIDER: ${provider}. Must be 'ses', 'smtp', or 'console'`);
  }

  // Development warnings
  if (provider === 'console' && process.env.NODE_ENV === 'production') {
    warnings.push('EMAIL_PROVIDER is set to "console" in production - emails will not be sent');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    provider
  };
}

/**
 * Print configuration validation results
 */
export function printEmailConfigValidation(): void {
  const validation = validateEmailConfig();

  console.log('\n📧 Email Configuration Validation:');
  console.log(`   Provider: ${validation.provider}`);

  if (validation.errors.length > 0) {
    console.log('   ❌ Errors:');
    validation.errors.forEach((error) => {
      console.log(`      - ${error}`);
    });
  }

  if (validation.warnings.length > 0) {
    console.log('   ⚠️  Warnings:');
    validation.warnings.forEach((warning) => {
      console.log(`      - ${warning}`);
    });
  }

  if (validation.isValid && validation.warnings.length === 0) {
    console.log('   ✅ Configuration is valid');
  }

  console.log('');
}

