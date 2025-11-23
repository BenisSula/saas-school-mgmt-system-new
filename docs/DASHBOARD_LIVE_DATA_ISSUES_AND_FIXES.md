# Dashboard Live Data Issues & Fixes

## 📊 Screenshot Analysis

From the uploaded screenshot, the dashboard shows:
- ✅ **Total Classes: 12** (Working - has data)
- ⚠️ **Total Students: 0** (Fixed - endpoint was missing)
- ⚠️ **Total Teachers: 0** (Needs verification)
- ⚠️ **Total Subjects: 0** (Needs verification)
- ⚠️ **All other stats: 0** (Needs verification)

---

## ✅ Fixes Applied

### 1. Added Missing Students Endpoint ✅

**Problem:** Frontend `api.listStudents()` was calling `GET /students`, but this endpoint didn't exist.

**Fix:** Added `GET /students` endpoint to `backend/src/routes/students.ts`

**Code:**
```typescript
router.get('/', requirePermission('students:manage'), async (req, res, next) => {
  // Lists all students with pagination and filtering
  const allStudents = await listStudents(req.tenantClient, req.tenant.schema, filters);
  // Returns paginated response
});
```

**Impact:**
- ✅ `useStudentStats()` hook can now fetch students
- ✅ Dashboard will show actual student count
- ✅ Student statistics will be accurate

---

### 2. Fixed Student Count in Overview Service ✅

**Problem:** Overview service was counting students from `users` table instead of `students` table.

**Fix:** Changed to count from actual `students` table

**Code:**
```typescript
// Before
students: users.filter((u) => u.role === 'student').length

// After
students: students.length // From actual students table
```

**Impact:**
- ✅ Overview endpoint returns accurate student count
- ✅ Count matches database records

---

## 🔍 Verification Needed

### Endpoints Status:

| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /students` | ✅ **FIXED** | Just added |
| `GET /teachers` | ✅ Exists | Line 46 in `teachers.ts` |
| `GET /admin/subjects` | ✅ Exists | Line 34 in `adminAcademics.ts` |
| `GET /admin/overview` | ✅ Exists | Returns aggregated data |

### Data Flow Check:

1. **Students:**
   - Frontend: `api.listStudents()` → `GET /students` ✅ (now exists)
   - Hook: `useStudentStats()` → calls `api.listStudents()` ✅
   - Display: `studentStats?.total` ✅

2. **Teachers:**
   - Frontend: `api.listTeachers()` → `GET /teachers` ✅ (exists)
   - Hook: `useTeacherStats()` → calls `api.listTeachers()` ✅
   - Display: `teacherStats?.total` ✅

3. **Subjects:**
   - Frontend: `api.admin.listSubjects()` → `GET /admin/subjects` ✅ (exists)
   - Hook: `useSubjectStats()` → calls `api.admin.listSubjects()` ✅
   - Display: `subjectStats?.total` ✅

---

## 🎯 Next Steps

### 1. Refresh Dashboard

**Action:** Hard refresh the browser (Ctrl+F5 or Cmd+Shift+R)

**Expected Result:**
- Students count should update (if students exist in DB)
- Teachers count should update (if teachers exist in DB)
- Subjects count should update (if subjects exist in DB)

### 2. Check Browser Console

**Look for:**
- API errors (red errors)
- Failed network requests
- Console warnings

**Common Issues:**
- 403 Forbidden → Permission issue
- 404 Not Found → Endpoint missing
- 500 Internal Server Error → Backend error
- Network error → CORS or connection issue

### 3. Check Network Tab

**Steps:**
1. Open DevTools → Network tab
2. Refresh dashboard
3. Look for these requests:
   - `GET /students` → Should return 200 with data
   - `GET /teachers` → Should return 200 with data
   - `GET /admin/subjects` → Should return 200 with data
   - `GET /admin/overview` → Should return 200 with data

**Check Response:**
- Status: Should be 200 (OK)
- Response body: Should contain data array
- If empty array `[]`: Data doesn't exist in database (not an error)

### 4. Verify Database Data

**For New Horizon School:**

Run verification script:
```bash
npx ts-node backend/src/scripts/checkNewHorizonStudents.ts
```

**Or check manually:**
```sql
-- Count students
SELECT COUNT(*) FROM tenant_new_horizon_senior_secondary_school.students;

-- Count teachers  
SELECT COUNT(*) FROM tenant_new_horizon_senior_secondary_school.teachers;

-- Count subjects
SELECT COUNT(*) FROM tenant_new_horizon_senior_secondary_school.subjects;
```

---

## 📋 Possible Reasons for Zero Counts

### 1. No Data in Database
- **Students:** No student records created yet
- **Teachers:** No teacher records created yet
- **Subjects:** No subjects created yet

**Solution:** Create data through admin interface or seed script

### 2. Permission Issues
- User doesn't have required permissions
- Check: `students:manage`, `teachers:manage`, etc.

**Solution:** Verify user has admin role with correct permissions

### 3. Tenant Context Issues
- Wrong tenant selected
- Tenant not properly resolved

**Solution:** Check tenant ID in JWT token and request headers

### 4. API Errors
- Backend errors not being caught
- Network/CORS issues

**Solution:** Check browser console and network tab

---

## ✅ Summary

**Fixes Applied:**
1. ✅ Added `GET /students` endpoint
2. ✅ Fixed student count in overview service

**Status:**
- ✅ Students endpoint: **FIXED**
- ✅ Student count calculation: **FIXED**
- ⏳ **Action Required:** Refresh dashboard to see changes

**Expected After Refresh:**
- Students count should show actual number from database
- If still 0, check if data exists in database
- If data exists but shows 0, check browser console for errors

---

**Last Updated:** 2025-01-XX  
**Status:** ✅ Fixes Applied - Ready for Testing

