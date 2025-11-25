# Quick Credentials Reference

**Last Updated:** 2025-11-18

---

## 🔑 Superusers (Platform Administrators)

| Email | Password | Username |
|-------|----------|----------|
| `owner@saas-platform.system` | `SuperOwner#2025!` | `superuser` |
| `owner.demo@platform.test` | `OwnerDemo#2025` | N/A |

---

## 👑 Admins (School Administrators)

| Name | Email | Password | Username | School |
|------|-------|----------|----------|--------|
| Fatou Jallow | `fatou.jallow@newhorizon.edu.gm` | `NhsAdmin@2025` | `nhs_admin` | New Horizon S.S.S. |
| Lamin Sowe | `lamin.sowe@stpeterslamin.edu.gm` | `StpAdmin@2025` | `stp_admin` | St. Peter's S.S.S. |
| Demo Admin | `admin.demo@academy.test` | `AdminDemo#2025` | N/A | Demo Academy |

**Missing:** Musu Bah (`musu.bah@daddyjobe.edu.gm`) - Daddy Jobe school not created

---

## 🎓 HODs (Heads of Department)

### New Horizon Senior Secondary School

| Name | Email | Password | Username | Department |
|------|-------|----------|----------|------------|
| Alhaji Saine | `alhaji.saine@newhorizon.edu.gm` | `NhsScienceHOD@2025` | `nhs_hod_science` | Science |
| Mariama Camara | `mariama.camara@newhorizon.edu.gm` | `NhsCommerceHOD@2025` | `nhs_hod_commerce` | Commerce |
| Joseph Ceesay | `joseph.ceesay@newhorizon.edu.gm` | `NhsArtsHOD@2025` | `nhs_hod_arts` | Arts |

### St. Peter's Senior Secondary School

| Name | Email | Password | Username | Department |
|------|-------|----------|----------|------------|
| Hassan Njie | `hassan.njie@stpeterslamin.edu.gm` | `StpScienceHOD@2025` | `stp_hod_science` | Science |
| Abdoulie Touray | `abdoulie.touray@stpeterslamin.edu.gm` | `StpCommerceHOD@2025` | `stp_hod_commerce` | Commerce |

**Missing:** Ebrima Sanyang (`ebrima.sanyang@stpeterslamin.edu.gm`) - Arts HOD (user exists, role needs verification)

---

## 👨‍🏫 Teachers (Regular Teachers)

### New Horizon Senior Secondary School

| Name | Email | Password | Username | Subject |
|------|-------|----------|----------|---------|
| Pa Modou Jagne | `pamodou.jagne@newhorizon.edu.gm` | `TeachNHS01@2025` | `nhs_pjagne` | Mathematics |
| Jainaba Ceesay | `jainaba.ceesay@newhorizon.edu.gm` | `TeachNHS02@2025` | `nhs_jceesay` | English |
| Lamin Jammeh | `lamin.jammeh@newhorizon.edu.gm` | `TeachNHS03@2025` | `nhs_ljammeh` | Chemistry |
| Mariama Bah | `mariama.bah@newhorizon.edu.gm` | `TeachNHS04@2025` | `nhs_mbah` | Physics |
| Aisha Touray | `aisha.touray@newhorizon.edu.gm` | `TeachNHS05@2025` | `nhs_atouray` | Religious Study |
| Modou Colley | `modou.colley@newhorizon.edu.gm` | `TeachNHS06@2025` | `nhs_mcolley` | Accounting |
| Fatou Sowe | `fatou.sowe@newhorizon.edu.gm` | `TeachNHS07@2025` | `nhs_fsowe` | Commerce |
| Ebrima Faal | `ebrima.faal@newhorizon.edu.gm` | `TeachNHS08@2025` | `nhs_efaal` | History |
| Haddy Jatta | `haddy.jatta@newhorizon.edu.gm` | `TeachNHS09@2025` | `nhs_hjatta` | Government |

### St. Peter's Senior Secondary School

| Name | Email | Password | Username | Subject |
|------|-------|----------|----------|---------|
| Omar Ceesay | `omar.ceesay@stpeterslamin.edu.gm` | `TeachSTP01@2025` | `stp_oceesay` | Mathematics |
| Mariama Jawara | `mariama.jawara@stpeterslamin.edu.gm` | `TeachSTP02@2025` | `stp_mjawara` | English |
| Sainabou Jallow | `sainabou.jallow@stpeterslamin.edu.gm` | `TeachSTP03@2025` | `stp_sjallow` | Chemistry |
| Musa Touray | `musa.touray@stpeterslamin.edu.gm` | `TeachSTP04@2025` | `stp_mtouray` | Physics |
| Binta Bah | `binta.bah@stpeterslamin.edu.gm` | `TeachSTP05@2025` | `stp_bbah` | Religious Study |
| Ousman Ceesay | `ousman.ceesay@stpeterslamin.edu.gm` | `TeachSTP06@2025` | `stp_oceesay2` | Accounting |
| Isatou Cham | `isatou.cham@stpeterslamin.edu.gm` | `TeachSTP07@2025` | `stp_icham` | Commerce |
| Abdoulie Baldeh | `abdoulie.baldeh@stpeterslamin.edu.gm` | `TeachSTP08@2025` | `stp_abaldeh` | History |
| Haddy Sanyang | `haddy.sanyang@stpeterslamin.edu.gm` | `TeachSTP09@2025` | `stp_hsanyang` | Government |

---

## 👨‍🎓 Students

**Total:** 624 students (all active)

**Password Pattern:** `Stu[First2Letters][Random4Digits]@2025`

**Example:** Student named "Abdoulie Bah" → Password: `StuAB1234@2025`

**Distribution:**
- New Horizon S.S.S.: ~378 students
- St. Peter's S.S.S.: ~244 students
- Demo Academy: 1 student

**Note:** Individual student passwords are generated during seed and not stored in plain text. To retrieve a specific student's password, check seed execution logs or reset the password.

---

## 📊 Database Summary

- **Total Users:** 647
- **Active Users:** 647 (100%)
- **Live Data Users:** 642
- **Demo/Test Users:** 5

### By Role:
- Superusers: 2
- Admins: 3
- HODs: 5
- Teachers: 18+ (includes HODs)
- Students: 624

### By School:
- **Demo Academy:** 3 users (trial subscription)
- **New Horizon S.S.S.:** 388 users (paid subscription)
- **St. Peter's S.S.S.:** ~254 users (paid subscription)
- **Daddy Jobe C.S.S.S.:** 0 users (school not created)

---

## ⚠️ Important Notes

1. **Daddy Jobe School:** The tenant for Daddy Jobe Comprehensive Senior Secondary School was not created. Run `npm run seed:superuser` to create it.

2. **Missing Users:** Some expected users from seed data are not in the database:
   - 1 Admin (Daddy Jobe)
   - 4 HODs (1 from St. Peter's, 3 from Daddy Jobe)
   - ~186 Students (expected 810, found 624)

3. **Student Passwords:** Student passwords follow a pattern but are generated dynamically. Use the export script to get specific credentials:
   ```bash
   npm run export:user-credentials
   ```

4. **Full Report:** See `backend/USER_CREDENTIALS_REPORT.md` for complete details.

---

**For complete details, see:** `backend/USER_CREDENTIALS_REPORT.md`

