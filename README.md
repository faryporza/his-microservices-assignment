# Hospital Information System (HIS) Microservices

[![CI Quality & Verification Gate](https://github.com/faryporza/his-microservices-assignment/actions/workflows/ci.yml/badge.svg)](https://github.com/faryporza/his-microservices-assignment/actions/workflows/ci.yml)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.x-brightgreen.svg)](https://nodejs.org/)
[![NestJS Framework](https://img.shields.io/badge/nestjs-11.0.1-ea2849.svg)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/postgresql-16.0-336791.svg)](https://www.postgresql.org/)
[![RabbitMQ](https://img.shields.io/badge/rabbitmq-3.13-ff6600.svg)](https://www.rabbitmq.com/)
[![Redis](https://img.shields.io/badge/redis-7.0-dc382d.svg)](https://redis.io/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A production-grade, event-driven Hospital Information System (HIS) built with **NestJS 11**, **PostgreSQL 16**, **RabbitMQ 3**, and **Redis 7** in a clean monorepo architecture, fully conforming to the [Enterprise Backend Blueprint](https://iots1.github.io/enterprise-backend-blueprint/) and the [HIS Assignment Specifications](https://gist.github.com/iots1/e5d1b5c19b39171a96b236af4a0a7f27).

---

## 📑 Table of Contents
1. [System Architecture & Boundaries](#1-system-architecture--boundaries)
2. [Event-Driven Choreography & Messaging Topology](#2-event-driven-choreography--messaging-topology)
3. [Security Architecture & Access Control](#3-security-architecture--access-control)
4. [Enterprise Blueprint Standards & Protocol](#4-enterprise-blueprint-standards--protocol)
5. [Service Catalog & API Specifications](#5-service-catalog--api-specifications)
6. [End-to-End Choreography Flow Walkthrough](#6-end-to-end-choreography-flow-walkthrough)
7. [Environment Variables Reference](#7-environment-variables-reference)
8. [Local Development & Docker Setup](#8-local-development--docker-setup)
9. [Automated Testing & Quality Gates](#9-automated-testing--quality-gates)
10. [Postman & Newman Verification](#10-postman--newman-verification)
11. [Architectural Decisions & Approved Exceptions](#11-architectural-decisions--approved-exceptions)

---

## 1. System Architecture & Boundaries

The monorepo (`his-project/apps/`) decomposes the hospital healthcare domain into four distinct, loosely coupled **Bounded Contexts**. Communication is strictly asynchronous via RabbitMQ topic choreography, secured with centralized stateful JWT and Role-Based Access Control (RBAC):

```text
               ┌────────────────────────────────────────────────────────┐
               │              IAM Microservice (Port 3003)              │
               │   Stateful JWT • Session Store • Blacklist • Rate Limit│
               └───────────────────────────┬────────────────────────────┘
                                           │ Issues Stateful JWT (15m/7d)
                                           ▼
┌──────────────────────┐    visit.created     ┌──────────────────────┐  treatment.completed   ┌──────────────────────┐
│        opd-bc        ├─────────────────────►│        emr-bc        ├───────────────────────►│      finance-bc      │
│     (Port 3000)      │                      │     (Port 3001)      │                        │     (Port 3002)      │
│  Patient & Visit DB  │◄─────────────────────┤ Medical Records DB   │                        │ Billing & Invoice DB │
└──────────────────────┘     invoice.paid     └──────────────────────┘                        └──────────┬───────────┘
          │                   (RabbitMQ Topic Exchange: his.events)                                      │
          └──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 🔹 Service Matrix

| Service | Bounded Context | HTTP Port | Database | Primary Queue | Dead-Letter Queue | Swagger UI |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| **`iam-bc`** | Identity & Access Management | `3003` | `iam_db` | — | — | [http://localhost:3003/docs](http://localhost:3003/docs) |
| **`opd-bc`** | Outpatient Department | `3000` | `opd_db` | `opd.events` | `opd.events.dlq` | [http://localhost:3000/docs](http://localhost:3000/docs) |
| **`emr-bc`** | Electronic Medical Records | `3001` | `emr_db` | `emr.events` | `emr.events.dlq` | [http://localhost:3001/docs](http://localhost:3001/docs) |
| **`finance-bc`** | Billing & Invoicing | `3002` | `finance_db` | `finance.events` | `finance.events.dlq` | [http://localhost:3002/docs](http://localhost:3002/docs) |

### 🔹 Schema Isolation & Zero Cross-DB Joins
- **4 Logical Databases**: A single PostgreSQL container hosts four isolated databases: `opd_db`, `emr_db`, `finance_db`, and `iam_db`.
- **Zero Cross-Database Joins**: Inter-service references use scalar UUID strings exclusively (`patient_id`, `visit_id`, `record_id`, `invoice_id`). Cross-database foreign keys and queries are strictly prevented by Clean Architecture boundary tests.
- **Per-Service TypeORM Migrations**: Runtime auto-synchronization is disabled (`synchronize: false`). All tables and constraints are managed via deterministic migrations in `libs/common/src/migrations/`.

---

## 2. Event-Driven Choreography & Messaging Topology

The system uses asynchronous choreography to decouple services during the outpatient healthcare lifecycle:

```mermaid
sequenceDiagram
    autonumber
    actor Nurse as Hospital Staff (Nurse)
    actor Doctor as Attending Doctor
    actor FinanceStaff as Billing Specialist
    participant OPD as opd-bc (3000)
    participant RMQ as RabbitMQ (his.events)
    participant EMR as emr-bc (3001)
    participant FIN as finance-bc (3002)

    Nurse->>OPD: 1. Create Patient & Open Visit (POST /visits)
    OPD->>OPD: Persist Visit (OPEN) + Save to outbox_events in 1 Transaction
    OPD-)RMQ: Outbox Relay publishes event: visit.created
    RMQ-)EMR: Consumer receives visit.created
    EMR->>EMR: Atomic processed_events Check + Persist Medical Record (WAITING)

    Doctor->>EMR: 2. Doctor Finalizes Treatment (PATCH /records/:id/complete)
    EMR->>EMR: Update Record (COMPLETED) + Save to outbox_events in 1 Transaction
    EMR-)RMQ: Outbox Relay publishes event: treatment.completed (with treatmentCost & patientId)
    RMQ-)FIN: Consumer receives treatment.completed
    FIN->>FIN: Atomic processed_events Check + Persist Invoice (PENDING)

    FinanceStaff->>FIN: 3. Settle Payment (PATCH /invoices/:id/pay)
    FIN->>FIN: Update Invoice (PAID) + Save to outbox_events in 1 Transaction
    FIN-)RMQ: Outbox Relay publishes event: invoice.paid
    RMQ-)OPD: Consumer receives invoice.paid
    OPD->>OPD: Atomic processed_events Check + Update Visit (CLOSED)
```

### 🔹 Transactional Outbox Pattern
To prevent distributed dual-write inconsistencies, state changes and outgoing domain events are written to the database within a single local transaction using TypeORM. A background worker polls and dispatches pending events from `outbox_events` to RabbitMQ with exponential backoff.

### 🔹 Atomic Idempotency & Duplicate Suppression
Event consumers check and atomically reserve message execution in `processed_events` (`event_id` UNIQUE). Duplicate deliveries from network retries or RabbitMQ redelivery are acknowledged without re-executing business logic.

### 🔹 Dead-Letter Exchange (DLX) & Replay Subsystem
- **Exchange**: `his.events.dlx` (Direct exchange).
- **Dead-Letter Queues**: `opd.events.dlq`, `emr.events.dlq`, `finance.events.dlq`.
- **Operator Replay**: Failed poison messages routed to the DLQ can be safely replayed to the main exchange via `RabbitMqReplayService`.

---

## 3. Security Architecture & Access Control

```mermaid
flowchart TD
    Req[Incoming HTTP Request] --> PublicCheck{Has @Public?}
    PublicCheck -- Yes --> Handler[Execute Controller Action]
    PublicCheck -- No --> JWTGuard[JwtAuthGuard]

    JWTGuard --> VerifySig{Valid JWT Signature & TTL?}
    VerifySig -- No --> Err401A[401 Unauthorized: Invalid/Expired Token]
    VerifySig -- Yes --> BlacklistCheck{JTI in Redis Blacklist?}

    BlacklistCheck -- Yes --> Err401B[401 Unauthorized: Token Revoked]
    BlacklistCheck -- No --> SessionCheck{Active Redis Session?}

    SessionCheck -- Redis Down --> Err503[503 Service Unavailable: Fail-Closed]
    SessionCheck -- Expired/Missing --> Err401C[401 Unauthorized: Session Expired]
    SessionCheck -- Active --> PermGuard[PermissionsGuard]

    PermGuard --> RoleMatch{Role has Permission in @RequirePermission?}
    RoleMatch -- No --> Err403A[403 Forbidden: Insufficient Role Permissions]
    RoleMatch -- Yes --> OwnershipGuard[ResourceOwnershipGuard]

    OwnershipGuard --> OwnershipMatch{Authenticated Patient matches Target Resource?}
    OwnershipMatch -- No --> Err403B[403 Forbidden: BOLA Violation]
    OwnershipMatch -- Yes --> Handler
```

### 🔹 Security Specifications
- **Short-Lived Access Token**: 15 minutes expiration (`sub`, `username`, `role`, `sid`, `jti`).
- **Long-Lived Refresh Token**: 7 days expiration (`sub`, `sid`, `jti`).
- **Stateful Redis Session**: Keyed at `auth:session:{userId}:{sessionId}` with a 7-day sliding TTL.
- **Refresh Token Theft Protection**: Replaying an already-rotated refresh token triggers immediate revocation of all active sessions for that user.
- **Immediate Token Revocation**: `POST /auth/logout` deletes the Redis session and blacklists the token JTI in Redis (`auth:blacklist:{jti}`).
- **Fail-Closed Circuit Breaker**: If Redis experiences an outage, `JwtAuthGuard` returns `503 Service Unavailable` rather than allowing unauthenticated requests.
- **BOLA Protection (`@CheckResourceOwnership`)**: `ResourceOwnershipGuard` ensures patients can only access their own clinical records and invoices.
- **Authentication Rate Limiting (`@RateLimit`)**: Redis-backed sliding counter throttler protecting authentication endpoints against brute-force attacks (`429 Too Many Requests`).
- **PHI / Billing Access Auditing**: `AuditService` logs every sensitive healthcare record access to the `audit_logs` table in `iam_db`.

### 🔹 Role & Permission Matrix

| Role | Domain Scope & Assigned Permissions |
| :--- | :--- |
| **`ADMIN`** | Full administrative access: `user:*`, `patient:*`, `visit:*`, `medical-record:*`, `invoice:*` |
| **`DOCTOR`** | Clinical care: `medical-record:create`, `medical-record:update`, `medical-record:read`, `medical-record:complete`, `visit:read`, `patient:read` |
| **`NURSE`** | Triage & check-in: `patient:create`, `patient:update`, `patient:read`, `visit:create`, `visit:read`, `medical-record:read` |
| **`FINANCE_STAFF`** | Billing: `invoice:read`, `invoice:pay`, `patient:read`, `visit:read` |
| **`PATIENT`** | Self-service: `patient:read-self`, `visit:read-self`, `medical-record:read-self`, `invoice:read-self` |

---

## 4. Enterprise Blueprint Standards & Protocol

All microservices adhere to the Enterprise Backend Blueprint formatting and naming rules:

### 🔹 Success Response Envelope (`200 OK` / `201 Created`)
```json
{
  "status": {
    "code": 200000,
    "message": "Request Succeeded"
  },
  "data": {
    "type": "patients",
    "id": "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
    "attributes": {
      "hn": "HN-0001",
      "first_name": "Somchai",
      "last_name": "Jaidee",
      "id_card": "1234567890123",
      "created_at": "2026-08-26T01:05:00.000Z",
      "updated_at": "2026-08-26T01:05:00.000Z"
    }
  },
  "meta": {
    "timestamp": "2026-08-26T01:05:00.000Z"
  },
  "links": {
    "self": "/patients"
  }
}
```

### 🔹 Validation Error Response Envelope (`400 Bad Request`)
```json
{
  "status": {
    "code": 400001,
    "message": "Validation Failed"
  },
  "errors": [
    {
      "code": "400001",
      "title": "Validation Failed",
      "detail": "hn must be a string",
      "source": {
        "pointer": "/data/attributes/hn"
      }
    }
  ],
  "meta": {
    "timestamp": "2026-08-26T01:05:00.000Z"
  },
  "links": {
    "self": "/patients"
  }
}
```

### 🔹 Structured JSON Logging & Observability
All logs emit single-line structured JSON with distributed tracing headers (`x-correlation-id`, `x-trace-id`, `x-span-id`) and automatic sensitive field redaction (`password`, `token`, `access_token`, `refresh_token`, `authorization`, `id_card`, `jti`, `secret`):

```json
{"timestamp":"2026-08-26T07:45:00.000Z","level":"info","message":"Domain event processed","service":{"name":"finance-bc","version":"0.0.1"},"trace":{"trace_id":"e2e-trace-id","correlation_id":"e2e-trace-id"},"context":{"action":"CONSUME_EVENT","event_name":"treatment.completed","event_id":"7c9e6679-7425-40de-944b-e07fc1f90ae7","visit_id":"550e8400-e29b-41d4-a716-446655440000","event_status":"ACKED"}}
```

---

## 5. Service Catalog & API Specifications

### 🔹 IAM Microservice (`iam-bc` — Port `3003`)
- `POST /auth/register` (`@Public`, `@RateLimit`): Register new account (defaults to `PATIENT`).
- `POST /auth/login` (`@Public`, `@RateLimit`): Authenticate and issue Stateful JWT pair.
- `POST /auth/refresh` (`@Public`, `@RateLimit`): Rotate refresh token and issue new token pair.
- `POST /auth/logout` (`Authenticated`): Invalidate session and blacklist access token JTI.
- `GET /auth/me` (`Authenticated`): Get profile of the current user.
- `PATCH /users/:id/role` (`ADMIN` only): Promote/change user role.

### 🔹 OPD Microservice (`opd-bc` — Port `3000`)
- `POST /patients`: Register new patient record.
- `GET /patients`: List patients (paginated).
- `GET /patients/:id`: Get patient details.
- `PATCH /patients/:id`: Update patient demographics.
- `DELETE /patients/:id`: Soft/hard delete patient.
- `POST /visits`: Check in patient and open visit (`visit.created` emitted).
- `GET /visits`: List visits.
- `GET /visits/:id`: Get visit details by ID.
- `GET /patients/:patientId/visits`: Get visit history for patient.

### 🔹 EMR Microservice (`emr-bc` — Port `3001`)
- `POST /records`: Create medical record draft (`DOCTOR`).
- `GET /records`: List medical records.
- `GET /records/:id`: Get medical record by ID.
- `GET /records/visit/:visitId`: Retrieve medical records for visit.
- `PATCH /records/:id`: Update clinical draft diagnosis / notes.
- `PATCH /records/:id/complete`: Finalize diagnosis and treatment cost (`treatment.completed` emitted).

### 🔹 Finance Microservice (`finance-bc` — Port `3002`)
- `GET /invoices`: List invoices.
- `GET /invoices/:visitId`: Get invoice for a specific visit.
- `PATCH /invoices/:id/pay`: Process payment settlement (`invoice.paid` emitted).

---

## 6. End-to-End Choreography Flow Walkthrough

```bash
# 1. Login as Staff
curl -X POST http://localhost:3003/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"nurse_test_user","password":"Password123!"}'

# 2. Register Patient & Open Visit (OPD)
curl -X POST http://localhost:3000/patients \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"hn":"HN-001","first_name":"Somchai","last_name":"Jaidee","id_card":"1234567890123"}'

curl -X POST http://localhost:3000/visits \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"patient_id":"<PATIENT_UUID>"}'

# 3. Doctor Finalizes Treatment (EMR)
curl -X PATCH http://localhost:3001/records/<RECORD_UUID>/complete \
  -H "Authorization: Bearer <DOCTOR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"doctor_id":"dr_watson","diagnosis":"Acute Bronchitis","treatment_note":"Antibiotics prescribed","treatment_cost":1500}'

# 4. Settle Invoice Payment (Finance)
curl -X PATCH http://localhost:3002/invoices/<INVOICE_UUID>/pay \
  -H "Authorization: Bearer <FINANCE_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"status":"PAID"}'

# 5. Verify Visit Closed (OPD)
curl -X GET http://localhost:3000/visits/<VISIT_UUID> \
  -H "Authorization: Bearer <TOKEN>"
```

---

## 7. Environment Variables Reference

Defined in `his-project/.env` (configured from `.env.example`):

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `OPD_PORT` | `3000` | Port for OPD microservice |
| `EMR_PORT` | `3001` | Port for EMR microservice |
| `FINANCE_PORT` | `3002` | Port for Finance microservice |
| `IAM_PORT` | `3003` | Port for IAM microservice |
| `SERVICE_VERSION` | `0.0.1` | Application version for structured logger |
| `LOG_LEVEL` | `debug` | Log output level (`debug`, `info`, `warn`, `error`) |
| `POSTGRES_HOST` | `localhost` | PostgreSQL host |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `POSTGRES_USERNAME` | `postgres` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `postgres` | PostgreSQL password |
| `OPD_DATABASE` | `opd_db` | Logical database for OPD service |
| `EMR_DATABASE` | `emr_db` | Logical database for EMR service |
| `FINANCE_DATABASE` | `finance_db` | Logical database for Finance service |
| `IAM_DATABASE` | `iam_db` | Logical database for IAM service |
| `RABBITMQ_URL` | `amqp://guest:guest@localhost:5672` | RabbitMQ connection URL |
| `RABBITMQ_EXCHANGE` | `his.events` | Primary topic exchange |
| `OPD_RABBITMQ_QUEUE` | `opd.events` | Durable queue for OPD |
| `EMR_RABBITMQ_QUEUE` | `emr.events` | Durable queue for EMR |
| `FINANCE_RABBITMQ_QUEUE` | `finance.events` | Durable queue for Finance |
| `REDIS_HOST` | `localhost` | Redis server host |
| `REDIS_PORT` | `6379` | Redis server port |
| `JWT_SECRET` | `his-secret-jwt-key-for-development...` | 32+ character JWT access secret |
| `JWT_REFRESH_SECRET` | `his-refresh-secret-jwt-key...` | 32+ character JWT refresh secret |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Access token expiration duration |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token & Redis session expiration duration |

---

## 8. Local Development & Docker Setup

### Prerequisites
- **Node.js**: `>= 20.x`
- **npm**: `>= 10.x`
- **Docker & Docker Compose**

### Step-by-Step Setup
```bash
# 1. Start Docker infrastructure containers
docker compose up -d

# 2. Navigate to project root and install dependencies
cd his-project
npm install

# 3. Configure environment
cp .env.example .env

# 4. Run all microservices concurrently
npm run start:all
```

#### Running individual microservices in dev mode:
```bash
npm run start:iam       # IAM (Port 3003)
npm run start:dev       # OPD (Port 3000)
npm run start:emr       # EMR (Port 3001)
npm run start:finance   # Finance (Port 3002)
```

---

## 9. Automated Testing & Quality Gates

All commands run from `his-project/`:

```bash
# 1. Check linting, layer seams & Clean Architecture boundaries
npm run lint:check

# 2. Compile all 4 microservices with Webpack
npm run build

# 3. Run all unit and integration test suites
npm test

# 4. Collect full code coverage
npm run test:cov

# 5. Run live multi-service E2E tests
npm run test:e2e

# 6. Verify live choreographed outpatient journey flow
npm run test:flow

# 7. Run complete Postman/Newman test suite
npm run test:postman

# 8. Run production dependency security audit
npm audit --omit=dev --audit-level=low
```

### 🔹 Verified Test Evidence
- **Unit & Integration Tests**: **61 test suites, 281 tests passed (100%)**
- **End-to-End Tests**: **4 test suites, 18 tests passed (100%)**
- **Live Choreography Flow**: **`visit.created` $\to$ `treatment.completed` $\to$ `invoice.paid` $\to$ `CLOSED`**
- **Newman Postman Suite**: **50 requests executed, 50 assertions passed (0 failed)**
- **Dependency Security**: **0 vulnerabilities**

---

## 10. Postman & Newman Verification

A comprehensive Postman test collection is located at [`docs/postman/his.postman_collection.json`](file:///Users/tanakitchuchoed/Documents/GitHub/his-microservices-assignment/docs/postman/his.postman_collection.json).

### Running via Newman CLI
```bash
cd his-project
npm run test:postman
```

### Postman Test Suite Coverage
1. **IAM**: Registration, Login, Token Refresh, Admin Role Update (`PATCH /users/:id/role`), Session Revocation.
2. **OPD**: Patient CRUD, Visit Management, Strict DTO Validation.
3. **EMR**: Medical Records Preparation, Treatment Completion.
4. **Finance**: Invoice Generation, Payment Processing.
5. **Security & RBAC**: Unauthenticated 401s, Invalid Signature 401s, Cross-Role 403s (Doctor paying invoice, Finance completing medical records, Patient creating visits, Non-admin updating roles), BOLA ownership validation, Blacklisted Token 401s.
6. **Repeatable End-to-End Choreography Flow**: Complete 15-step choreographed healthcare scenario.

---

## 11. Architectural Decisions & Approved Exceptions

The following intentional architectural decisions and approved exceptions are documented:

- **AE-1 (Direct Root Routes)**: Root endpoints (`/patients`, `/visits`, `/records`, `/invoices`, `/invoices/:id/pay`, `/docs`) are preserved without global prefixing `/opd-bc/v1` to adhere strictly to the HIS Assignment Gist contract.
- **AE-2 (`iam-bc` Uniform Monorepo Naming)**: `iam-bc` is used for monorepo consistency across all four services.
- **AE-3 (RabbitMQ Topic Messaging Transport)**: RabbitMQ topic exchange message choreography (`his.events`) is preserved over generic TCP transport as specified by the HIS assignment.

---

## 📄 License
This project is licensed under the MIT License.
