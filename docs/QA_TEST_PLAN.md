# QA Test Plan - Phase 6: Full System User Role Flow Testing

**Date:** 2025-01-XX  
**Version:** 1.0  
**Status:** In Progress

---

## Test Overview

This document outlines comprehensive QA testing for all user role flows across the SaaS School Management System. Each test case will be marked as PASS/FAIL with detailed notes.

---

## 1. SuperUser → Admin Flows

### 1.1 Create School
**Endpoint:** `POST /tenants`  
**Required Role:** SuperUser  
**Test Steps:**
1. Login as SuperUser
2. Create new tenant/school with name, domain, schema
3. Verify tenant is created in database
4. Verify schema is created
5. Verify seed data is populated

**Expected Result:** School created successfully with isolated schema  
**Status:** ⏳ PENDING  
**Notes:**

---

### 1.2 Add Admin
**Endpoint:** `POST /superuser/users` or `POST /auth/signup`  
**Required Role:** SuperUser  
**Test Steps:**
1. Login as SuperUser
2. Create admin user for tenant
3. Assign admin role
4. Verify admin can login
5. Verify admin has correct permissions

**Expected Result:** Admin user created and can access tenant dashboard  
**Status:** ⏳ PENDING  
**Notes:**

---

### 1.3 Suspend School
**Endpoint:** `PATCH /superuser/schools/:id/subscription`  
**Required Role:** SuperUser  
**Test Steps:**
1. Login as SuperUser
2. Get school subscription
3. Update subscription status to 'suspended'
4. Verify school access is blocked
5. Verify admin cannot login

**Expected Result:** School suspended, all access blocked  
**Status:** ⏳ PENDING  
**Notes:**

---

### 1.4 Configure Subscription
**Endpoint:** `PUT /superuser/subscription-tiers`  
**Required Role:** SuperUser  
**Test Steps:**
1. Login as SuperUser
2. Update subscription tier configuration
3. Verify tier limits are updated
4. Verify changes are reflected in subscription

**Expected Result:** Subscription tier configuration updated successfully  
**Status:** ⏳ PENDING  
**Notes:**

---

## 2. Admin → HODs & Teachers Flows

### 2.1 Assign HOD
**Endpoint:** `PUT /admin/users/:id/department`  
**Required Role:** Admin  
**Test Steps:**
1. Login as Admin
2. Create or select user with HOD role
3. Assign department to HOD
4. Verify HOD has department assigned
5. Verify HOD can access department resources

**Expected Result:** HOD assigned to department successfully  
**Status:** ⏳ PENDING  
**Notes:**

---

### 2.2 Assign Teacher to Class
**Endpoint:** `PUT /teachers/:id`  
**Required Role:** Admin  
**Test Steps:**
1. Login as Admin
2. Get teacher by ID
3. Update teacher with assigned_classes
4. Verify teacher is assigned to class
5. Verify teacher can view class students

**Expected Result:** Teacher assigned to class successfully  
**Status:** ⏳ PENDING  
**Notes:**

---

### 2.3 Assign Subjects
**Endpoint:** `PUT /teachers/:id`  
**Required Role:** Admin  
**Test Steps:**
1. Login as Admin
2. Get teacher by ID
3. Update teacher with subjects array
4. Verify subjects are assigned
5. Verify teacher can access subject resources

**Expected Result:** Subjects assigned to teacher successfully  
**Status:** ⏳ PENDING  
**Notes:**

---

### 2.4 Promote Student
**Endpoint:** `POST /students/:id/class-change-request`  
**Required Role:** Admin  
**Test Steps:**
1. Login as Admin
2. Create class change request for student
3. Verify request is created with 'pending' status
4. Approve/reject request (if approval workflow exists)
5. Verify student class is updated

**Expected Result:** Student promotion request created successfully  
**Status:** ⏳ PENDING  
**Notes:**

---

### 2.5 Export Reports
**Endpoint:** `GET /export/*` or `GET /reports/*`  
**Required Role:** Admin  
**Test Steps:**
1. Login as Admin
2. Generate report (students, attendance, grades, etc.)
3. Export report in requested format (PDF, CSV, Excel)
4. Verify report contains correct data
5. Verify report respects tenant isolation

**Expected Result:** Report exported successfully with correct data  
**Status:** ⏳ PENDING  
**Notes:**

---

## 3. Teacher → Students Flows

### 3.1 Mark Attendance
**Endpoint:** `POST /attendance/mark`  
**Required Role:** Teacher  
**Test Steps:**
1. Login as Teacher
2. Select class and date
3. Mark attendance for students (present/absent)
4. Verify attendance is saved
5. Verify attendance appears in reports

**Expected Result:** Attendance marked successfully  
**Status:** ⏳ PENDING  
**Notes:**

---

### 3.2 Enter Grades
**Endpoint:** `POST /grades/bulk`  
**Required Role:** Teacher  
**Test Steps:**
1. Login as Teacher
2. Select exam
3. Enter grades for students
4. Verify grades are saved
5. Verify grades appear in student view

**Expected Result:** Grades entered successfully  
**Status:** ⏳ PENDING  
**Notes:**

---

### 3.3 View Reports
**Endpoint:** `GET /attendance/report/class`, `GET /reports/*`  
**Required Role:** Teacher  
**Test Steps:**
1. Login as Teacher
2. View class attendance report
3. View student performance reports
4. Verify reports show only assigned classes
5. Verify data is accurate

**Expected Result:** Reports displayed correctly with accurate data  
**Status:** ⏳ PENDING  
**Notes:**

---

## Test Execution Summary

| Category | Total Tests | Passed | Failed | Pending |
|----------|-------------|--------|--------|---------|
| SuperUser → Admin | 4 | 0 | 0 | 4 |
| Admin → HODs & Teachers | 5 | 0 | 0 | 5 |
| Teacher → Students | 3 | 0 | 0 | 3 |
| **TOTAL** | **12** | **0** | **0** | **12** |

---

## Issues Found

### Critical Issues
- None yet

### High Priority Issues
- None yet

### Medium Priority Issues
- None yet

### Low Priority Issues
- None yet

---

## Next Steps

1. Execute all test cases
2. Document all results
3. Fix any failed test cases
4. Re-test fixed items
5. Generate final QA report

---

## Notes

- All tests should be performed with proper authentication tokens
- Tenant isolation must be verified in all tests
- Audit logs should be checked for critical operations
- Error handling should be tested for invalid inputs

