import nodemailer, { Transporter } from 'nodemailer';
import { getPool } from '../db/connection';

/**
 * Email service configuration
 * Supports multiple providers: SES, SMTP, or console (development)
 */
interface EmailConfig {
  provider: 'ses' | 'smtp' | 'console';
  from: string;
  fromName?: string;
  // SES configuration
  sesRegion?: string;
  sesAccessKeyId?: string;
  sesSecretAccessKey?: string;
  // SMTP configuration
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPassword?: string;
}

/**
 * Email template data
 */
export interface EmailTemplateData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Credential email data
 */
export interface CredentialEmailData {
  email: string;
  password: string;
  fullName: string;
  role: string;
  loginUrl?: string;
}

/**
 * Approval email data
 */
export interface ApprovalEmailData {
  email: string;
  fullName: string;
  role: string;
  loginUrl?: string;
}

/**
 * Rejection email data
 */
export interface RejectionEmailData {
  email: string;
  fullName: string;
  reason?: string;
}

/**
 * Password reset email data
 */
export interface PasswordResetEmailData {
  email: string;
  resetToken: string;
  resetUrl: string;
  expiresIn?: string;
}

/**
 * Welcome email data
 */
export interface WelcomeEmailData {
  email: string;
  fullName: string;
  role: string;
  loginUrl?: string;
}

let transporter: Transporter | null = null;
let emailConfig: EmailConfig | null = null;

/**
 * Initialize email service
 */
export function initializeEmailService(): void {
  const provider = (process.env.EMAIL_PROVIDER || 'console').toLowerCase() as 'ses' | 'smtp' | 'console';
  const fromEmail = process.env.EMAIL_FROM || 'noreply@schoolmgmt.local';
  const fromName = process.env.EMAIL_FROM_NAME || 'School Management System';

  emailConfig = {
    provider,
    from: fromEmail,
    fromName
  };

  if (provider === 'console') {
    // Console provider for development - just logs emails
    console.log('[email] Email service initialized in console mode (emails will be logged)');
    return;
  }

  if (provider === 'ses') {
    // AWS SES configuration via SMTP
    // Note: SES SMTP is the recommended approach for nodemailer
    const sesRegion = process.env.AWS_SES_REGION || 'us-east-1';
    const sesHost = process.env.AWS_SES_SMTP_HOST || `email-smtp.${sesRegion}.amazonaws.com`;
    const sesPort = parseInt(process.env.AWS_SES_SMTP_PORT || '587', 10);
    const sesUser = process.env.AWS_SES_SMTP_USER || process.env.AWS_SES_ACCESS_KEY_ID;
    const sesPassword = process.env.AWS_SES_SMTP_PASSWORD || process.env.AWS_SES_SECRET_ACCESS_KEY;

    if (!sesUser || !sesPassword) {
      console.warn('[email] AWS SES credentials not configured, falling back to console mode');
      emailConfig.provider = 'console';
    } else {
      transporter = nodemailer.createTransport({
        host: sesHost,
        port: sesPort,
        secure: sesPort === 465,
        auth: {
          user: sesUser,
          pass: sesPassword
        }
      });
    }
  } else if (provider === 'smtp') {
    // SMTP configuration
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASSWORD
          }
        : undefined
    });
  }

  console.log(`[email] Email service initialized with provider: ${provider}`);
}

/**
 * Send email
 */
async function sendEmail(data: EmailTemplateData): Promise<void> {
  if (!emailConfig) {
    throw new Error('Email service not initialized. Call initializeEmailService() first.');
  }

  const from = emailConfig.fromName
    ? `${emailConfig.fromName} <${emailConfig.from}>`
    : emailConfig.from;

  if (emailConfig.provider === 'console') {
    // Development mode - log email
    console.log('\n========== EMAIL (Console Mode) ==========');
    console.log(`To: ${data.to}`);
    console.log(`From: ${from}`);
    console.log(`Subject: ${data.subject}`);
    console.log('---');
    console.log(data.text || data.html);
    console.log('==========================================\n');
    return;
  }

  if (!transporter) {
    throw new Error('Email transporter not configured');
  }

  try {
    await transporter.sendMail({
      from,
      to: data.to,
      subject: data.subject,
      html: data.html,
      text: data.text
    });
    console.log(`[email] Email sent to ${data.to}`);
  } catch (error) {
    console.error(`[email] Failed to send email to ${data.to}:`, error);
    throw error;
  }
}

/**
 * Generate email templates
 */
export class EmailTemplates {
  private static getBaseUrl(): string {
    return process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173';
  }

