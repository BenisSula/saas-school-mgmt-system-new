# Module Development Guide

This guide explains how to create new modules using the module generator and best practices for module development.

## Quick Start

Generate a new module:

```bash
npm run generate:module --name=your-module-name --type=full
```

Options:
- `--name`: Module name in kebab-case (e.g., `attendance-retrospective`)
- `--type`: `frontend`, `backend`, or `full` (default: `full`)

## Module Structure

### Backend Structure

```
backend/
├── src/
│   ├── routes/
│   │   └── your-module.ts          # Express routes
│   ├── services/
│   │   └── yourModule/
│   │       └── yourModuleService.ts # Business logic
│   ├── validators/
│   │   └── yourModuleValidator.ts   # Zod validation schemas
│   └── db/
│       └── migrations/
│           └── tenants/
│               └── XXX_create_your_module.sql
```

### Frontend Structure

```
frontend/
├── src/
│   ├── pages/
│   │   └── admin/
│   │       └── yourModule/
│   │           └── page.tsx        # Main page component
│   ├── components/
│   │   └── yourModule/              # Module-specific components
│   └── hooks/
│       └── queries/
│           └── useYourModule.ts     # React Query hooks
```

## Step-by-Step: Creating a New Module

### 1. Generate Module Scaffold

```bash
npm run generate:module --name=attendance-retrospective --type=full
```

This creates:
- Backend route, service, and validator
- Frontend page, hooks
- README template

### 2. Create Database Migration

Create a migration file in `backend/src/db/migrations/tenants/`:

```sql
-- Migration: Create attendance_retrospectives table
CREATE TABLE IF NOT EXISTS {{schema}}.attendance_retrospectives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES {{schema}}.classes(id),
  student_id UUID NOT NULL REFERENCES {{schema}}.students(id),
  retrospective_date DATE NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES shared.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_retrospectives_class_id 
  ON {{schema}}.attendance_retrospectives(class_id);
```

### 3. Register Backend Route

Add to `backend/src/app.ts`:

```typescript
import attendanceRetrospectiveRouter from './routes/attendance-retrospective';

// ... in route registration section
app.use(
  '/api/attendance-retrospectives',
  authenticate,
  tenantResolver(),
  enhancedTenantIsolation,
  writeLimiter,
  csrfProtection,
  parsePagination,
  cachePolicies.user,
  attendanceRetrospectiveRouter
);
```

### 4. Add Frontend Route

Add to `frontend/src/App.tsx`:

```typescript
const AttendanceRetrospectivePage = lazy(() => import('./pages/admin/attendance-retrospective/page'));

// ... in routes section
<Route
  path="attendance-retrospectives"
  element={
    <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
      <RouteMeta title="Attendance Retrospectives">
        <AttendanceRetrospectivePage />
      </RouteMeta>
    </ProtectedRoute>
  }
/>
```

### 5. Add API Methods

Add to `frontend/src/lib/api.ts`:

