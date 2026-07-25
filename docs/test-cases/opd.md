# Detailed Test Cases: OPD Bounded Context (docs/test-cases/opd.md)

**Module:** Outpatient Department (opd-bc)  
**Target Entities:** Patient (`patients`), Visit (`visits`)  
**Document Version:** 1.0  
**Date:** 26 July 2026  

---

## 1. Patient Registration Test Cases

### TC-OPD-001: Register New Patient Successfully
- **Priority:** High (P0)
- **Test Type:** Integration / API Test
- **Preconditions:** OPD database `opd_db` is running and reachable.
- **Steps:**
  1. Send HTTP `POST` request to `/patients` with valid patient JSON body.
- **Test Data:**
  ```json
  {
    "hn": "HN-2026-001",
    "firstName": "Somchai",
    "lastName": "Jaidee",
    "idCard": "1100200300401"
  }
  ```
- **Expected Result:**
  - Status Code: `201 Created`
  - Response body contains generated `id` (UUID) and matched attributes (`hn`, `firstName`, `lastName`, `idCard`).
  - Patient record is saved in `patients` table.

---

### TC-OPD-002: Reject Patient Registration with Duplicate HN
- **Priority:** High (P0)
- **Test Type:** Unit / Integration Test
- **Preconditions:** Patient with `hn: "HN-2026-001"` already exists in `opd_db`.
- **Steps:**
  1. Send HTTP `POST` request to `/patients` with the existing `hn`.
- **Test Data:**
  ```json
  {
    "hn": "HN-2026-001",
    "firstName": "Somsak",
    "lastName": "Dee",
    "idCard": "1100200300402"
  }
  ```
- **Expected Result:**
  - Status Code: `409 Conflict`
  - Error message: `"HN 'HN-2026-001' already exists"`

---

### TC-OPD-003: Reject Patient Registration with Duplicate ID Card
- **Priority:** High (P0)
- **Test Type:** Unit / Integration Test
- **Preconditions:** Patient with `idCard: "1100200300401"` already exists in `opd_db`.
- **Steps:**
  1. Send HTTP `POST` request to `/patients` with the existing `idCard`.
- **Test Data:**
  ```json
  {
    "hn": "HN-2026-002",
    "firstName": "Somying",
    "lastName": "Rakดี",
    "idCard": "1100200300401"
  }
  ```
- **Expected Result:**
  - Status Code: `409 Conflict`
  - Error message: `"ID Card '1100200300401' already exists"`

---

### TC-OPD-004: Validate Missing Required Fields on Patient Registration
- **Priority:** Medium (P1)
- **Test Type:** Validation Test
- **Preconditions:** None.
- **Steps:**
  1. Send HTTP `POST` request to `/patients` missing `hn` or `idCard`.
- **Test Data:**
  ```json
  {
    "firstName": "Somchai"
  }
  ```
- **Expected Result:**
  - Status Code: `400 Bad Request`
  - Validation error payload specifying missing required fields.

---

## 2. Visit Management Test Cases

### TC-OPD-005: Open New Visit for Existing Patient
- **Priority:** High (P0)
- **Test Type:** Integration / API Test
- **Preconditions:** Patient `id: "p-uuid-001"` exists in `opd_db`.
- **Steps:**
  1. Send HTTP `POST` request to `/visits` with valid `patientId`.
- **Test Data:**
  ```json
  {
    "patientId": "p-uuid-001"
  }
  ```
- **Expected Result:**
  - Status Code: `201 Created`
  - Response contains `id` (UUID), `patientId: "p-uuid-001"`, `status: "OPEN"`, and timestamp.
  - Event `visit.created` is emitted to RabbitMQ exchange.

---

### TC-OPD-006: Reject Visit Creation for Non-Existent Patient ID
- **Priority:** High (P0)
- **Test Type:** Unit / Integration Test
- **Preconditions:** Patient ID `"p-non-existent"` does not exist in `opd_db`.
- **Steps:**
  1. Send HTTP `POST` request to `/visits` with `"patientId": "p-non-existent"`.
- **Test Data:**
  ```json
  {
    "patientId": "p-non-existent"
  }
  ```
- **Expected Result:**
  - Status Code: `404 Not Found`
  - Error message: `"Patient with ID 'p-non-existent' not found"`

---

### TC-OPD-007: Prevent Duplicate Active Visits for Same Patient
- **Priority:** Critical (P0)
- **Test Type:** Business Logic Test
- **Preconditions:** Patient `id: "p-uuid-001"` already has an active Visit with `status: "OPEN"`.
- **Steps:**
  1. Attempt to send HTTP `POST` request to `/visits` for `patientId: "p-uuid-001"`.
- **Test Data:**
  ```json
  {
    "patientId": "p-uuid-001"
  }
  ```
- **Expected Result:**
  - Status Code: `409 Conflict`
  - Error message indicating patient already has an open visit.

---

### TC-OPD-008: Close Active Visit Upon Invoice Paid Event
- **Priority:** High (P0)
- **Test Type:** Event-Driven Consumer Test
- **Preconditions:** Visit `id: "v-uuid-001"` has status `"OPEN"`.
- **Steps:**
  1. Emit RabbitMQ message for pattern `invoice.paid` with payload `{ "visitId": "v-uuid-001", "status": "PAID" }`.
- **Expected Result:**
  - `opd-bc` consumer processes message.
  - Visit `"v-uuid-001"` status updates to `"CLOSED"`.

---

## 3. Resilience, Error & Security Test Cases

### TC-OPD-009: Handle Database Failure Gracefully During Patient Creation
- **Priority:** High (P1)
- **Test Type:** Fault Tolerance Test
- **Preconditions:** Database connection is abruptly terminated or unavailable.
- **Steps:**
  1. Send HTTP `POST` request to `/patients`.
- **Expected Result:**
  - Status Code: `500 Internal Server Error` (or `503 Service Unavailable`).
  - No orphaned state or partial record committed.

---

### TC-OPD-010: Handle RabbitMQ Publishing Failure During Visit Creation
- **Priority:** High (P1)
- **Test Type:** Messaging Resilience Test
- **Preconditions:** RabbitMQ broker is unreachable.
- **Steps:**
  1. Send HTTP `POST` request to `/visits`.
- **Expected Result:**
  - System logs error and triggers transaction rollback / retry strategy.
  - DB transaction is rolled back or flagged for outbox retry.

---

### TC-OPD-011: Reject Unauthorized Access to Patient Data
- **Priority:** High (P1)
- **Test Type:** Security Test
- **Preconditions:** Endpoint is protected by Auth Guard / JWT.
- **Steps:**
  1. Send HTTP `GET` request to `/patients` without Authorization header.
- **Expected Result:**
  - Status Code: `401 Unauthorized`
