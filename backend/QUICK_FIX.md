# Quick Fix Guide - Server Startup Failure

## Current Error
```
❌ Password Authentication Failed
The PostgreSQL password in your .env file does not match your PostgreSQL server.
```

## Solution (Choose One)

### ✅ Option 1: Reset PostgreSQL Password (Recommended - 2 minutes)

**Using pgAdmin:**
1. Open **pgAdmin** from Windows Start Menu
2. Connect to your PostgreSQL server (enter your current password if prompted)
3. Right-click on your server → **Query Tool**
4. Paste and run:
   ```sql
   ALTER USER postgres WITH PASSWORD 'postgres';
   ```
5. Click **Execute** (or press F5)
6. Close pgAdmin

**Using psql command line:**
```powershell
psql -U postgres -h localhost -p 5432
# Enter your current password when prompted
ALTER USER postgres WITH PASSWORD 'postgres';
\q
```

**Then run:**
```bash
npm run setup:db
npm run dev
```

---

### ✅ Option 2: Update .env with Your Actual Password

1. Open `backend/.env`
2. Find the line: `DATABASE_URL=postgres://postgres:postgres@localhost:5432/saas_school`
3. Replace `postgres` (the password part) with your actual PostgreSQL password:
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

### ⚠️ Option 3: Temporary Workaround (Skip Migrations)

**Note:** This will skip migrations but the server may still fail when trying to query the database.

1. Open `backend/.env`
2. Add this line:
   ```
   SKIP_MIGRATIONS=true
   ```
3. Save the file

**Then run:**
```bash
npm run dev
```

**⚠️ Warning:** This is only for testing. You still need to fix the password and run migrations properly.

---

## After Fixing Password

Once the password is fixed, run:
```bash
# Setup database and run migrations
npm run setup:db

# Start the server
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

## Still Having Issues?

1. Check PostgreSQL is running:
   ```powershell
   Get-Service -Name "*postgres*"
   ```

2. Check PostgreSQL port:
   ```powershell
   netstat -ano | findstr "5432"
   ```

3. Verify .env file location:
   - Should be in `backend/.env` (not `backend/backend/.env`)

4. Check .env file format:
   ```
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/saas_school
   ```
   (No spaces around `=`)

