# Risk-Based QA Strategy and Test Plan (docs/qa-plan.md)

**Project:** Hospital Information System (HIS) Microservices  
**Architecture:** NestJS Monorepo, Database-per-Service (PostgreSQL), Event-Driven Messaging (RabbitMQ)  
**Date:** 26 July 2026  
**Author:** Senior QA Engineer (Antigravity AI Agent)  

---

## 1. System Overview and Component Mapping

### 1.1 Microservices Architecture & Microservice Responsibilities
1. **opd-bc (Outpatient Department Service - Port 3000)**
   - Database: `opd_db`
   - Responsibilities: Patient registration, managing patient demographics, opening and closing patient visits.
   - Endpoints:
     - `POST /patients` - Register a new patient
     - `GET /patients` - Retrieve all patients
     - `GET /patients/:id` - Retrieve patient by ID
     - `POST /visits` - Open a new visit (Initial status: `OPEN`)
     - `GET /visits` - Retrieve all visits
     - `GET /visits/:id` - Retrieve visit by ID
     - `GET /patients/:patientId/visits` - Retrieve visits for a specific patient

2. **emr-bc (Electronic Medical Record Service - Port 3001)**
   - Database: `emr_db`
   - Responsibilities: Recording medical diagnoses, treatment notes, doctor assignments, and calculating treatment costs.
   - Endpoints:
     - `POST /records` - Create a medical record
     - `GET /records` - Retrieve all medical records
     - `GET /records/:id` - Retrieve medical record by ID
     - `GET /records/visit/:visitId` - Retrieve medical records by Visit ID
     - `PATCH /records/:id` - Update medical record details

3. **finance-bc (Finance and Billing Service - Port 3002)**
   - Database: `finance_db`
   - Responsibilities: Invoice generation, payment collection, issuing billing status updates.
   - Endpoints (Planned/In-progress):
     - `GET /invoices/:visitId` - Retrieve invoice details by Visit ID
     - `PATCH /invoices/:id/pay` - Process invoice payment (Status update: `PENDING` -> `PAID`)

4. **Shared Libraries**
   - `libs/common`: Common utility services and shared modules across services.
   - `libs/contracts`: Shared event definitions and DTO schemas for cross-service messages.

---

## 2. Business-Critical Flow & Event Matrix

### 2.1 End-to-End Patient Journey Flow
1. **Patient Arrival & Visit Creation (opd-bc)**:
   - Patient arrives at OPD. System registers patient or retrieves existing record.
   - OPD creates a new Visit with status `OPEN`.
   - Event Published: `visit.created` -> Payload: `{ visitId, patientId, timestamp }`
2. **Treatment & Medical Record (emr-bc)**:
   - EMR receives `visit.created` event notification.
   - Doctor records diagnosis, treatment notes, and treatment cost in `emr-bc`.
   - Event Published: `treatment.completed` -> Payload: `{ visitId, recordId, treatmentCost }`
3. **Billing & Invoice Processing (finance-bc)**:
   - Finance receives `treatment.completed` event and creates an Invoice in status `PENDING`.
   - Cashier collects payment and updates Invoice status to `PAID`.
   - Event Published: `invoice.paid` -> Payload: `{ visitId, invoiceId, status: "PAID" }`
4. **Visit Closing (opd-bc)**:
   - OPD receives `invoice.paid` event.
   - OPD updates Visit status from `OPEN` to `CLOSED`.

---

## 3. Validation Rules and Data Constraints

### 3.1 Input Validation Rules
- **Patient Registration**:
  - `hn` (Hospital Number): Required, non-empty, unique.
  - `idCard` (National ID / Passport): Required, non-empty, unique.
  - `firstName` & `lastName`: Required, non-empty text.
- **Visit Creation**:
  - `patientId`: Must reference a valid existing patient in `opd_db`.
  - `status`: Default to `OPEN`.
