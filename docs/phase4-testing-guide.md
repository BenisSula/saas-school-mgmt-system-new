# Phase 4 RBAC System Upgrade - Testing Guide

**Date:** 2025-01-XX  
**Status:** ✅ **READY FOR TESTING**

---

## Build Status

### ✅ Backend Build
- **Status:** ✅ **SUCCESS**
- **Output:** TypeScript compilation successful
- **Errors:** None

### ✅ Frontend Build
- **Status:** ✅ **SUCCESS**
- **Build Time:** ~19.53s
- **Errors:** None (fixed JSX syntax issues)

---

## Testing Checklist

### 4.1 HOD Workflow Testing

#### Frontend Tests
- [ ] **AdminUserRegistrationModal - HOD Role Selection**
  - Navigate to Admin Role Management page
  - Click "Register New User"
  - Verify "Head of Department (HOD)" option appears in role dropdown
  - Select HOD role
  - Verify department dropdown appears and is required
  - Verify department dropdown loads departments from API

- [ ] **Department Dropdown**
  - Select HOD role
  - Verify departments are loaded from `/departments` endpoint
  - Verify dropdown shows department names
  - Verify department selection is required (validation error if not selected)
  - Verify department dropdown disappears when switching to Student/Teacher role

- [ ] **HOD Registration Form**
  - Fill in all required fields for HOD
  - Select a department
  - Submit form
  - Verify success message
  - Verify HOD user is created with `department_id` set

#### Backend Tests
- [ ] **Departments API**
  - Test `GET /departments`
  - Verify returns list of departments for current tenant
  - Verify requires authentication
  - Verify requires `users:manage` permission

- [ ] **HOD User Creation**
  - Test `POST /users/register` with `role: "hod"` and `departmentId`
  - Verify validation: HOD role requires `departmentId`
  - Verify user is created with `department_id` set in `shared.users`
  - Verify teacher profile is created (HODs use teacher profiles)
  - Verify user status is 'active' (admin-created users are immediately active)

- [ ] **HOD Profile Creation**
  - Approve a pending HOD user
  - Verify teacher profile is created in tenant schema
  - Verify `department_id` is set in `shared.users`

### 4.2 Bulk Operations Testing

#### Frontend Tests
- [ ] **Bulk Selection**
  - Navigate to Admin Role Management page
  - Verify "Select All" checkbox appears when there are pending users
  - Click "Select All" - verify all users are selected
  - Click again - verify all users are deselected
  - Select individual users - verify checkboxes work correctly

- [ ] **Bulk Approve**
  - Select multiple pending users
  - Click "Approve Selected (N)" button
  - Verify success message shows number of approved users
  - Verify users are removed from pending list
  - Verify individual approve still works

- [ ] **Bulk Reject**
  - Select multiple pending users
  - Click "Reject Selected (N)" button
  - Verify confirmation dialog appears
  - Confirm rejection
  - Verify success message shows number of rejected users
  - Verify users are removed from pending list
  - Verify individual reject still works

#### Backend Tests
- [ ] **Bulk Approve API**
  - Test `POST /users/bulk-approve` with array of user IDs
  - Verify all users are approved
  - Verify profile records are created for each user
  - Verify response includes success/failure count
  - Verify partial failures are handled gracefully

- [ ] **Bulk Reject API**
  - Test `POST /users/bulk-reject` with array of user IDs
  - Verify all users are rejected
  - Verify pending profile data is cleaned up
  - Verify response includes success/failure count

### 4.3 Sorting & Filtering Testing

#### Frontend Tests
- [ ] **Search Functionality**
  - Enter search query in search box
  - Verify users are filtered by email or name
  - Verify search is case-insensitive
  - Clear search - verify all users are shown

- [ ] **Role Filter**
  - Select "Student" filter - verify only students shown
  - Select "Teacher" filter - verify only teachers shown
  - Select "HOD" filter - verify only HODs shown
  - Select "All Roles" - verify all users shown

- [ ] **Sorting**
  - Sort by "Date" (descending) - verify newest first
  - Sort by "Date" (ascending) - verify oldest first
  - Sort by "Role" - verify alphabetical by role
  - Sort by "Email" - verify alphabetical by email
  - Verify sort order persists when filtering

- [ ] **Combined Filters**
  - Apply search + role filter + sorting together
  - Verify all filters work correctly together
  - Verify "Select All" only selects filtered users

### 4.4 Integration Tests

- [ ] **End-to-End HOD Workflow**
  1. Admin creates HOD user with department
  2. Verify HOD user appears in users list
  3. Verify HOD user can log in
  4. Verify HOD has correct permissions
  5. Verify HOD sees department-specific data

- [ ] **End-to-End Bulk Approval**
  1. Create multiple pending users (students, teachers, HODs)
  2. Use bulk approve to approve all
  3. Verify all profiles are created
  4. Verify all users can log in

- [ ] **Error Handling**
  - Test with invalid department ID
  - Test with missing required fields
  - Test with network errors
  - Verify error messages are user-friendly

---

## API Endpoints to Test

### New Endpoints
- `GET /departments` - List departments for tenant
- `POST /users/bulk-approve` - Bulk approve users
- `POST /users/bulk-reject` - Bulk reject users

### Modified Endpoints
- `POST /users/register` - Now accepts `role: "hod"` and `departmentId`
- `PATCH /users/:userId/approve` - Now handles HOD profile creation

---

## Test Data Setup

### Prerequisites
1. Ensure tenant has at least one school created
2. Ensure tenant has at least one department created
3. Ensure admin user is logged in

### Sample Test Data
```javascript
// HOD Registration
{
  email: "hod.test@school.edu",
  password: "SecurePass123!",
  role: "hod",
  fullName: "John HOD",
  departmentId: "<department-uuid>",
  phone: "+1234567890",
  qualifications: "M.Sc Mathematics",
  yearsOfExperience: 10,
  subjects: ["mathematics", "physics"]
}
```

---

## Known Issues

None identified at this time.

---

## Next Steps After Testing

1. If issues found, document in GitHub issues
2. If all tests pass, proceed with optional enhancements:
   - Email notifications for approval/rejection
   - Audit logging for approval actions
   - Email verification step for student registration

---

**Status:** ✅ **READY FOR MANUAL TESTING**

