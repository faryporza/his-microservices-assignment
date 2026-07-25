# QA Test Report: OPD Service and EMR Service

Date: 2026-07-26
Branch: feat/emr-core
Environment: Local Development (PostgreSQL 16, NestJS Monorepo)

---

## 1. OPD Service Audit (Port 3000, Database: opd_db)

### Test 1.1: Patient Registration (POST /patients)
- Request Method: POST
- Endpoint: http://localhost:3000/patients
- Request Body:
  {
    "hn": "HN-QA-1784999718",
    "firstName": "QA_First",
    "lastName": "QA_Last",
    "idCard": "ID-QA-1784999718"
  }
- Expected Status: 201 Created
- Result: PASS
- Response Payload:
  {
    "id": "ca42e4d4-3859-4ba6-96f6-de6eec0942e3",
    "hn": "HN-QA-1784999718",
    "firstName": "QA_First",
    "lastName": "QA_Last",
    "idCard": "ID-QA-1784999718",
    "createdAt": "2026-07-25T10:15:18.141Z",
    "updatedAt": "2026-07-25T10:15:18.141Z"
  }

### Test 1.2: Duplicate HN Validation (POST /patients)
- Request Method: POST
- Endpoint: http://localhost:3000/patients
- Request Body: Duplicate HN "HN-QA-1784999718"
- Expected Status: 409 Conflict
- Result: PASS
- Response Payload:
  {
    "statusCode": 409,
    "message": "HN 'HN-QA-1784999718' already exists",
    "error": "Conflict"
  }

### Test 1.3: Visit Creation (POST /visits)
- Request Method: POST
- Endpoint: http://localhost:3000/visits
- Request Body:
  {
    "patientId": "ca42e4d4-3859-4ba6-96f6-de6eec0942e3"
  }
- Expected Status: 201 Created
- Result: PASS
- Response Payload:
  {
    "id": "84f89c3f-5716-438d-8b57-fe91a8b74f3f",
    "patientId": "ca42e4d4-3859-4ba6-96f6-de6eec0942e3",
    "visitDate": "2026-07-25T10:15:18.181Z",
    "status": "OPEN"
  }

---

## 2. EMR Service Audit (Port 3001, Database: emr_db)

### Test 2.1: Medical Record Creation (POST /records)
- Request Method: POST
- Endpoint: http://localhost:3001/records
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
- Response Payload:
  {
    "id": "58ff3d91-b8dc-4574-8da1-01ee7bd29b48",
    "visitId": "84f89c3f-5716-438d-8b57-fe91a8b74f3f",
    "patientId": "ca42e4d4-3859-4ba6-96f6-de6eec0942e3",
    "diagnosis": "Common Cold & Fever",
    "treatmentNote": "Prescribed Paracetamol 500mg",
    "doctorId": "DOC-99",
    "treatmentCost": 450.5,
    "status": "COMPLETED",
    "createdAt": "2026-07-25T10:15:18.207Z",
    "updatedAt": "2026-07-25T10:15:18.207Z"
  }

### Test 2.2: Negative Treatment Cost Validation (POST /records)
- Request Method: POST
- Endpoint: http://localhost:3001/records
- Request Body: treatmentCost = -100
- Expected Status: 400 Bad Request
- Result: PASS
- Response Payload:
  {
    "statusCode": 400,
    "message": ["treatmentCost cannot be negative"],
    "error": "Bad Request"
  }

### Test 2.3: Query Medical Record by Visit ID (GET /records/visit/:visitId)
- Request Method: GET
- Endpoint: http://localhost:3001/records/visit/84f89c3f-5716-438d-8b57-fe91a8b74f3f
- Expected Status: 200 OK
- Result: PASS

---

## 3. Database Isolation Audit

- Service opd-bc connects exclusively to opd_db.
- Service emr-bc connects exclusively to emr_db.
- No cross-database joins or cross-database foreign key constraints exist.
- Scalar references (visit_id, patient_id) are used for cross-service identifiers.

---

## Summary Result

Overall QA Audit Result: 100% PASSED
