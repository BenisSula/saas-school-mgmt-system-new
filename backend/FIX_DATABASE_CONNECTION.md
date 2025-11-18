# Fix Database Connection Error - Complete Guide

## Problem
```
❌ Failed to start server due to DB connection error
🔐 Password Authentication Failed
```

## Root Cause
PostgreSQL password in `.env` file (`postgres`) doesn't match the actual PostgreSQL server password.

## Solutions (Choose One)

### ✅ Solution 1: Automated PowerShell Script (Easiest - 30 seconds)

**Requirements:** Administrator privileges

1. **Right-click** on PowerShell → **Run as Administrator**
2. Navigate to backend:
   ```powershell
   cd C:\sumano\saas-school-mgmt-system\backend
   ```
3. Run the fix script:
   ```powershell
   .\scripts\fix-postgres-password.ps1
   ```

**What it does:**
- Temporarily enables trust authentication
- Resets password to `postgres`
- Restores original security settings
- Tests the connection

**Then run:**
```bash
npm run setup:db
npm run dev
```

---

### ✅ Solution 2: Interactive Node.js Script (If you know current password)

1. Run:
   ```bash
   npm run reset:password
   ```
2. Enter your current PostgreSQL password when prompted
3. The script will reset it to `postgres`

**Then run:**
```bash
npm run setup:db
npm run dev
```

---

### ✅ Solution 3: Manual via pgAdmin (Most reliable)

1. **Open pgAdmin** (Windows Start Menu → pgAdmin)
2. **Connect** to PostgreSQL server:
   - Right-click "Servers" → "Register" → "Server"
   - Name: `PostgreSQL 15` (or any name)
   - Host: `localhost`
   - Port: `5432`
   - Username: `postgres`
   - Password: Enter your current password (or leave blank if you don't know)
3. **Open Query Tool**:
   - Right-click on your server → "Query Tool"
4. **Run this SQL**:
   ```sql
   ALTER USER postgres WITH PASSWORD 'postgres';
   ```
5. Click **Execute** (or press F5)
6. **Close pgAdmin**

**Then run:**
```bash
npm run setup:db
npm run dev
```

---

### ✅ Solution 4: Update .env with Your Actual Password

If you prefer to keep your current PostgreSQL password:

1. Open `backend/.env`
2. Find: `DATABASE_URL=postgres://postgres:postgres@localhost:5432/saas_school`
3. Replace the password part:
   ```
   DATABASE_URL=postgres://postgres:YOUR_ACTUAL_PASSWORD@localhost:5432/saas_school
   ```
4. Save the file

**Then run:**
```bash
npm run setup:db
npm run dev
```

---

## After Fixing Password

### Step 1: Setup Database
```bash
npm run setup:db
```

This will:
- ✅ Create `saas_school` database if it doesn't exist
- ✅ Run all migrations
- ✅ Verify setup

### Step 2: Start Server
```bash
npm run dev
```

You should see:
```
✅ Database created successfully
✅ Migrations completed successfully
✅ Shared schema exists
🎉 Database setup completed successfully!
Backend server listening on port 3001
```

---

## Troubleshooting

### Still getting password errors?

1. **Verify PostgreSQL is running:**
   ```powershell
   Get-Service -Name "*postgres*"
   ```

2. **Check which port PostgreSQL uses:**
   ```powershell
   netstat -ano | findstr "5432"
   ```

3. **Verify .env file location:**
   - Should be: `backend/.env` (not `backend/backend/.env`)

4. **Check .env format:**
   ```
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/saas_school
   ```
   (No spaces around `=`)

5. **Try connecting manually:**
   ```powershell
   psql -U postgres -h localhost -p 5432 -d postgres
   ```

### Database doesn't exist?

The `setup:db` script will create it automatically. If it fails:
```sql
CREATE DATABASE saas_school;
```

### Migrations fail?

Make sure:
- PostgreSQL password is correct
- Database `saas_school` exists
- You have proper permissions

---

## Quick Reference

**Current Configuration:**
- Username: `postgres`
- Password: `postgres` (needs to match PostgreSQL)
- Host: `localhost`
- Port: `5432`
- Database: `saas_school`

**Scripts Available:**
- `npm run setup:db` - Setup database and run migrations
- `npm run reset:password` - Interactive password reset
- `npm run migrate` - Run migrations only
- `npm run dev` - Start development server

**Files:**
- `backend/.env` - Environment configuration
- `backend/scripts/fix-postgres-password.ps1` - Automated fix script
- `backend/src/scripts/reset-postgres-password.ts` - Interactive reset tool
- `backend/src/scripts/setup-db-complete.ts` - Database setup script

