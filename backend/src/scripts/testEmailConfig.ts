#!/usr/bin/env ts-node
/**
 * Email Configuration Test Script
 * 
 * Tests email service configuration and sends a test email
 * 
 * Usage:
 *   npm run test:email
 *   or
 *   ts-node src/scripts/testEmailConfig.ts
 */

import { initializeEmailService, emailService } from '../services/emailService';

interface TestResult {
  success: boolean;
  message: string;
  details?: string;
}

async function testEmailConfiguration(): Promise<TestResult> {
  console.log('\n📧 Testing Email Configuration...\n');

  // Check environment variables
  const provider = process.env.EMAIL_PROVIDER || 'console';
  const fromEmail = process.env.EMAIL_FROM || 'noreply@localhost';
  const fromName = process.env.EMAIL_FROM_NAME || 'School Management System';

  console.log('Configuration:');
  console.log(`  Provider: ${provider}`);
  console.log(`  From: ${fromName} <${fromEmail}>`);
  console.log('');

  // Initialize email service
  try {
    initializeEmailService();
    console.log('✅ Email service initialized\n');
  } catch (error) {
    return {
      success: false,
      message: 'Failed to initialize email service',
      details: error instanceof Error ? error.message : String(error)
    };
  }

  // Test email sending
  const testEmail = process.env.TEST_EMAIL || 'test@example.com';
  console.log(`Sending test email to: ${testEmail}\n`);

  try {
    // Test welcome email
    await emailService.sendWelcome({
      email: testEmail,
      fullName: 'Test User',
      role: 'admin',
      loginUrl: process.env.FRONTEND_URL || 'http://localhost:5173/auth/login'
    });

    if (provider === 'console') {
      console.log('✅ Test email logged to console (console mode)');
      console.log('   Check the logs above to see the email content\n');
      return {
        success: true,
        message: 'Email service is working (console mode)',
        details: 'Emails are logged to console in development mode'
      };
    } else {
      console.log('✅ Test email sent successfully!\n');
      console.log(`   Please check ${testEmail} inbox (and spam folder)\n`);
      return {
        success: true,
        message: 'Email sent successfully',
        details: `Check ${testEmail} inbox`
      };
    }
  } catch (error) {
    console.error('❌ Failed to send test email\n');
    return {
      success: false,
      message: 'Failed to send test email',
      details: error instanceof Error ? error.message : String(error)
    };
  }
}

async function testAllEmailTypes(): Promise<void> {
  console.log('\n📧 Testing All Email Types...\n');

  const testEmail = process.env.TEST_EMAIL || 'test@example.com';
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  initializeEmailService();

  const tests = [
    {
      name: 'Welcome Email',
      fn: () =>
        emailService.sendWelcome({
          email: testEmail,
          fullName: 'Test User',
          role: 'admin',
          loginUrl: `${baseUrl}/auth/login`
        })
    },
    {
      name: 'Credentials Email',
      fn: () =>
        emailService.sendCredentials({
          email: testEmail,
          password: 'TempPass123!',
          fullName: 'Test User',
          role: 'teacher',
          loginUrl: `${baseUrl}/auth/login`
        })
    },
    {
      name: 'Approval Email',
      fn: () =>
        emailService.sendApproval({
          email: testEmail,
          fullName: 'Test User',
          role: 'student',
          loginUrl: `${baseUrl}/auth/login`
        })
    },
    {
      name: 'Rejection Email',
      fn: () =>
        emailService.sendRejection({
          email: testEmail,
          fullName: 'Test User',
          reason: 'Test rejection reason'
        })
    },
    {
      name: 'Password Reset Email',
      fn: () =>
        emailService.sendPasswordReset({
          email: testEmail,
          resetToken: 'test-token-123',
          resetUrl: `${baseUrl}/auth/reset-password?token=test-token-123`,
          expiresIn: '30 minutes'
        })
    }
  ];

  for (const test of tests) {
    try {
      console.log(`Testing ${test.name}...`);
      await test.fn();
      console.log(`  ✅ ${test.name} - OK\n`);
    } catch (error) {
      console.error(`  ❌ ${test.name} - Failed:`, error instanceof Error ? error.message : error);
      console.log('');
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const testAll = args.includes('--all');

  if (testAll) {
    await testAllEmailTypes();
  } else {
    const result = await testEmailConfiguration();
    console.log('\n' + '='.repeat(50));
    if (result.success) {
      console.log('✅ Email Configuration Test: PASSED');
    } else {
      console.log('❌ Email Configuration Test: FAILED');
      console.log(`   Error: ${result.message}`);
      if (result.details) {
        console.log(`   Details: ${result.details}`);
      }
    }
    console.log('='.repeat(50) + '\n');
    process.exit(result.success ? 0 : 1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { testEmailConfiguration, testAllEmailTypes };