  /**
   * Welcome email template
   */
  static welcome(data: WelcomeEmailData): EmailTemplateData {
    const loginUrl = data.loginUrl || `${this.getBaseUrl()}/auth/login`;
    
    return {
      to: data.email,
      subject: 'Welcome to School Management System',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">Welcome, ${data.fullName}!</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
            <p>Hello ${data.fullName},</p>
            <p>Your account has been successfully created with the role of <strong>${data.role}</strong>.</p>
            <p>You can now log in to access your dashboard and start using the system.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Log In</a>
            </div>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              If you have any questions, please contact your administrator.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
Welcome, ${data.fullName}!

Your account has been successfully created with the role of ${data.role}.

You can now log in to access your dashboard at: ${loginUrl}

If you have any questions, please contact your administrator.
      `
    };
  }

  /**
   * Credentials email template
   */
  static credentials(data: CredentialEmailData): EmailTemplateData {
    const loginUrl = data.loginUrl || `${this.getBaseUrl()}/auth/login`;
    
    return {
      to: data.email,
      subject: 'Your Account Credentials - School Management System',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Account Credentials</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">Your Account Credentials</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
            <p>Hello ${data.fullName},</p>
            <p>Your account has been created with the role of <strong>${data.role}</strong>. Here are your login credentials:</p>
            <div style="background: white; border: 2px solid #667eea; border-radius: 5px; padding: 20px; margin: 20px 0;">
              <p style="margin: 10px 0;"><strong>Email:</strong> ${data.email}</p>
              <p style="margin: 10px 0;"><strong>Temporary Password:</strong> <code style="background: #f0f0f0; padding: 4px 8px; border-radius: 3px; font-family: monospace;">${data.password}</code></p>
            </div>
            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; font-weight: bold;">⚠️ Important:</p>
              <p style="margin: 5px 0 0 0;">Please change your password after your first login for security purposes.</p>
            </div>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Log In Now</a>
            </div>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              If you did not request this account, please contact your administrator immediately.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
Your Account Credentials

Hello ${data.fullName},

Your account has been created with the role of ${data.role}. Here are your login credentials:

Email: ${data.email}
Temporary Password: ${data.password}

⚠️ Important: Please change your password after your first login for security purposes.

Log in at: ${loginUrl}

If you did not request this account, please contact your administrator immediately.
      `
    };
  }

  /**
   * Approval email template
   */
  static approval(data: ApprovalEmailData): EmailTemplateData {
    const loginUrl = data.loginUrl || `${this.getBaseUrl()}/auth/login`;
    
    return {
      to: data.email,
      subject: 'Account Approved - School Management System',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Account Approved</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">✓ Account Approved</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
            <p>Hello ${data.fullName},</p>
            <p>Great news! Your account registration has been <strong>approved</strong>.</p>
            <p>Your account with the role of <strong>${data.role}</strong> is now active and ready to use.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" style="background: #28a745; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Log In</a>
            </div>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              If you have any questions, please contact your administrator.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
Account Approved

Hello ${data.fullName},

Great news! Your account registration has been approved.

Your account with the role of ${data.role} is now active and ready to use.

Log in at: ${loginUrl}

If you have any questions, please contact your administrator.
      `
    };
  }

  /**
   * Rejection email template
   */
  static rejection(data: RejectionEmailData): EmailTemplateData {
    return {
      to: data.email,
      subject: 'Account Registration Status - School Management System',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Registration Status</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">Registration Status</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
            <p>Hello ${data.fullName},</p>
            <p>We regret to inform you that your account registration has been <strong>rejected</strong>.</p>
            ${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ''}
            <p>If you believe this is an error or have questions, please contact your administrator.</p>
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Thank you for your interest in our platform.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
Registration Status

Hello ${data.fullName},

We regret to inform you that your account registration has been rejected.

${data.reason ? `Reason: ${data.reason}\n` : ''}
If you believe this is an error or have questions, please contact your administrator.

Thank you for your interest in our platform.
      `
    };
  }

  /**
   * Password reset email template
   */
  static passwordReset(data: PasswordResetEmailData): EmailTemplateData {
    const expiresIn = data.expiresIn || '30 minutes';
    
    return {
      to: data.email,
      subject: 'Password Reset Request - School Management System',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">Password Reset</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px;">
            <p>Hello,</p>
            <p>You have requested to reset your password. Click the button below to reset it:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${data.resetUrl}" style="background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
            </div>
            <p style="color: #666; font-size: 14px;">
              This link will expire in ${expiresIn}. If you did not request this, please ignore this email.
            </p>
            <p style="color: #666; font-size: 12px; margin-top: 20px;">
              Or copy and paste this link into your browser:<br>
              <code style="background: #f0f0f0; padding: 4px 8px; border-radius: 3px; word-break: break-all;">${data.resetUrl}</code>
            </p>
          </div>
        </body>
        </html>
      `,
      text: `
Password Reset

Hello,

You have requested to reset your password. Use the link below to reset it:

${data.resetUrl}

This link will expire in ${expiresIn}. If you did not request this, please ignore this email.
      `
    };
  }

  /**
   * Admin-created user onboarding email
   */
  static onboarding(data: CredentialEmailData): EmailTemplateData {
    return this.credentials(data);
  }
}

/**
 * Email service functions
 */
export const emailService = {
  /**
   * Send welcome email
   */
  async sendWelcome(data: WelcomeEmailData): Promise<void> {
    const template = EmailTemplates.welcome(data);
    await sendEmail(template);
  },

  /**
   * Send credentials email
   */
  async sendCredentials(data: CredentialEmailData): Promise<void> {
    const template = EmailTemplates.credentials(data);
    await sendEmail(template);
  },

  /**
   * Send approval email
   */
  async sendApproval(data: ApprovalEmailData): Promise<void> {
    const template = EmailTemplates.approval(data);
    await sendEmail(template);
  },

  /**
   * Send rejection email
   */
  async sendRejection(data: RejectionEmailData): Promise<void> {
    const template = EmailTemplates.rejection(data);
    await sendEmail(template);
  },

  /**
   * Send password reset email
   */
  async sendPasswordReset(data: PasswordResetEmailData): Promise<void> {
    const template = EmailTemplates.passwordReset(data);
    await sendEmail(template);
  },

  /**
   * Send onboarding email (admin-created users)
   */
  async sendOnboarding(data: CredentialEmailData): Promise<void> {
    const template = EmailTemplates.onboarding(data);
    await sendEmail(template);
  }
};

