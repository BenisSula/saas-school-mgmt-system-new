# Architecture Overview

This document provides a high-level overview of the SaaS School Management System architecture.

## System Architecture

```
┌─────────────────┐
│   Frontend      │
│   (React/Vite)  │
└────────┬────────┘
         │ HTTP/REST
         │
┌────────▼────────┐
│   Backend API   │
│  (Express/TS)   │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼────┐
│Shared │ │Tenant│
│Schema │ │Schema│
└───────┘ └──────┘
```

## Architecture Layers

### 1. Frontend Layer

**Technology Stack:**
- React 18 with TypeScript
- Vite for build tooling
- React Router for routing
- React Query for server state
- Zustand for client state
- Tailwind CSS for styling

**Key Principles:**
- Component-based architecture
- Atomic design pattern
- Role-aware routing
- Type-safe API client

### 2. Backend Layer

**Technology Stack:**
- Express.js with TypeScript
- PostgreSQL with schema-per-tenant
- JWT for authentication
- Event-driven architecture

**Architecture Pattern:**
```
Routes → Services → Repositories → Database
              ↓
         Event Emitter
              ↓
         Event Handlers
```

### 3. Data Layer

**Multi-Tenant Architecture:**
- Schema-per-tenant isolation
- Shared schema for platform data
- Tenant-specific schemas for school data

**Database Structure:**
```
PostgreSQL
├── shared (platform data)
│   ├── tenants
│   ├── users
│   └── subscriptions
└── tenant_{uuid} (school data)
    ├── students
    ├── teachers
    ├── classes
    └── ...
```

## Domain-Driven Design

The system is organized by domain:

### Student Domain
- **Repository**: `StudentRepository`
- **Service**: `StudentService`
- **Routes**: `/students/*`
- **Types**: `shared/domain/types/student.types.ts`

### User Domain
- **Repository**: `UserRepository`
- **Service**: `UserService`
- **Routes**: `/users/*`
- **Types**: `shared/domain/types/user.types.ts`

### Teacher Domain
- **Repository**: `TeacherRepository`
- **Service**: `TeacherService`
- **Routes**: `/teachers/*`

## Key Architectural Patterns

### Repository Pattern

All database access goes through repositories:

```typescript
// Repository handles data access
class StudentRepository extends BaseRepository {
  async findById(id: string): Promise<Student | null> {
    // Database query
  }
}

// Service uses repository
class StudentService {
  async getStudent(id: string): Promise<Student> {
    return this.repository.findById(id);
  }
}
```

**Benefits:**
- Separation of concerns
- Easier testing (mock repositories)
- Database-agnostic business logic

### Service Layer Pattern

Services contain business logic:

```typescript
export async function createStudent(
  input: StudentInput,
  actorId: string
): Promise<Student> {
  // Business logic
  const student = await repository.create(input);
  
  // Emit events
  await emitEvent(EventNames.STUDENT_CREATED, { studentId: student.id });
  
  return student;
}
```

**Responsibilities:**
- Business logic
- Validation
- Event emission
- Orchestration

### Event-Driven Architecture

Services emit events for async workflows:

```typescript
// Service emits event
await emitEvent(EventNames.STUDENT_CREATED, {
  studentId: student.id,
  actorId,
  timestamp: new Date()
});

// Handler processes event
onEvent(EventNames.STUDENT_CREATED, async (payload) => {
  await sendNotification(payload.studentId);
  await updateAnalytics(payload);
});
```

**Benefits:**
- Decoupled components
- Async processing
- Scalability

## Security Architecture

### Authentication

- JWT-based authentication
- Access tokens (short-lived)
- Refresh tokens (long-lived)
- Token rotation

### Authorization

- Role-Based Access Control (RBAC)
- Permission-based authorization
- Multi-tenant isolation
- Resource-level permissions

### Data Protection

- Schema-per-tenant isolation
- Input validation and sanitization
- SQL injection prevention (parameterized queries)
- XSS protection
- CSRF protection

## API Architecture

### RESTful Design

- Resource-based URLs
- HTTP methods for actions
- Status codes for responses
- JSON for data exchange

### API Versioning

- URL-based versioning: `/api/v1/students`
- Backward compatibility maintained

### Error Handling

```typescript
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": { /* field-specific errors */ }
  }
}
```

## Frontend Architecture

### Component Hierarchy

```
Pages
  └── Layouts
      └── Components
          ├── UI Primitives
          └── Domain Components
```

### State Management

**Server State:**
- React Query for API data
- Automatic caching and refetching
- Optimistic updates

**Client State:**
- Zustand for global UI state
- React Context for auth/theme
- Local state for component-specific data

### Routing

- Role-aware routing
- Protected routes
- Lazy loading
- Code splitting

## Build & Deployment

### Development

- Hot reload for both frontend and backend
- TypeScript compilation
- ESLint and Prettier
- Pre-commit hooks

### Production

- Optimized builds
- Code splitting
- Minification
- Source maps (optional)

## Monitoring & Observability

### Logging

- Structured logging
- Log levels (error, warn, info, debug)
- Request/response logging

### Metrics

- Performance metrics
- Error rates
- API usage statistics

### Error Tracking

- Error aggregation
- Stack traces
- User context

## Scalability Considerations

### Horizontal Scaling

- Stateless backend
- Database connection pooling
- Load balancing ready

### Performance

- Database indexing
- Query optimization
- Caching strategies
- Code splitting

### Multi-Tenancy

- Schema isolation
- Tenant-aware queries
- Resource quotas

## Technology Decisions

### Why TypeScript?

- Type safety
- Better IDE support
- Easier refactoring
- Self-documenting code

### Why React Query?

- Automatic caching
- Background updates
- Optimistic updates
- Error handling

### Why Repository Pattern?

- Testability
- Maintainability
- Database abstraction
- Consistent data access

### Why Event-Driven?

- Decoupling
- Scalability
- Async processing
- Extensibility

## Future Considerations

### Potential Improvements

- GraphQL API option
- Microservices migration
- Real-time features (WebSockets)
- Caching layer (Redis)
- Message queue (RabbitMQ/Kafka)

### Migration Path

- Incremental improvements
- Backward compatibility
- Feature flags
- Gradual rollout

## Related Documentation

- [Coding Guidelines](./coding-guidelines.md)
- [Onboarding Guide](./onboarding.md)
- [API Documentation](../docs/API_USAGE_DOCUMENTATION.md)
- [Architecture Map](../docs/architecture-map.md)

---

For detailed implementation details, see the codebase and inline documentation.

