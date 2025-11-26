# PHASE 7 — Secrets Hardening & Security

## ✅ Secrets Management Status

### Current Status
- ✅ `.env` files are gitignored (verified in `.gitignore`)
- ✅ `.env.local`, `.env.development`, `.env.production` are gitignored
- ⚠️ `.env.example` files should be created but not committed with secrets
- 📝 Secrets rotation recommended if exposed

---

## Secrets in Repository

### Files That May Contain Secrets

The following files may contain secrets or sensitive configuration:

1. **Docker Compose Files**:
   - `docker-compose.yml` - Contains example secrets (should use environment variables)
   - `docker-compose.production.yml` - Production secrets (should use secrets management)

2. **Code Files**:
   - Check all `.ts`, `.js` files for hardcoded secrets
   - Review configuration files for exposed credentials

3. **Documentation**:
   - README files may contain example credentials (acceptable for demo accounts)
   - Ensure production secrets are never documented

### Recommended Actions

#### 1. Review Git History for Exposed Secrets

```bash
# Search git history for potential secrets
git log --all --full-history --source -- '*secret*' '*password*' '*api_key*' '*.env'

# Check for files that were committed and then removed
git log --all --diff-filter=D --summary | grep -E '\.env|secret|password'

# Review recent commits for sensitive data
git log -p --all -S 'JWT_SECRET' -- '*'
```

#### 2. Rotate Secrets If Exposed

If secrets were found in git history:

1. **Generate New Secrets**:
   ```bash
   # Generate secure JWT secrets
   openssl rand -hex 32  # For JWT_SECRET
   openssl rand -hex 32  # For JWT_REFRESH_SECRET
   
   # Generate session secret
   openssl rand -hex 32  # For SESSION_SECRET
   ```

2. **Update All Environments**:
   - Development `.env` files
   - Staging environment variables
   - Production secrets management (e.g., AWS Secrets Manager, HashiCorp Vault)

3. **Invalidate Existing Tokens** (if JWT secrets changed):
   - Users will need to log in again
   - Refresh tokens will be invalidated

#### 3. Use Environment Variables in Docker Compose

**Current**: `docker-compose.yml` contains example secrets
**Recommended**: Use environment variables or Docker secrets

**Option 1: Environment Variables** (Recommended for Development)

```yaml
# docker-compose.yml
services:
  backend:
    environment:
      JWT_SECRET: ${JWT_SECRET:-change-me-access}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET:-change-me-refresh}
```

Create `.env` file (gitignored):
```env
JWT_SECRET=your-actual-secret-here
JWT_REFRESH_SECRET=your-actual-refresh-secret-here
```

**Option 2: Docker Secrets** (Recommended for Production)

```yaml
# docker-compose.production.yml
services:
  backend:
    secrets:
      - jwt_secret
      - jwt_refresh_secret
    environment:
      JWT_SECRET_FILE: /run/secrets/jwt_secret
      JWT_REFRESH_SECRET_FILE: /run/secrets/jwt_refresh_secret

secrets:
  jwt_secret:
    file: ./secrets/jwt_secret.txt
  jwt_refresh_secret:
    file: ./secrets/jwt_refresh_secret.txt
```

#### 4. Create .env.example Files

**Backend `.env.example`** (already documented in PHASE6):

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Database Configuration
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/saas_school

# JWT Configuration
# Generate with: openssl rand -hex 32
JWT_SECRET=your-secret-key-here-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-key-here-change-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# CORS Configuration
CORS_ORIGIN=http://localhost:5173

# Migration Configuration
SKIP_MIGRATIONS=false

# Demo Tenant Configuration (development only)
AUTO_SEED_DEMO=true
DEMO_ADMIN_EMAIL=admin.demo@academy.test
DEMO_ADMIN_PASSWORD=AdminDemo#2025
```

**Frontend `.env.example`**:

```env
# API Configuration
# Leave unset to use Vite proxy (/api)
# VITE_API_BASE_URL=/api

