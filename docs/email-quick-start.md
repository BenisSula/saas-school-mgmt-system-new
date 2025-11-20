# Email Configuration Quick Start

**Quick reference for setting up email in production**

---

## 🚀 Quick Setup (Choose One)

### Option 1: AWS SES (Recommended)

```bash
# 1. Get SMTP credentials from AWS SES Console
# 2. Add to .env:
EMAIL_PROVIDER=ses
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME="School Management System"
AWS_SES_REGION=us-east-1
AWS_SES_SMTP_USER=<your-ses-smtp-username>
AWS_SES_SMTP_PASSWORD=<your-ses-smtp-password>
FRONTEND_URL=https://yourdomain.com
```

### Option 2: Postmark

```bash
EMAIL_PROVIDER=smtp
EMAIL_FROM=noreply@yourdomain.com
SMTP_HOST=smtp.postmarkapp.com
SMTP_PORT=587
SMTP_USER=<your-postmark-server-token>
SMTP_PASSWORD=<your-postmark-server-token>
FRONTEND_URL=https://yourdomain.com
```

### Option 3: SendGrid

```bash
EMAIL_PROVIDER=smtp
EMAIL_FROM=noreply@yourdomain.com
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=<your-sendgrid-api-key>
FRONTEND_URL=https://yourdomain.com
```

---

## ✅ Test Configuration

```bash
# Test email configuration
npm run test:email --prefix backend

# Test all email types
npm run test:email:all --prefix backend

# Test with specific email
TEST_EMAIL=your@email.com npm run test:email --prefix backend
```

---

## 📋 Checklist

- [ ] Email provider account created
- [ ] Sending domain/email verified
- [ ] SMTP credentials obtained
- [ ] Environment variables configured
- [ ] Test email sent successfully
- [ ] SPF/DKIM records configured (for production)
- [ ] Email monitoring set up

---

## 🔍 Troubleshooting

**Emails not sending?**
1. Check provider status and limits
2. Verify credentials are correct
3. Check spam folder
4. Review server logs

**Emails going to spam?**
1. Configure SPF record
2. Configure DKIM
3. Configure DMARC (recommended)

See `docs/email-provider-setup-guide.md` for detailed instructions.

