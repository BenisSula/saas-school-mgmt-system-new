# 4 Student Credentials from Different Schools

**Generated:** 2025-11-18

---

## ⚠️ Important Note About Student Passwords

Student passwords are **randomly generated** during seed execution using this pattern:
```
Stu[First2Letters][Random4Digits]@2025
```

The `[Random4Digits]` is a random number between 1000-9999 generated during seed. Since passwords are stored as hashes in the database, we cannot retrieve the exact passwords without:
1. Checking the seed script console output (if it logged passwords)
2. Resetting passwords via admin panel
3. Re-running the seed script and capturing the summary output

---

## 📚 4 Student Credentials

### 1. New Horizon Senior Secondary School

**Name:** Haddy Sowe  
**Email:** `haddy.sowe1@newhorizon.edu.gm`  
**Password Pattern:** `StuHA[4digits]@2025`  
**Example Format:** `StuHA1234@2025` (replace 1234 with actual random digits)

---

### 2. New Horizon Senior Secondary School

**Name:** Lamin Camara  
**Email:** `lamin.camara2@newhorizon.edu.gm`  
**Password Pattern:** `StuLA[4digits]@2025`  
**Example Format:** `StuLA5678@2025` (replace 5678 with actual random digits)

---

### 3. St. Peter's Senior Secondary School

**Name:** Buba Sowe  
**Email:** `buba.sowe@stpeterslamin.edu.gm`  
**Password Pattern:** `StuBU[4digits]@2025`  
**Example Format:** `StuBU9012@2025` (replace 9012 with actual random digits)

---

### 4. St. Peter's Senior Secondary School

**Name:** Binta Bah  
**Email:** `binta.bah@stpeterslamin.edu.gm`  
**Password Pattern:** `StuBI[4digits]@2025`  
**Example Format:** `StuBI3456@2025` (replace 3456 with actual random digits)

---

## 🔍 How to Get Exact Passwords

### Option 1: Check Seed Script Output
If the seed script was run recently, check the console output for a seed summary that includes `passwordPlain` values.

### Option 2: Reset Passwords
Use the admin panel to reset student passwords to known values.

### Option 3: Re-run Seed Script
Run the seed script again and capture the summary output:
```bash
npm run seed:superuser > seed_output.txt 2>&1
```

The seed script stores passwords in `summary.students[].passwordPlain` which should be logged to console.

### Option 4: Check Seed Summary File
If a seed summary JSON file was created, check for:
- `backend/exports/seed-summary.json`
- `backend/reports/seed-summary.json`
- Any file containing `passwordPlain` for students

---

## 📋 Password Generation Logic

From `backend/src/scripts/seedSuperUserSetup.ts` (line 2118-2120):

```typescript
const passwordPlain = `Stu${firstName.slice(0, 2).toUpperCase()}${Math.floor(
  1000 + Math.random() * 9000
)}@2025`;
```

**Pattern Breakdown:**
- `Stu` - Fixed prefix
- `[First2Letters]` - First 2 letters of first name (uppercase)
- `[Random4Digits]` - Random number between 1000-9999
- `@2025` - Fixed suffix

**Examples:**
- "Haddy Sowe" → `StuHA[random]@2025`
- "Lamin Camara" → `StuLA[random]@2025`
- "Buba Sowe" → `StuBU[random]@2025`
- "Binta Bah" → `StuBI[random]@2025`

---

## 🎯 Quick Reference

| School | Student Name | Email | Password Pattern |
|--------|--------------|-------|------------------|
| New Horizon S.S.S. | Haddy Sowe | `haddy.sowe1@newhorizon.edu.gm` | `StuHA[4digits]@2025` |
| New Horizon S.S.S. | Lamin Camara | `lamin.camara2@newhorizon.edu.gm` | `StuLA[4digits]@2025` |
| St. Peter's S.S.S. | Buba Sowe | `buba.sowe@stpeterslamin.edu.gm` | `StuBU[4digits]@2025` |
| St. Peter's S.S.S. | Binta Bah | `binta.bah@stpeterslamin.edu.gm` | `StuBI[4digits]@2025` |

---

**Note:** To get working credentials, you'll need to either reset the passwords or check the seed script output for the exact random 4-digit numbers.

