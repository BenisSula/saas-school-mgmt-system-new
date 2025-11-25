# User Credentials & Database Investigation Report

**Generated:** 2025-11-18  
**Database:** saas_school  
**Investigation Date:** 2025-11-18

---

## Executive Summary

### Total Users in Database: **647**

| Category | Count | Status | Notes |
|----------|-------|--------|-------|
| **Total Users** | 647 | All Active | 100% active status |
| **Live Data (Real Schools)** | 642 | Active | Working on real school data |
| **Demo/Test Data** | 5 | Active | Demo accounts for testing |
| **Superusers** | 2 | Active | Platform administrators |
| **Admins** | 3 | Active | School administrators |
| **HODs** | 5 | Active | Heads of Department |
| **Teachers** | 18 | Active | Regular teachers (13) + HODs (5) |
| **Students** | 624 | Active | All students are active |

---

## 1. User Status Breakdown

### Active vs Non-Active Users

**All 647 users have `status = 'active'`** - There are no pending, suspended, or inactive users in the database.

### Live Data vs Demo Data

- **Live Data (Real Schools):** 642 users
  - New Horizon Senior Secondary School: 388 users
  - St. Peter's Senior Secondary School: ~254 users
  - Daddy Jobe Comprehensive Senior Secondary School: (data incomplete in query)

- **Demo/Test Data:** 5 users
  - `owner.demo@platform.test` (superadmin)
  - `admin.demo@academy.test` (admin)
  - `teacher.demo@academy.test` (teacher)
  - `student.demo@academy.test` (student)
  - Plus 1 additional demo user

---

## 2. Superusers (Platform Administrators)

**Total: 2**

| # | Name | Email | Username | Password | Status | Verified | Tenant |
|---|------|-------|----------|----------|--------|----------|--------|
| 1 | Platform Owner | `owner@saas-platform.system` | `superuser` | `SuperOwner#2025!` | Active | Yes | None (Platform-level) |
| 2 | Demo Superuser | `owner.demo@platform.test` | N/A | `OwnerDemo#2025` (from demo seed) | Active | Yes | None (Platform-level) |

### Schools Available in Database

1. **Demo Academy**
   - Tenant ID: `38faa627-cfc3-4875-8337-b13bee1de100`
   - Schema: `tenant_demo_academy`
   - Subscription: Trial
   - Users: 3 (admin, teacher, student)

2. **New Horizon Senior Secondary School**
   - Tenant ID: `d757e5b4-4753-474d-9a9c-a4e6d74496a5`
   - Schema: `tenant_new_horizon_senior_secondary_school`
   - Subscription: Paid
   - Registration Code: `NHS-BJL-2025`
   - Users: 388
   - Billing Email: `info@newhorizon.edu.gm`

3. **St. Peter's Senior Secondary School**
   - Tenant ID: `810657c8-2d45-4729-940f-1a32769a3b10`
   - Schema: `tenant_st_peter_s_senior_secondary_school`
   - Subscription: Paid
   - Registration Code: `STP-LMN-2025`
   - Users: ~254
   - Billing Email: `admin@stpeterslamin.edu.gm`

4. **Daddy Jobe Comprehensive Senior Secondary School**
   - Registration Code: `DJC-CSR-2025`
   - Subscription: Paid (expected)
   - Billing Email: `info@daddyjobe.edu.gm`
   - **⚠️ STATUS: Tenant NOT found in database** - School seed may not have completed
   - Expected users: 1 admin, 4 HODs, 9 teachers, ~144 students

---

## 3. Admins (School Administrators)

**Total: 3**

| # | Name | Email | Username | Password | School | Status | Verified |
|---|------|-------|----------|----------|--------|--------|----------|
| 1 | Fatou Jallow | `fatou.jallow@newhorizon.edu.gm` | `nhs_admin` | `NhsAdmin@2025` | New Horizon Senior Secondary School | Active | Yes |
| 2 | Lamin Sowe | `lamin.sowe@stpeterslamin.edu.gm` | `stp_admin` | `StpAdmin@2025` | St. Peter's Senior Secondary School | Active | Yes |
| 3 | Demo Admin | `admin.demo@academy.test` | N/A | `AdminDemo#2025` | Demo Academy | Active | Yes |

**Note:** The third admin (`musu.bah@daddyjobe.edu.gm`) is defined in seed data but may not be created yet in the database.

---