- **Medical Record Creation**:
  - `visitId`: Required UUID reference to OPD Visit.
  - `doctorId`: Required text/UUID.
  - `diagnosis` & `treatmentNote`: Required text.
  - `treatmentCost`: Must be a non-negative number (`treatmentCost >= 0`).

### 3.2 Database Integrity Constraints
- Strictly **no cross-database foreign keys** or joins between `opd_db`, `emr_db`, and `finance_db`.
- Relationships across microservices are maintained via scalar string/UUID identifiers (`visitId`, `patientId`).

---

## 4. Risk-Based Analysis & Classification Matrix

### 4.1 Critical Risk Area (P0 - System Failure / Financial / Data Corruption Impact)
1. **Duplicate Visit Creation**: Opening multiple active `OPEN` visits for the same patient simultaneously.
2. **Medical Record Attached to Invalid Visit**: Recording medical notes for non-existent or already `CLOSED` visits.
3. **Double Billing & Invoice Duplication**: Generating multiple invoices for a single treatment cycle.
4. **Over-Payment / Negative Billing**: Processing payments with negative amounts or modifying paid invoices.

### 4.2 High Risk Area (P1 - Messaging / Eventual Consistency / Resilience Impact)
1. **RabbitMQ Message Duplication (Idempotency)**: Receiving duplicate `visit.created` or `invoice.paid` events.
2. **Consumer Failure During Event Processing**: Consumer crash mid-way causing uncommitted messages or lost events.
3. **Database Transaction Failure**: Database connection drops during save operations leaving inconsistent states.

### 4.3 Medium Risk Area (P2 - Validation & Error Handling)
1. **Input Payload Validation Bypasses**: Malformed JSON or invalid data types passing through DTOs.
2. **Missing Standard Error Responses**: Internal 500 errors returned without clean error messages or codes.
3. **Missing Pagination**: Large data list queries returning unbounded arrays.

### 4.4 Low Risk Area (P3 - Maintainability & Logging)
1. **Inconsistent Log Format**: Non-structured log outputs across microservices.
2. **Missing API Documentation**: Incomplete Swagger/OpenAPI annotations on endpoints.

---

## 5. Security and Data Protection Risk Assessment

1. **Unauthenticated Endpoints**: Currently, REST endpoints do not enforce JWT or Bearer token authentication.
2. **Sensitive Medical Data Protection**: Diagnosis and medical notes are transmitted in plaintext without Role-Based Access Control (RBAC).
3. **PII Exposure**: Patient National ID (`idCard`) and contact details exposed via public GET APIs without data masking.

---

## 6. Gap Analysis & Missing Test Inventory

### 6.1 Uncovered Code and Components
- **`opd-bc`**: `PatientsService` unit tests, `VisitsService` unit tests, `PatientsController` API integration tests.
- **`emr-bc`**: `MedicalRecordsService` unit tests, `MedicalRecordsController` API integration tests.
- **`finance-bc`**: Invoice service unit tests, Payment processing integration tests.
- **Event Messaging**: RabbitMQ Publisher and Consumer integration tests, Dead-letter exchange (DLX) verification.

---

## 7. Recommended QA Action Plan and Test Execution Roadmap

### Step 1: Unit & Integration Testing Strategy
- Implement unit tests using Jest and NestJS `TestingModule` for all domain services (`PatientsService`, `VisitsService`, `MedicalRecordsService`).
- Mock TypeORM Repositories using mock factory functions.

### Step 2: Contract and Messaging Tests
- Create contract tests for RabbitMQ event payloads (`visit.created`, `treatment.completed`, `invoice.paid`).
- Verify idempotency handlers to ensure duplicate messages do not cause side effects.

### Step 3: End-to-End (E2E) Journey Tests
- Implement Playwright API / E2E test suite simulating full patient lifecycle from registration to visit closure.

---
*Created by Senior QA Engineer (Antigravity AI Agent)*
