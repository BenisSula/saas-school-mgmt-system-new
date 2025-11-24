# Developer Onboarding Guide

Welcome to the SaaS School Management System! This guide will help you get started with development.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: v18.x or higher
- **npm**: v9.x or higher (or pnpm/yarn)
- **PostgreSQL**: v14.x or higher
- **Git**: Latest version

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd saas-school-mgmt-system
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
npm install --prefix backend

# Install frontend dependencies
npm install --prefix frontend
```

### 3. Set Up Environment Variables

#### Backend Environment

Create `backend/.env` file:

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/school_management
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=school_management

# JWT Secrets
JWT_SECRET=your-secret-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-key-change-in-production

# Server
PORT=3001
NODE_ENV=development

# CORS
CORS_ORIGIN=http://localhost:5173

# Optional: Skip migrations for faster startup
SKIP_MIGRATIONS=false

# Optional: Auto-seed demo data
AUTO_SEED_DEMO=true
```

#### Frontend Environment

Create `frontend/.env` file:

```env
VITE_API_URL=http://localhost:3001
```

### 4. Set Up Database

```bash
# Start PostgreSQL (if not running)
# On macOS with Homebrew:
brew services start postgresql

# On Linux:
sudo systemctl start postgresql

# On Windows:
# Start PostgreSQL service from Services

# Run database setup
cd backend
npm run setup:db
```

### 5. Generate API Types (Optional but Recommended)

```bash
# From root directory
npm run generate:api-types
```

This generates TypeScript types from the OpenAPI specification.

### 6. Start Development Servers

```bash
# From root directory - starts both frontend and backend
npm run dev

# Or start separately:
# Backend only
npm run dev --prefix backend

# Frontend only
npm run dev --prefix frontend
```

The application will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

## Development Workflow

### Pre-commit Hooks

The project uses Husky for pre-commit hooks. Before each commit:
- Linting is automatically run and fixed
- Code is automatically formatted
- Tests are run

To bypass hooks (not recommended):
```bash
git commit --no-verify
```

### Running Tests

```bash
# Run all tests
npm run test

# Backend tests only
npm run test --prefix backend

# Frontend tests only
npm run test --prefix frontend

# Watch mode
npm run test:watch --prefix backend
npm run test:watch --prefix frontend
```

### Code Formatting

```bash
# Check formatting
npm run format

# Auto-fix formatting
npm run format:write
```

### Linting

```bash
# Run linter
npm run lint

# Auto-fix linting issues
npm run lint -- --fix
```

## Project Structure

```
saas-school-mgmt-system/
├── backend/          # Express.js backend
│   ├── src/
│   │   ├── routes/  # API routes
│   │   ├── services/ # Business logic
│   │   ├── repositories/ # Data access layer
│   │   └── middleware/ # Express middleware
│   └── tests/        # Backend tests
│
├── frontend/         # React frontend
│   ├── src/
│   │   ├── pages/   # Page components
│   │   ├── components/ # Reusable components
│   │   ├── hooks/   # React hooks
│   │   └── lib/     # Utilities
│   └── e2e/         # E2E tests
│
├── shared/          # Shared code
│   └── domain/      # Shared types and validators
│
└── developer-docs/  # Developer documentation
```

## Common Tasks

### Creating a New API Endpoint

1. Create route in `backend/src/routes/`
2. Create service in `backend/src/services/`
3. Create repository if needed in `backend/src/repositories/`
4. Add validation in `backend/src/validators/`
5. Update `backend/openapi.yaml`
6. Regenerate API types: `npm run generate:api-types`

### Creating a New Frontend Page

1. Create page component in `frontend/src/pages/`
2. Add route in `frontend/src/App.tsx`
3. Create hooks for data fetching in `frontend/src/hooks/queries/`
4. Add components in `frontend/src/components/` if needed

### Database Migrations

```bash
# Run migrations
cd backend
npm run migrate

# Create new migration
# Edit backend/src/db/migrations/XXX_description.sql
```

## Troubleshooting

### Backend won't start

1. Check PostgreSQL is running
2. Verify `.env` file exists and has correct values
3. Check database connection: `psql -U postgres -d school_management`
4. Try skipping migrations: Set `SKIP_MIGRATIONS=true` in `.env`

### Frontend won't start

1. Clear node_modules and reinstall: `rm -rf node_modules && npm install`
2. Clear Vite cache: `rm -rf frontend/node_modules/.vite`
3. Check port 5173 is not in use

### Tests failing

1. Ensure database is set up
2. Check environment variables
3. Run tests individually to isolate issues

### Pre-commit hooks failing

1. Run `npm run lint` and fix issues
2. Run `npm run format:write` to fix formatting
3. Run tests to ensure they pass

## Getting Help

- Check `developer-docs/` for detailed guides
- Review `docs/` for architecture and API documentation
- Check existing code for patterns and examples

## Next Steps

1. Read [Coding Guidelines](./coding-guidelines.md)
2. Review [Architecture Overview](./architecture-overview.md)
3. Explore the codebase
4. Start with small tasks to get familiar

Welcome to the team! 🚀