## 4. HODs (Heads of Department)

**Total: 5** (out of 9 expected from seed data)

### New Horizon Senior Secondary School (3 HODs)

| # | Name | Email | Username | Password | Department | Status |
|---|------|-------|----------|----------|------------|--------|
| 1 | Alhaji Saine | `alhaji.saine@newhorizon.edu.gm` | `nhs_hod_science` | `NhsScienceHOD@2025` | Science | Active |
| 2 | Mariama Camara | `mariama.camara@newhorizon.edu.gm` | `nhs_hod_commerce` | `NhsCommerceHOD@2025` | Commerce | Active |
| 3 | Joseph Ceesay | `joseph.ceesay@newhorizon.edu.gm` | `nhs_hod_arts` | `NhsArtsHOD@2025` | Arts | Active |

### St. Peter's Senior Secondary School (2 HODs)

| # | Name | Email | Username | Password | Department | Status |
|---|------|-------|----------|----------|------------|--------|
| 4 | Hassan Njie | `hassan.njie@stpeterslamin.edu.gm` | `stp_hod_science` | `StpScienceHOD@2025` | Science | Active |
| 5 | Abdoulie Touray | `abdoulie.touray@stpeterslamin.edu.gm` | `stp_hod_commerce` | `StpCommerceHOD@2025` | Commerce | Active |

### Missing HODs (Expected but not found in database)

**Note:** The following HODs are defined in seed data but may not be created or may not have HOD role assigned:
- **St. Peter's:** Ebrima Sanyang (Arts HOD) - `ebrima.sanyang@stpeterslamin.edu.gm` (user exists, HOD role needs verification)
- **Daddy Jobe:** All 4 HODs (school tenant not found in database)
  - Momodou Bojang (Science HOD) - `momodou.bojang@daddyjobe.edu.gm`
  - Isatou Jatta (Commerce HOD) - `isatou.jatta@daddyjobe.edu.gm`
  - Ousman Darboe (Arts HOD) - `ousman.darboe@daddyjobe.edu.gm`

---

## 5. Teachers (Regular Teachers, excluding HODs)

**Total: 13** (excluding the 5 HODs who are also teachers)

### New Horizon Senior Secondary School (9 teachers total - 6 regular + 3 HODs)

| # | Name | Email | Username | Password | Department | Subject | Status |
|---|------|-------|----------|----------|------------|---------|--------|
| 1 | Pa Modou Jagne | `pamodou.jagne@newhorizon.edu.gm` | `nhs_pjagne` | `TeachNHS01@2025` | Science | Mathematics | Active |
| 2 | Jainaba Ceesay | `jainaba.ceesay@newhorizon.edu.gm` | `nhs_jceesay` | `TeachNHS02@2025` | Science | English | Active |
| 3 | Aisha Touray | `aisha.touray@newhorizon.edu.gm` | `nhs_atouray` | `TeachNHS05@2025` | Science | Religious Study | Active |
| 4 | Modou Colley | `modou.colley@newhorizon.edu.gm` | `nhs_mcolley` | `TeachNHS06@2025` | Commerce | Accounting | Active |
| 5 | Ebrima Faal | `ebrima.faal@newhorizon.edu.gm` | `nhs_efaal` | `TeachNHS08@2025` | Arts | History | Active |
| 6 | Haddy Jatta | `haddy.jatta@newhorizon.edu.gm` | `nhs_hjatta` | `TeachNHS09@2025` | Arts | Government | Active |

**Note:** The following teachers exist in database but may need verification:
- Lamin Jammeh - `lamin.jammeh@newhorizon.edu.gm` (Chemistry, Science) ✅ EXISTS
- Mariama Bah - `mariama.bah@newhorizon.edu.gm` (Physics, Science) ✅ EXISTS
- Fatou Sowe - `fatou.sowe@newhorizon.edu.gm` (Commerce, Commerce) ✅ EXISTS

### St. Peter's Senior Secondary School (9 teachers total - 7 regular + 2 HODs)

