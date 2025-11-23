# E2E Tests with Playwright

This directory contains end-to-end tests for the frontend application using Playwright.

## Prerequisites

1. **Backend must be running** on `http://localhost:3001` (or configure `VITE_API_BASE_URL`)
2. **Frontend dev server** will be started automatically by Playwright
3. **Test credentials** must exist in the database (see below)

## Test Credentials

The tests use the following demo credentials (from README.md):

- **SuperUser:** `owner.demo@platform.test` / `OwnerDemo#2025`
- **Admin:** `admin.demo@academy.test` / `AdminDemo#2025`
- **Teacher:** `teacher.demo@academy.test` / `TeacherDemo#2025`
- **Student:** `student.demo@academy.test` / `StudentDemo#2025`

**Note:** If these credentials don't exist, tests will gracefully skip after login failures.

## Running Tests

```bash
# Run all e2e tests
npm run test:e2e

# Run tests in UI mode (interactive)
npm run test:e2e:ui

# Run tests in headed mode (see browser)
npm run test:e2e:headed

# Run specific test file
npx playwright test e2e/superuser-security.spec.ts

# Run tests matching a pattern
npx playwright test --grep "SuperUser"
```

## Test Scenarios

### 1. SuperUser Create School (`superuser-create-school.spec.ts`)
- SuperUser logs in
- Navigates to school management
- Creates a new school
- Verifies school appears in list

### 2. Admin Approve Teacher (`admin-approve-teacher.spec.ts`)
- Admin logs in
- Navigates to user management
- Finds pending teacher
- Approves teacher
- Teacher can login

### 3. Teacher Grade Entry (`teacher-grade-student.spec.ts`)
- Teacher logs in
- Navigates to grade entry
- Enters grade for student
- Student logs in
- Student sees grade

### 4. SuperUser Security (`superuser-security.spec.ts`) - **NEW**
Comprehensive security and access control tests:

#### SuperUser Login & Authentication
- ✅ SuperUser can login successfully
- ✅ SuperUser login with invalid credentials fails

#### SuperUser Login History
- ✅ SuperUser can view login history for a user
- ✅ SuperUser can filter login history by tenant

#### SuperUser Password Management
- ✅ SuperUser can reset user password
- ✅ SuperUser password reset requires confirmation

#### SuperUser Session Management
- ✅ SuperUser can view active sessions
- ✅ SuperUser can revoke a user session
- ✅ SuperUser can revoke all sessions for a user

#### Access Control Boundaries
- ✅ Admin cannot access SuperUser endpoints
- ✅ Admin cannot access SuperUser API endpoints
- ✅ Teacher cannot access SuperUser endpoints
- ✅ Student cannot access SuperUser endpoints

#### Privilege Escalation Prevention
- ✅ Admin cannot reset passwords via SuperUser endpoint
- ✅ Admin cannot view login history via SuperUser endpoint
- ✅ Admin cannot revoke sessions via SuperUser endpoint
- ✅ Unauthenticated user cannot access SuperUser endpoints

#### Tenant Isolation Enforcement
- ✅ SuperUser can view cross-tenant data
- ✅ Admin can only view their tenant data
- ✅ SuperUser can switch between tenants

#### API Response Status Codes
- ✅ Unauthorized requests return 401
- ✅ Forbidden requests return 403
- ✅ SuperUser requests return 200

#### Session Security
- ✅ Logout clears SuperUser session
- ✅ Expired session redirects to login

## Configuration

Tests are configured in `playwright.config.ts`:
- Base URL: `http://localhost:5173` (frontend dev server)
- Browser: Chromium
- Auto-starts dev server before tests
- Screenshots on failure
- HTML report generated

## Test Structure

Each test file follows this pattern:

```typescript
test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: login, navigate, etc.
  });

  test('Test description', async ({ page }) => {
    // Test steps
    // Assertions
  });
});
```

## Helper Functions

Common helper functions are defined in `superuser-security.spec.ts`:

- `loginAs(page, email, password)` - Login as a user
- `logout(page)` - Logout and clear session
- `checkApiResponse(page, urlPattern, expectedStatus)` - Check API response status

## Troubleshooting

### Tests fail with "Login failed"
- Ensure backend is running
- Verify test credentials exist in database
- Check `VITE_API_BASE_URL` environment variable

### Tests timeout waiting for navigation
- Check if backend is responding
- Verify API endpoints are accessible
- Check browser console for errors

### Tests can't find elements
- Page structure may have changed
- Check selectors in test files
- Use Playwright's codegen: `npx playwright codegen http://localhost:5173`

### Tests skip unexpectedly
- Check if test credentials exist
- Verify backend is running
- Check test logs for skip reasons

## CI/CD Integration

For CI environments:
- Set `CI=true` environment variable
- Tests will retry twice on failure
- Use single worker to avoid race conditions
- Ensure backend is available in CI environment

## Writing New Tests

When adding new E2E tests:

1. **Follow existing patterns** - Use helper functions from existing tests
2. **Handle missing credentials gracefully** - Use `test.skip()` if login fails
3. **Use descriptive test names** - Make it clear what is being tested
4. **Add appropriate timeouts** - Account for network delays
5. **Verify both UI and API** - Check UI state and API responses
6. **Test error cases** - Verify error handling and security boundaries

## Security Testing Guidelines

When testing security features:

1. **Test access control** - Verify unauthorized users cannot access protected endpoints
2. **Test privilege escalation** - Ensure lower-privilege users cannot perform high-privilege actions
3. **Test tenant isolation** - Verify users can only access their tenant's data
4. **Test session management** - Verify logout and session expiration work correctly
5. **Test API responses** - Verify correct HTTP status codes (401, 403, 200)
