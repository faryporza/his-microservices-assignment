# QA Test Report: Round 1 (Branch: feat/opd-core)

Service: OPD Service (opd-bc)
Port: 3000
Database: opd_db
Date: 2026-07-25

---

## 1. QA Test Scenarios and Results

### Test Case 1.1: Patient Registration (POST /patients)
- Request Body:
  {
    "hn": "HN000001",
    "firstName": "Thanakit",
    "lastName": "Chuchoed",
    "idCard": "1234567890123"
  }
- Expected Status: 201 Created
- Result: PASS
- Output: Auto-generated UUID assigned to patient id field.

### Test Case 1.2: Duplicate HN Prevention (POST /patients)
- Request Body: Duplicate HN "HN000001"
- Expected Status: 409 Conflict
- Result: PASS
- Output: Response returned ConflictException message "HN 'HN000001' already exists".

### Test Case 1.3: Duplicate ID Card Prevention (POST /patients)
- Request Body: Duplicate ID Card "1234567890123"
- Expected Status: 409 Conflict
- Result: PASS
- Output: Response returned ConflictException message "ID Card '1234567890123' already exists".

### Test Case 1.4: Visit Creation (POST /visits)
- Request Body:
  {
    "patientId": "<VALID_PATIENT_UUID>"
  }
- Expected Status: 201 Created
- Result: PASS
- Output: Visit record created with default status "OPEN".

### Test Case 1.5: Non-existent Patient Visit Validation (POST /visits)
- Request Body:
  {
    "patientId": "00000000-0000-0000-0000-000000000000"
  }
- Expected Status: 404 Not Found
- Result: PASS
- Output: Response returned NotFoundException message "Patient with ID '...' not found".

---

## 2. Summary of Fixes (Fix History)

### Fix 1: TypeORM Relations Syntax Compatibility
- Issue: Repository method relations call caused TypeScript TS2559 error with string array format.
- Solution: Updated relations option to object format `{ patient: true }`.

### Fix 2: Strict Property Initialization (ts 2564)
- Issue: TypeORM entity properties reported uninitialized variable warning under strict TypeScript checks.
- Solution: Applied definite assignment assertion operator (`!`) to entity fields (`id!`, `hn!`).

### Fix 3: Global Validation Pipeline Configuration
- Issue: DTO decorators were not validating incoming JSON requests automatically.
- Solution: Added `app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))` in `apps/opd-bc/src/main.ts`.