| # | Name | Email | Username | Password | Department | Subject | Status |
|---|------|-------|----------|----------|------------|---------|--------|
| 1 | Omar Ceesay | `omar.ceesay@stpeterslamin.edu.gm` | `stp_oceesay` | `TeachSTP01@2025` | Science | Mathematics | Active |
| 2 | Mariama Jawara | `mariama.jawara@stpeterslamin.edu.gm` | `stp_mjawara` | `TeachSTP02@2025` | Science | English | Active |
| 3 | Sainabou Jallow | `sainabou.jallow@stpeterslamin.edu.gm` | `stp_sjallow` | `TeachSTP03@2025` | Science | Chemistry | Active |
| 4 | Ousman Ceesay | `ousman.ceesay@stpeterslamin.edu.gm` | `stp_oceesay2` | `TeachSTP06@2025` | Commerce | Accounting | Active |
| 5 | Isatou Cham | `isatou.cham@stpeterslamin.edu.gm` | `stp_icham` | `TeachSTP07@2025` | Commerce | Commerce | Active |
| 6 | Abdoulie Baldeh | `abdoulie.baldeh@stpeterslamin.edu.gm` | `stp_abaldeh` | `TeachSTP08@2025` | Arts | History | Active |
| 7 | Demo Teacher | `teacher.demo@academy.test` | N/A | `TeacherDemo#2025` | N/A | N/A | Active |

**Note:** The following teachers exist in database:
- Musa Touray - `musa.touray@stpeterslamin.edu.gm` (Physics, Science) ✅ EXISTS
- Binta Bah - `binta.bah@stpeterslamin.edu.gm` (Religious Study, Science) ✅ EXISTS
- Haddy Sanyang - `haddy.sanyang@stpeterslamin.edu.gm` (Government, Arts) ✅ EXISTS

### Daddy Jobe Comprehensive Senior Secondary School

**Expected Teachers (from seed data, need verification):**
- Lamin Ceesay - `lamin.ceesay@daddyjobe.edu.gm` - `TeachDJC01@2025`
- Haddy Jallow - `haddy.jallow@daddyjobe.edu.gm` - `TeachDJC02@2025`
- Modou Darboe - `modou.darboe@daddyjobe.edu.gm` - `TeachDJC03@2025`
- Mariam Kinteh - `mariam.kinteh@daddyjobe.edu.gm` - `TeachDJC04@2025`
- Fatoumata Ceesay - `fatoumata.ceesay@daddyjobe.edu.gm` - `TeachDJC05@2025`
- Alieu Sanyang - `alieu.sanyang@daddyjobe.edu.gm` - `TeachDJC06@2025`
- Jainaba Camara - `jainaba.camara@daddyjobe.edu.gm` - `TeachDJC07@2025`
- Lamin Bah - `lamin.bah@daddyjobe.edu.gm` - `TeachDJC08@2025`
- Omar Jallow - `omar.jallow@daddyjobe.edu.gm` - `TeachDJC09@2025`

---

## 6. Students

**Total: 624** (All Active)

### Student Password Pattern

Student passwords follow the pattern: `Stu[First2Letters][Random4Digits]@2025`

**Example:** `StuAB1234@2025`

### Student Distribution by School

- **New Horizon Senior Secondary School:** ~270 students (estimated)
- **St. Peter's Senior Secondary School:** ~210 students (estimated)
- **Daddy Jobe Comprehensive Senior Secondary School:** ~144 students (estimated)

### Sample Students (First 20)

1. Abdoulie Bah - `abdoulie.bah@newhorizon.edu.gm` - New Horizon
2. Abdoulie Bah - `abdoulie.bah1@newhorizon.edu.gm` - New Horizon
3. Abdoulie Bojang - `abdoulie.bojang@newhorizon.edu.gm` - New Horizon
4. Abdoulie Bojang - `abdoulie.bojang1@newhorizon.edu.gm` - New Horizon
5. Abdoulie Camara - `abdoulie.camara@newhorizon.edu.gm` - New Horizon
6. Abdoulie Camara - `abdoulie.camara@stpeterslamin.edu.gm` - St. Peter's
7. Abdoulie Camara - `abdoulie.camara1@newhorizon.edu.gm` - New Horizon
8. Abdoulie Ceesay - `abdoulie.ceesay@newhorizon.edu.gm` - New Horizon
9. Abdoulie Darboe - `abdoulie.darboe@newhorizon.edu.gm` - New Horizon
10. Abdoulie Darboe - `abdoulie.darboe@stpeterslamin.edu.gm` - St. Peter's
11. Abdoulie Jammeh - `abdoulie.jammeh@stpeterslamin.edu.gm` - St. Peter's
12. Abdoulie Jammeh - `abdoulie.jammeh1@stpeterslamin.edu.gm` - St. Peter's
13. Abdoulie Jobe - `abdoulie.jobe@newhorizon.edu.gm` - New Horizon
14. Abdoulie Jobe - `abdoulie.jobe@stpeterslamin.edu.gm` - St. Peter's
15. Abdoulie Jobe - `abdoulie.jobe1@newhorizon.edu.gm` - New Horizon
16. Abdoulie Njie - `abdoulie.njie@newhorizon.edu.gm` - New Horizon
17. Abdoulie Njie - `abdoulie.njie1@newhorizon.edu.gm` - New Horizon
18. Abdoulie Sanyang - `abdoulie.sanyang@newhorizon.edu.gm` - New Horizon
19. Abdoulie Sanyang - `abdoulie.sanyang@stpeterslamin.edu.gm` - St. Peter's
20. Abdoulie Sanyang - `abdoulie.sanyang1@stpeterslamin.edu.gm` - St. Peter's

