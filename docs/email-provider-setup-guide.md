# Email Provider Setup Guide - Production Configuration

**Date:** 2025-01-XX  
**Purpose:** Configure email service for production deployment

---

## Overview

The School Management System supports multiple email providers for sending transactional emails. This guide covers setup for production-ready email providers.

---

## Supported Providers

1. **AWS SES** (Recommended for production)
2. **Generic SMTP** (Postmark, SendGrid, Mailgun, etc.)
3. **Console Mode** (Development only)

---

## 1. AWS SES Configuration (Recommended)

### Prerequisites
- AWS account
- AWS SES service access
- Verified email domain or email address in SES

### Step 1: Set Up AWS SES

1. **Log in to AWS Console**
   - Navigate to Amazon SES
   - Verify your sending domain or email address

2. **Create SMTP Credentials**
   - Go to SES → SMTP Settings
   - Click "Create SMTP Credentials"
   - Save the username and password (you won't see the password again)

3. **Move Out of Sandbox** (if needed)
   - By default, SES is in sandbox mode
   - Request production access to send to any email address
   - Go to SES → Account Dashboard → Request Production Access

### Step 2: Configure Environment Variables

Add to your `.env` file or production environment:

```bash
# Email Provider
EMAIL_PROVIDER=ses

# Email From Address (must be verified in SES)
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME="School Management System"

# AWS SES SMTP Configuration
AWS_SES_REGION=us-east-1
AWS_SES_SMTP_USER=<your-ses-smtp-username>
AWS_SES_SMTP_PASSWORD=<your-ses-smtp-password>

# Optional: Custom SMTP host/port (defaults provided)
# AWS_SES_SMTP_HOST=email-smtp.us-east-1.amazonaws.com
# AWS_SES_SMTP_PORT=587

# Frontend URL for email links
FRONTEND_URL=https://yourdomain.com
```

### Step 3: Verify Configuration

Test email sending:
```bash
# In development, check console logs
# In production, check SES sending statistics
```

### SES SMTP Endpoints by Region

| Region | SMTP Endpoint |
|--------|---------------|
| us-east-1 | email-smtp.us-east-1.amazonaws.com |
| us-west-2 | email-smtp.us-west-2.amazonaws.com |
| eu-west-1 | email-smtp.eu-west-1.amazonaws.com |
| ap-southeast-1 | email-smtp.ap-southeast-1.amazonaws.com |

---

## 2. Generic SMTP Configuration

### Option A: Postmark

1. **Sign up for Postmark**
   - Create account at https://postmarkapp.com
   - Verify your sending domain
   - Get Server API Token

2. **Configure Environment Variables**

```bash
EMAIL_PROVIDER=smtp
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME="School Management System"

SMTP_HOST=smtp.postmarkapp.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<your-postmark-server-token>
SMTP_PASSWORD=<your-postmark-server-token>

FRONTEND_URL=https://yourdomain.com
```

### Option B: SendGrid

1. **Sign up for SendGrid**
   - Create account at https://sendgrid.com
   - Verify your sending domain
   - Create API Key with Mail Send permissions

2. **Configure Environment Variables**

```bash
EMAIL_PROVIDER=smtp
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME="School Management System"

SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASSWORD=<your-sendgrid-api-key>

FRONTEND_URL=https://yourdomain.com
```

### Option C: Mailgun

1. **Sign up for Mailgun**
   - Create account at https://mailgun.com
   - Verify your sending domain
   - Get SMTP credentials

2. **Configure Environment Variables**

```bash
EMAIL_PROVIDER=smtp
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME="School Management System"

SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<your-mailgun-smtp-username>
SMTP_PASSWORD=<your-mailgun-smtp-password>

FRONTEND_URL=https://yourdomain.com
```

### Option D: Custom SMTP Server

```bash
EMAIL_PROVIDER=smtp
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME="School Management System"

SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=false  # true for port 465 (SSL)
SMTP_USER=<smtp-username>
SMTP_PASSWORD=<smtp-password>

FRONTEND_URL=https://yourdomain.com
```

---

## 3. Development Mode (Console)

For local development, use console mode:

```bash
EMAIL_PROVIDER=console
EMAIL_FROM=noreply@localhost
EMAIL_FROM_NAME="School Management System (Dev)"
FRONTEND_URL=http://localhost:5173
```

Emails will be logged to the console instead of being sent.

---

## 4. Environment Variable Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `EMAIL_PROVIDER` | Provider type | `ses`, `smtp`, or `console` |
| `EMAIL_FROM` | Sender email address | `noreply@yourdomain.com` |
| `EMAIL_FROM_NAME` | Sender display name | `"School Management System"` |
| `FRONTEND_URL` | Frontend URL for email links | `https://yourdomain.com` |

### AWS SES Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `AWS_SES_REGION` | AWS region | No | `us-east-1` |
| `AWS_SES_SMTP_USER` | SES SMTP username | Yes | - |
| `AWS_SES_SMTP_PASSWORD` | SES SMTP password | Yes | - |
| `AWS_SES_SMTP_HOST` | SMTP hostname | No | Auto-generated |
| `AWS_SES_SMTP_PORT` | SMTP port | No | `587` |

### Generic SMTP Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `SMTP_HOST` | SMTP server hostname | Yes | `localhost` |
| `SMTP_PORT` | SMTP server port | No | `587` |
| `SMTP_SECURE` | Use SSL/TLS | No | `false` |
| `SMTP_USER` | SMTP username | No | - |
| `SMTP_PASSWORD` | SMTP password | No | - |

---

## 5. Production Checklist

### Pre-Deployment

- [ ] Email provider account created and verified
- [ ] Sending domain/email verified
- [ ] SMTP credentials obtained
- [ ] Environment variables configured
- [ ] Test email sent successfully
- [ ] Email templates reviewed
- [ ] Frontend URL configured correctly

### Security

- [ ] SMTP credentials stored securely (environment variables, not code)
- [ ] Email provider account has proper access controls
- [ ] Rate limiting configured (if applicable)
- [ ] SPF/DKIM records configured for domain
- [ ] DMARC policy configured (recommended)

### Monitoring

- [ ] Email delivery monitoring set up
- [ ] Bounce/complaint handling configured
- [ ] Email provider dashboard access configured
- [ ] Alerts configured for email failures

---

## 6. Testing Email Configuration

### Test Script

Create a test script to verify email configuration:

```bash
# backend/test-email.ts
import { initializeEmailService, emailService } from './src/services/emailService';

async function testEmail() {
  initializeEmailService();
  
  try {
    await emailService.sendWelcome({
      email: 'test@example.com',
      fullName: 'Test User',
      role: 'admin'
    });
    console.log('✅ Email sent successfully');
  } catch (error) {
    console.error('❌ Email failed:', error);
  }
}

testEmail();
```

Run: `ts-node backend/test-email.ts`

### Manual Testing

1. **Create a test user** via admin panel
2. **Check credential modal** appears
3. **Click "Email to User"** button
4. **Verify email received** in inbox
5. **Check spam folder** if not in inbox
6. **Test approval/rejection** emails
7. **Test password reset** email

---

## 7. Troubleshooting

### Common Issues

#### Emails Not Sending

1. **Check provider status**
   - Verify account is active
   - Check sending limits/quota
   - Verify domain/email is verified

2. **Check credentials**
   - Verify SMTP username/password are correct
   - Check for typos in environment variables
   - Ensure credentials haven't expired

3. **Check network**
   - Verify SMTP port is not blocked
   - Check firewall rules
   - Test SMTP connection manually

#### Emails Going to Spam

1. **Configure SPF Record**
   ```
   TXT record: v=spf1 include:amazonses.com ~all
   ```

2. **Configure DKIM**
   - Get DKIM keys from email provider
   - Add CNAME records to DNS

3. **Configure DMARC**
   ```
   TXT record: v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com
   ```

#### SES Sandbox Limitations

- Can only send to verified email addresses
- Request production access in SES console
- Provide use case details for approval

---

## 8. Production Recommendations

### Email Provider Selection

| Provider | Best For | Cost | Setup Complexity |
|----------|----------|------|------------------|
| AWS SES | High volume, AWS infrastructure | Pay per email | Medium |
| Postmark | Transactional emails, reliability | Subscription | Low |
| SendGrid | Marketing + transactional | Pay per email | Low |
| Mailgun | Developer-friendly | Pay per email | Low |

### Best Practices

1. **Use dedicated sending domain** (e.g., `noreply@yourdomain.com`)
2. **Monitor bounce rates** and handle bounces
3. **Implement retry logic** for failed sends
4. **Log email events** for audit trail
5. **Set up webhooks** for delivery status (if supported)
6. **Use separate accounts** for dev/staging/production

---

## 9. Docker Configuration

### docker-compose.yml Example

```yaml
services:
  backend:
    environment:
      EMAIL_PROVIDER: ${EMAIL_PROVIDER:-console}
      EMAIL_FROM: ${EMAIL_FROM:-noreply@localhost}
      EMAIL_FROM_NAME: ${EMAIL_FROM_NAME:-"School Management System"}
      AWS_SES_REGION: ${AWS_SES_REGION:-us-east-1}
      AWS_SES_SMTP_USER: ${AWS_SES_SMTP_USER}
      AWS_SES_SMTP_PASSWORD: ${AWS_SES_SMTP_PASSWORD}
      SMTP_HOST: ${SMTP_HOST}
      SMTP_PORT: ${SMTP_PORT:-587}
      SMTP_SECURE: ${SMTP_SECURE:-false}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASSWORD: ${SMTP_PASSWORD}
      FRONTEND_URL: ${FRONTEND_URL:-http://localhost:5173}
```

### .env.example

```bash
# Email Configuration
EMAIL_PROVIDER=console  # ses, smtp, or console
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME="School Management System"
FRONTEND_URL=https://yourdomain.com

# AWS SES (if using SES)
AWS_SES_REGION=us-east-1
AWS_SES_SMTP_USER=
AWS_SES_SMTP_PASSWORD=

# Generic SMTP (if using SMTP)
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
```

---

## 10. Quick Start Commands

### AWS SES Setup
```bash
# 1. Set environment variables
export EMAIL_PROVIDER=ses
export AWS_SES_REGION=us-east-1
export AWS_SES_SMTP_USER=<your-username>
export AWS_SES_SMTP_PASSWORD=<your-password>
export EMAIL_FROM=noreply@yourdomain.com
export FRONTEND_URL=https://yourdomain.com

# 2. Restart backend
npm run dev --prefix backend
```

### Postmark Setup
```bash
# 1. Set environment variables
export EMAIL_PROVIDER=smtp
export SMTP_HOST=smtp.postmarkapp.com
export SMTP_PORT=587
export SMTP_USER=<your-server-token>
export SMTP_PASSWORD=<your-server-token>
export EMAIL_FROM=noreply@yourdomain.com
export FRONTEND_URL=https://yourdomain.com

# 2. Restart backend
npm run dev --prefix backend
```

---

**Status:** ✅ **Configuration Guide Complete**  
**Next:** Configure your email provider and test email delivery

