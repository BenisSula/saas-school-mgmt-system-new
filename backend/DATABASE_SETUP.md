# Database Setup Guide

## Current Status
✅ Database setup script created (`npm run setup:db`)  
✅ Migration files ready  
❌ PostgreSQL password authentication needs to be fixed

## Quick Setup Steps

### Step 1: Fix PostgreSQL Password

You have 3 options:

#### Option A: Reset Password via pgAdmin (Easiest)
1. Open **pgAdmin** (usually in Windows Start Menu)
2. Connect to your PostgreSQL server (you'll need your current password)
3. Right-click on your server → **Query Tool**
4. Run this SQL command:
   ```sql
   ALTER USER postgres WITH PASSWORD 'postgres';
   ```
5. Click **Execute** (F5)

#### Option B: Reset Password via psql Command Line
1. Open PowerShell or Command Prompt
2. Run:
   ```powershell
   psql -U postgres -h localhost -p 5432
   ```
3. Enter your current password when prompted
4. Run:
   ```sql
   ALTER USER postgres WITH PASSWORD 'postgres';
   ```
5. Type `\q` to exit

#### Option C: Update .env with Your Actual Password
If you prefer to keep your current password, update the `.env` file:
```
DATABASE_URL=postgres://postgres:YOUR_ACTUAL_PASSWORD@localhost:5432/saas_school
```

### Step 2: Run Database Setup

After fixing the password, run:
```bash
npm run setup:db
```

This will:
- ✅ Create the `saas_school` database if it doesn't exist
- ✅ Run all migrations
- ✅ Verify the setup

### Step 3: Verify Setup

After successful setup, you should see:
```
✅ Database created successfully (or already exists)
✅ Migrations completed successfully
✅ Shared schema exists
✅ Found X tables in shared schema
🎉 Database setup completed successfully!
```

## Current Configuration

**Database Credentials (from .env):**
- Username: `postgres`
- Password: `postgres` (needs to match PostgreSQL)
- Host: `localhost`
- Port: `5432`
- Database: `saas_school`

## Troubleshooting

### Error: "password authentication failed"
- Make sure the password in `.env` matches your PostgreSQL password
- Or reset PostgreSQL password to match `.env` (see Step 1)

### Error: "database does not exist"
- The setup script will create it automatically
- Or create manually: `CREATE DATABASE saas_school;`

### Error: "connection refused"
- Make sure PostgreSQL is running
- Check if it's running on port 5432: `netstat -ano | findstr "5432"`

## Next Steps

After successful migration:
1. Run `npm run dev` to start the backend server
2. The server will automatically connect to the database
3. Check the console for "Backend server listening on port 3001"