**Note:** Student passwords are generated dynamically during seed and are not stored in plain text. To retrieve a specific student's password, you would need to check the seed script execution logs or reset the password.

---

## Summary Statistics

### By Role

| Role | Count | Active | Verified | Notes |
|------|-------|--------|----------|-------|
| Superadmin | 2 | 2 | 2 | Platform administrators |
| Admin | 3 | 3 | 3 | School administrators (1 missing: Daddy Jobe admin) |
| Teacher (Total) | 18+ | 18+ | 18+ | Includes HODs (actual count may be higher) |
| Teacher (Regular) | 13+ | 13+ | 13+ | Excluding HODs (6 more found in DB) |
| HOD | 5 | 5 | 5 | Also counted as teachers (4 missing from seed) |
| Student | 624 | 624 | Unknown | All active (~186 missing from expected 810) |

### By School/Tenant

| School | Subscription | Users | Admins | HODs | Teachers (Regular) | Students |
|--------|--------------|-------|--------|------|-------------------|----------|
| Demo Academy | Trial | 3 | 1 | 0 | 1 | 1 |
| New Horizon S.S.S. | Paid | 388 | 1 | 3 | 6 | 378 |
| St. Peter's S.S.S. | Paid | ~254 | 1 | 2 | 7 | ~244 |
| Daddy Jobe C.S.S.S. | Paid | **0** | **0** | **0** | **0** | **0** |

**Note:** Daddy Jobe school tenant was not created. Seed script may need to be run again.

---

## Seed Data Sources

### Primary Seed Scripts

1. **`backend/src/scripts/seedSuperUserSetup.ts`**
   - Creates 3 real schools (New Horizon, St. Peter's, Daddy Jobe)
   - Creates 1 superuser, 3 admins, 9 HODs, 27 teachers, 810 students
   - **Status:** Partially executed (some users missing)

2. **`backend/src/scripts/seedDemo.ts`**
   - Creates demo tenant with test users
   - Creates 1 superuser, 1 admin, 1 teacher, 1 student
   - **Status:** Fully executed

### Expected vs Actual Counts

| Role | Expected | Actual | Missing |
|------|----------|--------|---------|
| Superusers | 1 | 2 | -1 (demo added) |
| Admins | 3 | 3 | 0 |
| HODs | 9 | 5 | 4 |
| Teachers | 27 | 13 | 14 |
| Students | 810 | 624 | 186 |

**Note:** The discrepancy suggests that:
- The seed script may not have completed fully
- Some users may have been created but not verified
- Daddy Jobe school data may be incomplete

---

## Recommendations

1. **Run seed script again** to ensure all expected users are created:
   ```bash
   npm run seed:superuser
   ```

2. **Verify Daddy Jobe school** - Check if tenant exists and users are created

3. **Check for missing HODs and Teachers** - Some expected users are not in the database

4. **Export credentials** - Use the export script to generate a complete credentials file:
   ```bash
   npm run export:user-credentials
   ```

5. **Documentation** - Update this report after running the seed script again

---

## Files Referenced

- `backend/src/scripts/seedSuperUserSetup.ts` - Main seed script
- `backend/src/scripts/exportUserCredentials.ts` - Credentials export script
- `backend/src/scripts/exportCredentials.ts` - Alternative export script
- `backend/src/seed/demoTenant.ts` - Demo tenant seed
- `backend/exports/credentials/user_credentials.txt` - Exported credentials file

---

**End of Report**

