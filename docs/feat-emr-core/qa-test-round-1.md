# QA Test Report: Round 1 (Branch: feat/emr-core)

Service: EMR Service (emr-bc)
Port: 3001
Database: emr_db
Date: 2026-07-26

---

## 1. QA Test Scenarios and Results

### Test Case 1.1: Database Connection Setup (emr_db)
- Component: EmrBcModule
- Target: PostgreSQL emr_db on Port 5432
- Expected Result: Database connection succeeds asynchronously using ConfigService.
- Result: PASS

### Test Case 1.2: Medical Record Creation (POST /records)
- Request Body:
  {
    "visitId": "84f89c3f-5716-438d-8b57-fe91a8b74f3f",
    "patientId": "ca42e4d4-3859-4ba6-96f6-de6eec0942e3",
    "doctorId": "DOC-99",
    "diagnosis": "Common Cold & Fever",
    "treatmentNote": "Prescribed Paracetamol 500mg",
    "treatmentCost": 450.50
  }
- Expected Status: 201 Created
- Result: PASS
- Output: MedicalRecord saved to emr_db with status "COMPLETED".

### Test Case 1.3: Negative Treatment Cost Validation (POST /records)
- Request Body:
  {
    "visitId": "84f89c3f-5716-438d-8b57-fe91a8b74f3f",
    "doctorId": "DOC-99",
    "diagnosis": "Checkup",
    "treatmentCost": -100
  }
- Expected Status: 400 Bad Request
- Result: PASS
- Output: ValidationPipe blocked request with message "treatmentCost cannot be negative".

### Test Case 1.4: Query Record by Visit ID (GET /records/visit/:visitId)
- Endpoint: http://localhost:3001/records/visit/84f89c3f-5716-438d-8b57-fe91a8b74f3f
- Expected Status: 200 OK
- Result: PASS
- Output: Returns matching record list using scalar visitId reference without cross-database JOINs.

---

## 2. Summary of Fixes (Fix History)

### Fix 1: TypeORM Column Data Type Reflection Fix
- Issue: TypeORM threw `DataTypeNotSupportedError: Data type "Object" in "MedicalRecord.patientId"` on startup because TypeScript reflect-metadata inferred `string | null` union type as `Object`.
- Solution: Explicitly declared `{ type: 'varchar', name: 'patient_id', nullable: true }` in `@Column()` decorator.

### Fix 2: Global Validation Pipeline Integration
- Issue: Request body validation decorators in `CreateMedicalRecordDto` were not triggered on incoming requests.
- Solution: Configured `app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))` in `apps/emr-bc/src/main.ts`.

### Fix 3: Jest Global Type Definitions in TypeScript Config (ts 2593)
- Issue: Spec files reported `Cannot find name 'describe' ts(2593)` in IDE.
- Solution: Added `"types": ["jest", "node"]` to `compilerOptions` in `his-project/tsconfig.json`.
