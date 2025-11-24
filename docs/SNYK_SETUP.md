# Snyk Security Scanning Setup

This guide explains how to set up Snyk for automated security scanning in CI/CD.

## Overview

Snyk provides:
- Dependency vulnerability scanning
- License compliance checking
- Container image scanning
- Infrastructure as Code (IaC) scanning

## Setup Instructions

### 1. Create Snyk Account

1. Go to https://snyk.io
2. Sign up for a free account (GitHub/Google login available)
3. Complete onboarding

### 2. Get Snyk Token

1. Login to Snyk dashboard
2. Go to Settings → General → Account Settings
3. Copy your **API Token**

### 3. Add Token to GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `SNYK_TOKEN`
5. Value: Paste your Snyk API token
6. Click **Add secret**

### 4. Verify Setup

Once the token is added, Snyk scanning will automatically run in CI/CD pipeline:

- **Workflow:** `.github/workflows/ci-cd-production.yml`
- **Job:** `security`
- **Step:** `Snyk Security Scan`

### 5. View Results

- Snyk results appear in GitHub Actions logs
- Detailed reports available in Snyk dashboard
- Vulnerabilities appear in GitHub Security tab (if SARIF upload configured)

## Snyk CLI Usage (Local)

You can also run Snyk locally:

```bash
# Install Snyk CLI
npm install -g snyk

# Authenticate
snyk auth <your-token>

# Test backend
cd backend
snyk test

# Test frontend
cd frontend
snyk test

# Monitor (tracks dependencies over time)
snyk monitor
```

## Configuration

The CI/CD pipeline is configured to:
- Scan for high-severity vulnerabilities
- Continue on error (for manual review)
- Run on all pull requests and pushes to main/production

## Benefits

- **Early Detection:** Find vulnerabilities before deployment
- **License Compliance:** Check for problematic licenses
- **Container Security:** Scan Docker images
- **Continuous Monitoring:** Track dependencies over time

## Troubleshooting

### Snyk Not Running

- Check if `SNYK_TOKEN` secret is set in GitHub
- Verify token is valid (not expired)
- Check GitHub Actions logs for errors

### High Number of Vulnerabilities

- Review Snyk dashboard for details
- Use `snyk test` locally to see full report
- Consider `snyk fix` to auto-fix compatible issues
- Update dependencies manually for critical issues

## Additional Resources

- [Snyk Documentation](https://docs.snyk.io/)
- [Snyk CLI Reference](https://docs.snyk.io/snyk-cli)
- [GitHub Integration](https://docs.snyk.io/integrations/ci-cd-integrations/github)

---

**Note:** Snyk is optional but recommended for production deployments. The CI/CD pipeline will work without it, but security scanning will be limited to npm audit and Trivy.