```typescript
// Add types
export interface AttendanceRetrospective {
  id: string;
  class_id: string;
  student_id: string;
  retrospective_date: string;
  notes: string | null;
  created_at: string;
}

export interface CreateAttendanceRetrospectivePayload {
  class_id: string;
  student_id: string;
  retrospective_date: string;
  notes?: string;
}

// Add to api object
export const api = {
  // ... existing methods
  attendanceRetrospectives: {
    list: (params?: { classId?: string; limit?: number; offset?: number }) => {
      const queryParams = new URLSearchParams();
      if (params?.classId) queryParams.append('classId', params.classId);
      if (params?.limit) queryParams.append('limit', String(params.limit));
      if (params?.offset) queryParams.append('offset', String(params.offset));
      return apiFetch<AttendanceRetrospective[]>(
        `/attendance-retrospectives${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
      );
    },
    get: (id: string) => apiFetch<AttendanceRetrospective>(`/attendance-retrospectives/${id}`),
    create: (payload: CreateAttendanceRetrospectivePayload) =>
      apiFetch<AttendanceRetrospective>('/attendance-retrospectives', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    update: (id: string, payload: Partial<CreateAttendanceRetrospectivePayload>) =>
      apiFetch<AttendanceRetrospective>(`/attendance-retrospectives/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    delete: (id: string) =>
      apiFetch<{ deleted: boolean }>(`/attendance-retrospectives/${id}`, {
        method: 'DELETE',
      }),
  },
};
```

### 6. Implement Service Logic

Update `backend/src/services/yourModule/yourModuleService.ts`:

- Use repository pattern for data access
- Emit events for async workflows
- Create audit logs for important actions
- Handle errors gracefully

### 7. Add Permissions

Add permissions to `backend/src/config/permissions.ts`:

```typescript
export const permissions = {
  // ... existing permissions
  'your-module:read': ['admin', 'teacher', 'hod'],
  'your-module:create': ['admin'],
  'your-module:update': ['admin'],
  'your-module:delete': ['admin'],
};
```

### 8. Run Migrations

```bash
cd backend
npm run migrate
```

### 9. Validate and Test

```bash
# Lint and format
npm run lint
npm run format:write

# Type check
npm run typecheck --prefix backend
npm run typecheck --prefix frontend

# Run tests
npm run test
```

## Architecture Patterns

### Repository Pattern (Backend)

```typescript
// backend/src/repositories/yourModule/yourModuleRepository.ts
import { BaseRepository } from '../base/baseRepository';
import type { PoolClient } from 'pg';

export class YourModuleRepository extends BaseRepository<YourModule> {
  constructor(client: PoolClient, schema: string) {
    super(client, schema, 'your_module');
  }

  // Add custom query methods here
  async findByCustomField(value: string): Promise<YourModule[]> {
    const result = await this.client.query(
      `SELECT * FROM ${this.schema}.${this.tableName} WHERE custom_field = $1`,
      [value]
    );
    return result.rows;
  }
}
```

### Service Layer (Backend)

```typescript
// backend/src/services/yourModule/yourModuleService.ts
import { YourModuleRepository } from '../../repositories/yourModule/yourModuleRepository';
import { emitEventSafely, EventNames } from '../../lib/events';

export async function createYourModule(
  client: PoolClient,
  schema: string,
  input: YourModuleInput,
  actorId: string
): Promise<YourModule> {
  const repository = new YourModuleRepository(client, schema);
  const item = await repository.create(input);

  // Emit event
  await emitEventSafely(EventNames.YOUR_MODULE_CREATED, {
    id: item.id,
    // ... event data
  });

  // Create audit log
  await createAuditLog(client, {
    userId: actorId,
    action: 'YOUR_MODULE_CREATED',
    resourceType: 'your_module',
    resourceId: item.id,
    details: input,
  });

  return item;
}
```

### React Query Hooks (Frontend)

```typescript
// frontend/src/hooks/queries/useYourModule.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { toast } from 'sonner';

export function useYourModule(filters?: { classId?: string }) {
  return useQuery({
    queryKey: ['your-module', filters],
    queryFn: () => api.yourModule.list(filters),
  });
}

export function useCreateYourModule() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateYourModulePayload) => api.yourModule.create(data),
    onSuccess: () => {
      toast.success('Created successfully');
      queryClient.invalidateQueries({ queryKey: ['your-module'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed: ${error.message}`);
    },
  });
}
```

## Best Practices

### 1. Follow Naming Conventions

- **Files**: kebab-case (`your-module.ts`)
- **Types/Interfaces**: PascalCase (`YourModule`)
- **Functions**: camelCase (`createYourModule`)
- **Constants**: UPPER_SNAKE_CASE (`YOUR_MODULE_CREATED`)

### 2. Error Handling

- Always use try-catch in async functions
- Return meaningful error messages
- Log errors for debugging
- Use appropriate HTTP status codes

### 3. Validation

- Use Zod schemas for input validation
- Validate at route level with `validateInput` middleware
- Validate business rules in service layer

### 4. Security

- Always use `authenticate` middleware
- Use `tenantResolver()` for multi-tenant isolation
- Check permissions with `requirePermission`
- Use CSRF protection for state-changing operations

### 5. Testing

- Write unit tests for services
- Write integration tests for routes
- Write component tests for frontend pages
- Test error cases and edge cases

### 6. Documentation

- Add JSDoc comments to functions
- Document API endpoints
- Update README with module-specific info
- Include examples in code comments

## Example: Class Resources Manager

See the `class-resources-manager` module for a complete example:

- Backend: `backend/src/routes/classResources.ts`
- Service: `backend/src/services/classResources/classResourcesService.ts`
- Frontend: `frontend/src/pages/admin/classResources/page.tsx`
- Migration: `backend/src/db/migrations/tenants/032_create_class_resources_table.sql`

## Seeding Demo Data

Create a seeding script in `scripts/seed_demo_module.ts`:

```typescript
import { getTenantClient } from '../backend/src/db/connection';

async function seedDemoModule() {
  const tenantClient = await getTenantClient('tenant-id');
  // Seed data here
  tenantClient.release();
}
```

Run with:
```bash
ts-node scripts/seed_demo_module.ts
```

## Troubleshooting

### Module not appearing in routes

- Check that route is registered in `backend/src/app.ts`
- Verify route path matches frontend API calls
- Check middleware order (authenticate → tenantResolver → route)

### Type errors

- Run `npm run typecheck` to identify issues
- Ensure types are exported from `frontend/src/lib/api.ts`
- Check that API methods match backend routes

### Database errors

- Verify migration has run: `npm run migrate --prefix backend`
- Check table exists in tenant schema
- Verify foreign key constraints

## Next Steps

1. Generate your module: `npm run generate:module --name=your-module`
2. Implement business logic
3. Add tests
4. Update documentation
5. Deploy and test in staging

For questions or issues, refer to the existing modules or contact the development team.

