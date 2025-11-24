# Architecture Map - Phase C4

**Date:** 2025-01-XX  
**Phase:** C4 - Architecture Hardening & Modularization  
**Status:** In Progress

---

## Executive Summary

This document maps the architecture transformation from the current state to a hardened, modular architecture following Domain-Driven Design (DDD) principles, Repository pattern, and strict abstraction barriers.

---

## Table of Contents

1. [Current Architecture (Before)](#current-architecture-before)
2. [Target Architecture (After)](#target-architecture-after)
3. [Module Responsibilities](#module-responsibilities)
4. [Abstraction Barriers](#abstraction-barriers)
5. [Migration Strategy](#migration-strategy)

---

## Current Architecture (Before)

### Backend Structure

```
backend/src/
├── routes/                    # API endpoints (some direct DB access)
│   ├── students.ts           # ❌ Direct DB queries (lines 79-82, 137-140, etc.)
│   ├── teachers.ts           # ❌ Direct DB queries
│   ├── auth.ts               # ✅ Uses services
│   └── ...
│
├── services/                  # Business logic (mixed with DB access)
│   ├── studentService.ts     # ❌ Direct DB queries
│   ├── userService.ts        # ❌ Direct DB queries
│   ├── teacherService.ts     # ❌ Direct DB queries
│   └── ...
│
├── repositories/              # ❌ Empty - no repository pattern
│
├── validators/                # Input validation (backend-only)
│   ├── studentValidator.ts
│   ├── userValidator.ts
│   └── ...
│
├── lib/                       # Utilities
│   ├── crudHelpers.ts        # ❌ Direct DB access helpers
│   ├── queryUtils.ts         # Query building utilities
│   └── events/               # ❌ Empty - no event system
│
└── shared/                    # ❌ Empty - no shared domain layer
    └── domain/
```

### Frontend Structure

```
frontend/src/
├── pages/                     # Page components
├── components/                # UI components
│   ├── ui/                   # Reusable primitives
│   ├── admin/                # Admin components
│   └── ...
│
├── hooks/                     # React hooks
│   └── queries/              # React Query hooks
│
├── lib/                       # Utilities
│   ├── api.ts                # API client
│   ├── validators/           # ❌ Duplicate validators (authSchema.ts)
│   └── ...
│
└── types/                     # ❌ Frontend-only types
    └── auth.ts
```

### Shared Structure

```
shared/
├── types/                     # ❌ Placeholder only
├── validators/                # ❌ Placeholder only
├── constants/                # ✅ Some constants
└── utils/                     # ✅ Some utilities
```

### Issues Identified

1. **Direct DB Access in Routes**: 22+ instances of `client.query()` in route files
2. **No Repository Pattern**: Services directly access database
3. **Mixed Responsibilities**: Services contain both business logic and data access
4. **Duplicate Validators**: Frontend has its own validators (e.g., `authSchema.ts`)
5. **No Event System**: No async workflow support via events
6. **No Shared Domain Layer**: Types and validators not shared between frontend/backend
7. **Inconsistent Naming**: Mix of camelCase, snake_case, kebab-case

---

## Target Architecture (After)

### Backend Structure

```
backend/src/
├── routes/                    # API endpoints (thin layer)
│   ├── students.ts           # ✅ Only calls services
│   ├── teachers.ts           # ✅ Only calls services
│   └── ...
│
├── services/                  # Business logic (pure, no DB access)
│   ├── students/
│   │   ├── studentService.ts # ✅ Uses repositories only
│   │   └── studentEvents.ts  # ✅ Event definitions
│   ├── users/
│   │   ├── userService.ts
│   │   └── userEvents.ts
│   └── ...
│
├── repositories/              # ✅ Data access layer
│   ├── students/
│   │   └── studentRepository.ts
│   ├── users/
│   │   └── userRepository.ts
│   ├── teachers/
│   │   └── teacherRepository.ts
│   └── base/
│       └── baseRepository.ts  # ✅ Base repository with common operations
│
├── validators/                # Backend-specific validators
│   └── ...
│
├── lib/
│   ├── events/
│   │   ├── eventEmitter.ts   # ✅ Event system
│   │   ├── eventTypes.ts     # ✅ Event type definitions
│   │   └── eventHandlers.ts  # ✅ Event handlers
│   └── ...
│
└── shared/
    └── domain/                # ✅ Shared domain layer
        ├── types/
        │   ├── student.types.ts
        │   ├── user.types.ts
        │   └── ...
        └── validators/
            ├── auth.validators.ts
            └── ...
```

### Frontend Structure

```
frontend/src/
├── pages/                     # Page components
├── components/                # UI components
├── hooks/                     # React hooks
│
├── lib/
│   ├── api.ts                # API client
│   └── ...                   # ❌ Remove duplicate validators
│
└── types/                     # ❌ Remove - use shared/types
```

### Shared Structure

```
shared/
├── domain/                    # ✅ Domain layer
│   ├── types/                 # ✅ Shared types
│   │   ├── student.types.ts
│   │   ├── user.types.ts
│   │   ├── auth.types.ts
│   │   └── index.ts
│   │
│   └── validators/            # ✅ Shared validators
│       ├── auth.validators.ts
│       └── index.ts
│
├── constants/                 # ✅ Shared constants
└── utils/                     # ✅ Shared utilities
```

---

## Module Responsibilities

### Routes Layer

**Responsibility**: HTTP request/response handling, input validation, authentication/authorization

**Rules**:
- ✅ Call services only
- ✅ Handle HTTP status codes
- ✅ Validate input using validators
- ❌ No direct DB access
- ❌ No business logic

**Example**:
```typescript
router.get('/students', async (req, res, next) => {
  try {
    const students = await studentService.listStudents(filters);
    res.json(createSuccessResponse(students));
  } catch (error) {
    next(error);
  }
});
```

### Services Layer

**Responsibility**: Business logic, orchestration, event emission

**Rules**:
- ✅ Use repositories for data access
- ✅ Emit events for async workflows
- ✅ Contain business rules and validation
- ❌ No direct DB access
- ❌ No SQL queries

**Example**:
```typescript
export async function createStudent(input: StudentInput, actorId: string) {
  // Business logic
  const student = await studentRepository.create(input);
  
  // Emit event
  eventEmitter.emit('student.created', { student, actorId });
  
  return student;
}
```

### Repositories Layer

**Responsibility**: Data access, query building, database operations

**Rules**:
- ✅ All DB access happens here
- ✅ Use prepared statements
- ✅ Handle transactions
- ❌ No business logic
- ❌ No event emission

**Example**:
```typescript
export class StudentRepository extends BaseRepository {
  async findById(id: string): Promise<Student | null> {
    const result = await this.client.query(
      `SELECT * FROM ${this.tableName} WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  }
}
```

### Validators Layer

**Responsibility**: Input validation, schema definitions

**Rules**:
- ✅ Shared validators in `shared/domain/validators/`
- ✅ Backend-specific validators in `backend/src/validators/`
- ✅ Use Zod for validation
- ❌ No business logic

### Events Layer

**Responsibility**: Async workflows, decoupled operations

**Rules**:
- ✅ Emit events from services
- ✅ Handle events asynchronously
- ✅ Support event listeners/handlers
- ❌ No direct DB access from handlers

---

## Abstraction Barriers

### Layer 1: Routes → Services

**Barrier**: Routes can only call services, never repositories or DB directly.

**Enforcement**:
- Linter rules to prevent `client.query()` in routes
- TypeScript types to prevent direct repository imports in routes

### Layer 2: Services → Repositories

**Barrier**: Services can only access data through repositories.

**Enforcement**:
- All services receive repositories via dependency injection
- No direct `PoolClient` access in services

### Layer 3: Repositories → Database

**Barrier**: Only repositories access the database.

**Enforcement**:
- All SQL queries in repositories only
- Base repository provides common operations

### Layer 4: Shared Domain

**Barrier**: Shared types and validators used by both frontend and backend.

**Enforcement**:
- Frontend imports from `shared/domain/`
- Backend imports from `shared/domain/`
- No duplication

---

## Migration Strategy

### Phase 1: Foundation ✅ COMPLETED

1. ✅ Create architecture map
2. ✅ Create base repository
3. ✅ Create event emitter system
4. ✅ Move shared types to `shared/domain/types/`
5. ✅ Move shared validators to `shared/domain/validators/`

### Phase 2: Repository Pattern ⏳ IN PROGRESS

1. ⏳ Create repositories for key domains:
   - ✅ StudentRepository
   - ⏳ UserRepository
   - ⏳ TeacherRepository
   - ⏳ ClassRepository
   - ⏳ ExamRepository

2. ⏳ Refactor services to use repositories
   - ✅ StudentService refactored
   - ⏳ UserService (pending)
   - ⏳ TeacherService (pending)

### Phase 3: Event System ✅ COMPLETED (Handlers Pending)

1. ✅ Implement event emitter
2. ✅ Define event types
3. ⏳ Add event handlers (pending)
4. ✅ Emit events from services (StudentService implemented)

### Phase 4: Route Cleanup

1. ⏳ Remove direct DB queries from routes
2. ⏳ Ensure all routes use services only

### Phase 5: Frontend Cleanup

1. ⏳ Remove duplicate validators from frontend
2. ⏳ Use shared types from `shared/domain/`

### Phase 6: Validation & Testing

1. ⏳ Add linter rules for abstraction barriers
2. ⏳ Update tests
3. ⏳ Verify no direct DB access

---

## Naming Conventions

### Files
- **Services**: `{domain}Service.ts` (e.g., `studentService.ts`)
- **Repositories**: `{domain}Repository.ts` (e.g., `studentRepository.ts`)
- **Validators**: `{domain}Validator.ts` (e.g., `studentValidator.ts`)
- **Types**: `{domain}.types.ts` (e.g., `student.types.ts`)
- **Events**: `{domain}Events.ts` (e.g., `studentEvents.ts`)

### Folders
- **Domain modules**: `{domain}/` (e.g., `students/`, `users/`)
- **Shared domain**: `shared/domain/`

### Functions
- **Services**: `verbNoun()` (e.g., `createStudent()`, `listStudents()`)
- **Repositories**: `verbNoun()` (e.g., `findById()`, `create()`)
- **Events**: `{domain}.{action}` (e.g., `student.created`, `user.updated`)

---

## Key Principles

1. **Single Responsibility**: Each layer has one clear responsibility
2. **Dependency Inversion**: High-level modules don't depend on low-level modules
3. **DRY**: No duplication of types, validators, or logic
4. **Abstraction Barriers**: Strict boundaries between layers
5. **Domain-Driven Design**: Organize by domain, not by technical layer

---

## Success Metrics

- ✅ Zero direct DB queries in routes
- ✅ All services use repositories
- ✅ Shared types/validators in `shared/domain/`
- ✅ Event system operational
- ✅ Consistent naming conventions
- ✅ All tests passing
- ✅ Linter rules enforcing barriers

---

*Last Updated: Phase C4 Implementation*

