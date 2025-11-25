# QA Execution Guide - Phase 6

## Quick Start

### Prerequisites
1. Backend server running on `http://localhost:3001`
2. Database migrations completed
3. Demo accounts seeded (run `npm run demo:seed --prefix backend`)

### Run Automated Tests

```bash
# From project root
npm run qa:test
```

Or manually:
```bash
node scripts/qa-test-runner.js
```

### Manual Testing Checklist

#### 1. SuperUser → Admin Flows

**1.1 Create School**
- [ ] Login as SuperUser (`owner.demo@platform.test` / `OwnerDemo#2025`)
- [ ] Navigate to Schools Management
- [ ] Click "Create New School"
- [ ] Fill in: Name, Domain, Schema Name
- [ ] Submit and verify school is created
- [ ] Verify schema is created in database
- [ ] Verify seed data is populated

**1.2 Add Admin**
- [ ] As SuperUser, navigate to school details
- [ ] Click "Invite Admin" or "Add Admin"
- [ ] Enter admin email and details
- [ ] Send invitation
- [ ] Verify admin receives invitation (check email/logs)
- [ ] Admin accepts invitation and sets password
- [ ] Verify admin can login and access tenant dashboard

**1.3 Suspend School**
- [ ] As SuperUser, navigate to school subscription
- [ ] Click "Suspend School"
- [ ] Confirm suspension
- [ ] Verify subscription status is 'suspended'
- [ ] Attempt to login as admin - should fail
- [ ] Verify all tenant access is blocked

**1.4 Configure Subscription**
- [ ] As SuperUser, navigate to Subscription Tiers
- [ ] Click "Configure Tiers"
- [ ] Update tier settings (prices, limits, features)
- [ ] Save changes
- [ ] Verify changes are reflected in subscription config

#### 2. Admin → HODs & Teachers Flows

**2.1 Assign HOD**
- [ ] Login as Admin (`admin.demo@academy.test` / `AdminDemo#2025`)
- [ ] Navigate to Users Management
- [ ] Find user with HOD role
- [ ] Click "Assign Department"
- [ ] Select department (e.g., "Mathematics")
- [ ] Save
- [ ] Verify HOD has department assigned
- [ ] Verify HOD can access department resources

**2.2 Assign Teacher to Class**
- [ ] As Admin, navigate to Teachers
- [ ] Select a teacher
- [ ] Click "Assign Classes"
- [ ] Select class(es) to assign
- [ ] Save
- [ ] Verify teacher is assigned to class
- [ ] Login as teacher and verify they can see assigned class

**2.3 Assign Subjects**
- [ ] As Admin, navigate to Teachers
- [ ] Select a teacher
- [ ] Click "Assign Subjects"
- [ ] Select subject(s) (e.g., "Mathematics", "Physics")
- [ ] Save
- [ ] Verify subjects are assigned
- [ ] Verify teacher can access subject resources

**2.4 Promote Student**
- [ ] As Admin, navigate to Students
- [ ] Select a student
- [ ] Click "Request Class Change" or "Promote"
- [ ] Select target class
- [ ] Enter reason (optional)
- [ ] Submit
- [ ] Verify class change request is created with 'pending' status
- [ ] Approve request (if approval workflow exists)
- [ ] Verify student class is updated

**2.5 Export Reports**
- [ ] As Admin, navigate to Reports
- [ ] Select report type (Students, Teachers, HODs, Custom)
- [ ] Apply filters if needed
- [ ] Select export format (PDF, Excel, CSV)
- [ ] Click "Export"
- [ ] Verify file downloads
- [ ] Open file and verify data is correct
- [ ] Verify tenant isolation (data from other tenants not included)

#### 3. Teacher → Students Flows

**3.1 Mark Attendance**
- [ ] Login as Teacher (`teacher.demo@academy.test` / `TeacherDemo#2025`)
- [ ] Navigate to Attendance
- [ ] Select class and date
- [ ] View class roster
- [ ] Mark students as Present/Absent
- [ ] Add reason for absent students (if required)
- [ ] Save attendance
- [ ] Verify attendance is saved
- [ ] Navigate to attendance report and verify entries appear

**3.2 Enter Grades**
- [ ] As Teacher, navigate to Exams/Grades
- [ ] Select an exam
- [ ] Click "Enter Grades" or "Bulk Grade Entry"
- [ ] Enter grades for students
- [ ] Save grades
- [ ] Verify grades are saved
- [ ] Login as student and verify grades are visible (if published)

**3.3 View Reports**
- [ ] As Teacher, navigate to Reports
- [ ] View "Class Attendance Report"
- [ ] Verify report shows only assigned classes
- [ ] View "Student Performance Report"
- [ ] Verify data is accurate
- [ ] Verify reports respect teacher's class assignments

## Testing Tips

1. **Use Browser DevTools**: Monitor network requests to verify API calls
2. **Check Console**: Look for JavaScript errors
3. **Verify Database**: Check database directly to verify data persistence
4. **Test Edge Cases**: 
   - Invalid inputs
   - Missing permissions
   - Non-existent resources
   - Concurrent operations
5. **Verify Audit Logs**: Check that critical operations are logged
6. **Test Tenant Isolation**: Verify users can't access other tenant's data

## Common Issues to Watch For

- **Authentication Errors**: Token expiration, invalid tokens
- **Permission Errors**: Users accessing resources they shouldn't
- **Tenant Isolation**: Data leaking between tenants
- **Validation Errors**: Invalid data being accepted
- **Database Errors**: Transactions failing, constraints violated
- **Performance Issues**: Slow responses, timeouts

## Reporting Issues

When reporting issues, include:
1. Test case number and name
2. Steps to reproduce
3. Expected behavior
4. Actual behavior
5. Screenshots/error messages
6. Browser/OS information
7. Network request details (if applicable)

