# Coding Guidelines

This document outlines the coding standards and best practices for the SaaS School Management System.

## Table of Contents

- [General Principles](#general-principles)
- [TypeScript Guidelines](#typescript-guidelines)
- [React Guidelines](#react-guidelines)
- [Backend Guidelines](#backend-guidelines)
- [Naming Conventions](#naming-conventions)
- [File Organization](#file-organization)
- [Code Formatting](#code-formatting)
- [Testing Guidelines](#testing-guidelines)

## General Principles

### DRY (Don't Repeat Yourself)

- Extract duplicated logic to shared modules
- Use reusable components and utilities
- Avoid copy-pasting code

### SOLID Principles

- **Single Responsibility**: Each function/class should do one thing
- **Open/Closed**: Open for extension, closed for modification
- **Liskov Substitution**: Subtypes must be substitutable
- **Interface Segregation**: Many specific interfaces > one general
- **Dependency Inversion**: Depend on abstractions, not concretions

### Clean Code

- Write self-documenting code
- Use meaningful variable and function names
- Keep functions small and focused
- Avoid deep nesting (max 3 levels)

## TypeScript Guidelines

### Type Safety

```typescript
// ✅ Good: Explicit types
function createUser(input: UserInput): Promise<User> {
  // ...
}

// ❌ Bad: Any types
function createUser(input: any): any {
  // ...
}
```

### Interfaces vs Types

- Use `interface` for object shapes that may be extended
- Use `type` for unions, intersections, and computed types

```typescript
// ✅ Good: Interface for extensible shapes
interface User {
  id: string;
  email: string;
}

// ✅ Good: Type for unions
type UserRole = 'student' | 'teacher' | 'admin';

// ✅ Good: Type for computed types
type UserWithPermissions = User & { permissions: string[] };
```

### Avoid `any`

```typescript
// ❌ Bad
function processData(data: any) {
  // ...
}

// ✅ Good: Use unknown and type guards
function processData(data: unknown) {
  if (isUserData(data)) {
    // TypeScript knows data is UserData here
  }
}
```

### Null Safety

```typescript
// ✅ Good: Explicit null handling
function getUser(id: string): User | null {
  // ...
}

// ✅ Good: Optional chaining
const email = user?.profile?.email;

// ✅ Good: Nullish coalescing
const name = user?.name ?? 'Unknown';
```

## React Guidelines

### Component Structure

```typescript
// ✅ Good: Functional components with TypeScript
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export function Button({ label, onClick, variant = 'primary' }: ButtonProps) {
  return (
    <button onClick={onClick} className={variant}>
      {label}
    </button>
  );
}
```

### Hooks

- Use custom hooks to extract reusable logic
- Follow the Rules of Hooks (only call at top level)
- Use `useMemo` and `useCallback` judiciously

```typescript
// ✅ Good: Custom hook
function useStudents(filters: StudentFilters) {
  return useQuery({
    queryKey: ['students', filters],
    queryFn: () => fetchStudents(filters)
  });
}

// ✅ Good: Memoization for expensive computations
const sortedStudents = useMemo(
  () => students.sort((a, b) => a.name.localeCompare(b.name)),
  [students]
);
```

### State Management

- Use React Query for server state
- Use Zustand for client state
- Avoid prop drilling (use context or state management)

### Component Organization

```typescript
// ✅ Good: Organized component
export function StudentList() {
  // 1. Hooks
  const { data, isLoading } = useStudents();
  const [filters, setFilters] = useState<StudentFilters>({});

  // 2. Computed values
  const filteredStudents = useMemo(() => {
    // ...
  }, [data, filters]);

  // 3. Event handlers
  const handleFilterChange = useCallback((newFilters: StudentFilters) => {
    setFilters(newFilters);
  }, []);

  // 4. Early returns
  if (isLoading) return <LoadingSpinner />;
  if (!data) return <EmptyState />;

  // 5. Render
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

## Backend Guidelines

### Service Layer

- Services contain business logic
- Services use repositories for data access
- Services emit events for async workflows

```typescript
// ✅ Good: Service using repository
export async function createStudent(
  client: PoolClient,
  schema: string,
  input: StudentInput,
  actorId: string
): Promise<Student> {
  const repository = new StudentRepository(client, schema);
  const student = await repository.create(input);
  
  // Emit event
  await emitEventSafely(EventNames.STUDENT_CREATED, {
    studentId: student.id,
    actorId,
    timestamp: new Date()
  });
  
  return student;
}
```

### Repository Pattern

- All database access through repositories
- Repositories extend `BaseRepository`
- Use prepared statements (automatic with pg)

```typescript
// ✅ Good: Repository method
async findById(id: string): Promise<Student | null> {
  const result = await this.client.query(
    `SELECT * FROM ${this.getTableName()} WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}
```

### Route Handlers

- Routes are thin - only handle HTTP concerns
- Routes call services, never repositories directly
- Always use middleware for auth/validation

```typescript
// ✅ Good: Thin route handler
router.post('/', authenticate, validateInput(createStudentSchema), async (req, res, next) => {
  try {
    const student = await studentService.create(
      req.tenantClient!,
      req.tenant!.schema,
      req.body,
      req.user!.id
    );
    res.json(createSuccessResponse(student));
  } catch (error) {
    next(error);
  }
});
```

### Error Handling

- Use custom error classes
- Always handle errors in routes
- Log errors appropriately

```typescript
// ✅ Good: Error handling
try {
  const result = await service.doSomething();
  return result;
} catch (error) {
  if (error instanceof ValidationError) {
    throw new ApiError(400, error.message);
  }
  logger.error('Unexpected error', error);
  throw new ApiError(500, 'Internal server error');
}
```

## Naming Conventions

### Files

- **Components**: `PascalCase.tsx` (e.g., `StudentList.tsx`)
- **Services**: `camelCase.ts` (e.g., `studentService.ts`)
- **Repositories**: `camelCase.ts` (e.g., `studentRepository.ts`)
- **Types**: `camelCase.types.ts` (e.g., `student.types.ts`)
- **Hooks**: `useCamelCase.ts` (e.g., `useStudents.ts`)

### Variables and Functions

- **Variables**: `camelCase` (e.g., `studentList`)
- **Functions**: `camelCase` (e.g., `createStudent`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_STUDENTS`)
- **Types/Interfaces**: `PascalCase` (e.g., `StudentInput`)

### Database

- **Tables**: `snake_case` (e.g., `student_profiles`)
- **Columns**: `snake_case` (e.g., `created_at`)
- **Schemas**: `snake_case` (e.g., `tenant_123`)

## File Organization

### Backend Structure

```
backend/src/
├── routes/           # API routes (thin layer)
├── services/         # Business logic
│   └── {domain}/     # Domain-specific services
├── repositories/      # Data access
│   └── {domain}/     # Domain-specific repositories
├── middleware/       # Express middleware
├── validators/       # Input validation
└── lib/              # Utilities
```

### Frontend Structure

```
frontend/src/
├── pages/            # Page components
├── components/       # Reusable components
│   ├── ui/          # UI primitives
│   └── {domain}/    # Domain-specific components
├── hooks/           # React hooks
│   └── queries/     # React Query hooks
├── lib/             # Utilities
└── types/           # TypeScript types
```

## Code Formatting

### Prettier Configuration

The project uses Prettier with the following settings:
- Single quotes
- Semicolons
- 100 character line width
- 2 space indentation
- Trailing commas (ES5)

Run `npm run format:write` to auto-format code.

### ESLint Rules

- No `any` types (use `unknown` with type guards)
- No `console.log` (use `console.warn` or `console.error`)
- Unused variables prefixed with `_`
- React hooks rules enforced

## Testing Guidelines

### Unit Tests

- Test business logic in services
- Test utility functions
- Mock external dependencies

```typescript
// ✅ Good: Unit test
describe('StudentService', () => {
  it('should create a student', async () => {
    const mockRepo = createMockRepository();
    const service = new StudentService(mockRepo);
    
    const result = await service.create(validInput);
    
    expect(result).toBeDefined();
    expect(mockRepo.create).toHaveBeenCalledWith(validInput);
  });
});
```

### Integration Tests

- Test API endpoints
- Test database operations
- Use test database

### E2E Tests

- Test critical user flows
- Use Playwright
- Keep tests focused and fast

## Best Practices

### Performance

- Use React.memo for expensive components
- Lazy load routes
- Optimize database queries
- Use pagination for large datasets

### Security

- Always validate input
- Use parameterized queries
- Sanitize user input
- Follow principle of least privilege

### Accessibility

- Use semantic HTML
- Provide ARIA labels
- Ensure keyboard navigation
- Test with screen readers

### Documentation

- Document complex logic
- Add JSDoc comments for public APIs
- Keep README files updated
- Document breaking changes

## Code Review Checklist

- [ ] Code follows style guide
- [ ] Types are properly defined
- [ ] Error handling is appropriate
- [ ] Tests are included
- [ ] Documentation is updated
- [ ] No security vulnerabilities
- [ ] Performance considerations addressed
- [ ] Accessibility requirements met

---

For more details, see:
- [Architecture Overview](./architecture-overview.md)
- [Onboarding Guide](./onboarding.md)