# For direct API calls
# VITE_API_BASE_URL=http://127.0.0.1:3001/api
```

**Note**: `.env.example` files should be committed to git (they contain no secrets).

---

## Secret Rotation Checklist

If secrets were exposed, follow this checklist:

### 1. Identify Exposed Secrets
- [ ] Search git history for secrets
- [ ] Review all `.env` files that were committed
- [ ] Check Docker Compose files for hardcoded secrets
- [ ] Review code for hardcoded credentials

### 2. Generate New Secrets
- [ ] Generate new JWT_SECRET
- [ ] Generate new JWT_REFRESH_SECRET
- [ ] Generate new SESSION_SECRET (if used)
- [ ] Update database passwords (if exposed)
- [ ] Rotate API keys (if any)

### 3. Update Configuration
- [ ] Update development `.env` files
- [ ] Update staging environment
- [ ] Update production secrets management
- [ ] Update Docker Compose files to use environment variables
- [ ] Create `.env.example` files (without secrets)

### 4. Notify and Remediate
- [ ] Notify team members of secret rotation
- [ ] Update deployment documentation
- [ ] Invalidate existing tokens (if JWT secrets changed)
- [ ] Monitor for unauthorized access

### 5. Prevent Future Exposure
- [ ] Verify `.gitignore` includes `.env*` files
- [ ] Use pre-commit hooks to detect secrets
- [ ] Implement secret scanning in CI/CD
- [ ] Document secret management process
- [ ] Train team on secret handling

---

## Secret Scanning Tools

### Recommended Tools

1. **git-secrets** (AWS):
   ```bash
   git secrets --install
   git secrets --register-aws
   git secrets --add 'JWT_SECRET|PASSWORD|API_KEY'
   ```

2. **truffleHog**:
   ```bash
   docker run -it -v "$PWD:/pwd" trufflesecurity/trufflehog:latest filesystem /pwd
   ```

3. **gitleaks**:
   ```bash
   gitleaks detect --source . --verbose
   ```

4. **GitHub Secret Scanning** (if using GitHub):
   - Automatically enabled for public repos
   - Can be enabled for private repos in settings

### Pre-commit Hook Example

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash
# Pre-commit hook to detect secrets

# Patterns to detect
PATTERNS=(
  "JWT_SECRET\s*=\s*['\"][^'\"]+['\"]"
  "PASSWORD\s*=\s*['\"][^'\"]+['\"]"
  "API_KEY\s*=\s*['\"][^'\"]+['\"]"
)

for pattern in "${PATTERNS[@]}"; do
  if git diff --cached | grep -E "$pattern"; then
    echo "ERROR: Potential secret detected in commit!"
    echo "Pattern: $pattern"
    exit 1
  fi
done
```

---

## Best Practices

### 1. Never Commit Secrets
- ✅ Use `.env` files (gitignored)
- ✅ Use environment variables
- ✅ Use secrets management services (AWS Secrets Manager, HashiCorp Vault)
- ❌ Never hardcode secrets in code
- ❌ Never commit `.env` files

### 2. Use Strong Secrets
- Generate secrets with `openssl rand -hex 32` (256-bit)
- Use different secrets for each environment
- Rotate secrets regularly (quarterly recommended)

### 3. Secure Storage
- Development: `.env` files (gitignored)
- Staging: Environment variables or secrets management
- Production: Secrets management service (AWS Secrets Manager, HashiCorp Vault, etc.)

### 4. Access Control
- Limit access to production secrets
- Use least privilege principle
- Audit secret access
- Rotate secrets when team members leave

### 5. Monitoring
- Monitor for secret exposure
- Set up alerts for unauthorized access
- Review access logs regularly
- Use secret scanning in CI/CD

---

## Production Secrets Management

### AWS Secrets Manager

```bash
# Store secret
aws secretsmanager create-secret \
  --name saas-school/jwt-secret \
  --secret-string "your-secret-here"

# Retrieve secret in application
aws secretsmanager get-secret-value \
  --secret-id saas-school/jwt-secret
```

### HashiCorp Vault

```bash
# Store secret
vault kv put secret/saas-school jwt_secret="your-secret-here"

# Retrieve secret in application
vault kv get secret/saas-school
```

### Docker Swarm Secrets

```bash
# Create secret
echo "your-secret-here" | docker secret create jwt_secret -

# Use in docker-compose.yml
services:
  backend:
    secrets:
      - jwt_secret
```

---

## Summary

### ✅ Completed
- [x] Verified `.env` files are gitignored
- [x] Documented secrets management best practices
- [x] Created rotation checklist
- [x] Provided secret scanning tool recommendations
- [x] Documented production secrets management options

### 📝 Recommendations
1. **Review Git History**: Search for exposed secrets and rotate if found
2. **Create `.env.example` Files**: Template files without secrets
3. **Update Docker Compose**: Use environment variables instead of hardcoded secrets
4. **Implement Secret Scanning**: Add to CI/CD pipeline
5. **Use Secrets Management**: For production environments

### ⚠️ Action Required
- Review git history for exposed secrets
- Rotate secrets if any were exposed
- Create `.env.example` files (if not already created)
- Update `docker-compose.yml` to use environment variables

---

**Security is an ongoing process. Regularly review and update your secrets management practices.**

