# Hospital Information System (HIS) Microservices

Production-ready event-driven microservices architecture built with NestJS 11, PostgreSQL 16, RabbitMQ 3, and Redis 7, strictly aligned with the [Enterprise Backend Blueprint](https://iots1.github.io/enterprise-backend-blueprint/).

---

## 1. System Overview & Architecture

The system is organized into four distinct Bounded Contexts within a NestJS monorepo (`his-project/apps/`), communicating via event choreography and protected by a centralized Stateful JWT and Role-Based Access Control (RBAC) security layer:

```text
               ┌───────────────────────────────┐
               │    IAM Service (Port 3003)    │
               │   Auth, Users, RBAC & Redis   │
               └───────────────┬───────────────┘
                               │ Issues Stateful JWT (15m/7d)
                               ▼
┌─────────────────┐   visit.created    ┌─────────────────┐   treatment.completed    ┌───────────────────┐
│     opd-bc      ├───────────────────►│     emr-bc      ├─────────────────────────►│    finance-bc     │
│   (Port 3000)   │                    │   (Port 3001)   │                          │    (Port 3002)    │
│ Patient & Visit │◄───────────────────┤ Medical Records │                          │ Invoices & Billing│
└─────────────────┘    invoice.paid    └─────────────────┘                          └─────────┬─────────┘
        │                 (RabbitMQ Topic Exchange: his.events)                               │
        └─────────────────────────────────────────────────────────────────────────────────────┘
```

### 🔹 Service Matrix

| Service | Bounded Context | HTTP Port | Logical Database | Message Queue | Primary Responsibilities | Swagger UI |
| :--- | :--- | ---: | :--- | :--- | :--- | :--- |
| **`iam-bc`** | **IAM** | `3003` | `iam_db` | — | User registration, login, token refresh/revocation, Redis session store & blacklist, RBAC validation | [http://localhost:3003/docs](http://localhost:3003/docs) |
| **`opd-bc`** | **OPD** | `3000` | `opd_db` | `opd.events` | Patient registration, visit creation, visit status lifecycle (`OPEN` / `CLOSED`) | [http://localhost:3000/docs](http://localhost:3000/docs) |
| **`emr-bc`** | **EMR** | `3001` | `emr_db` | `emr.events` | Medical record lifecycle (`WAITING` / `COMPLETED`), doctor diagnosis and treatment notes | [http://localhost:3001/docs](http://localhost:3001/docs) |
| **`finance-bc`** | **Finance** | `3002` | `finance_db` | `finance.events` | Invoice management (`PENDING` / `PAID`), payment settlement | [http://localhost:3002/docs](http://localhost:3002/docs) |

> 🔒 **Database Isolation Principle**: A single PostgreSQL instance hosts four isolated logical databases. Cross-database queries and joins are strictly prohibited. Inter-service references use UUIDs only.

---

## 2. Event-Driven Workflow & Reliability Patterns

```mermaid
sequenceDiagram
    autonumber
    actor Staff as Hospital Staff
    participant IAM as iam-bc (3003)
    participant OPD as opd-bc (3000)
    participant RMQ as RabbitMQ (his.events)
    participant EMR as emr-bc (3001)
    participant FIN as finance-bc (3002)

    Staff->>IAM: 1. Login to obtain Bearer Token (POST /auth/login)
    IAM-->>Staff: 200 OK { access_token, refresh_token }

    Staff->>OPD: 2. Create Visit for Patient (POST /visits) [Bearer Token]
    OPD->>OPD: Insert Visit (status: OPEN) + Insert into outbox_events in single DB transaction
    OPD-)RMQ: Outbox publisher sends domain event: visit.created
    RMQ-)EMR: Consumer receives visit.created
    EMR->>EMR: Insert processed_events + Insert Medical Record (status: WAITING)

    Staff->>EMR: 3. Doctor completes treatment (PATCH /records/:id/complete) [Doctor Token]
    EMR->>EMR: Update Record (COMPLETED) + Insert into outbox_events in single DB transaction
    EMR-)RMQ: Outbox publisher sends domain event: treatment.completed (cost: 1500)
    RMQ-)FIN: Consumer receives treatment.completed
    FIN->>FIN: Insert processed_events + Insert Invoice (status: PENDING, amount: 1500.00)

    Staff->>FIN: 4. Process invoice payment (PATCH /invoices/:id/pay) [Finance Token]
    FIN->>FIN: Update Invoice (PAID) + Insert into outbox_events in single DB transaction
    FIN-)RMQ: Outbox publisher sends domain event: invoice.paid
    RMQ-)OPD: Consumer receives invoice.paid
    OPD->>OPD: Insert processed_events + Update Visit (status: CLOSED)
```

### 🔹 Transactional Outbox Pattern
To prevent dual-write inconsistencies, state changes and outgoing domain events are written to the database in a single local transaction using TypeORM. An asynchronous publisher service polls and dispatches pending events from `outbox_events` to RabbitMQ, marking them as `PUBLISHED`.

### 🔹 Idempotent Event Consumers
All message consumers track processed event IDs in the `processed_events` table (`event_id` UNIQUE). Duplicate deliveries resulting from network retries or at-least-once transport are acknowledged without re-executing business logic.

---

## 3. Security, Authentication & Role-Based Access Control (RBAC)

The security architecture provides token-based authentication backed by Redis state management:

```mermaid
flowchart TD
    Req[Incoming HTTP Request] --> AuthCheck{Has @Public?}
    AuthCheck -- Yes --> Handler[Execute Route Handler]
    AuthCheck -- No --> Guard[JwtAuthGuard]
    
    Guard --> VerifyJWT{Valid JWT Signature & Exp?}
    VerifyJWT -- No --> Err401A[401 Unauthorized: Invalid or Expired Token]
    VerifyJWT -- Yes --> BlacklistCheck{JTI in Redis Blacklist?}
    
    BlacklistCheck -- Yes --> Err401B[401 Unauthorized: Revoked Token]
    BlacklistCheck -- No --> SessionCheck{Active Session in Redis?}
    
    SessionCheck -- Redis Outage --> Err503[503 Service Unavailable: Fail-Closed]
    SessionCheck -- No / Expired --> Err401C[401 Unauthorized: Session Inactive]
    SessionCheck -- Yes --> RoleGuard[RolesGuard]
    
    RoleGuard --> RoleCheck{User Role Matches @Roles?}
    RoleCheck -- No --> Err403[403 Forbidden: Insufficient Permissions]
    RoleCheck -- Yes --> Handler
```

### 🔹 Security Specifications
- **Access Token**: Short-lived (15 minutes), containing `sub` (User ID), `username`, `role`, `sid` (Session ID), and `jti` (Token ID).
- **Refresh Token**: Long-lived (7 days), containing `sub`, `sid`, and `jti`.
- **Stateful Redis Session**: Keyed at `auth:session:{userId}:{sessionId}` with a 7-day TTL.
- **Token Rotation & Reuse Detection**: Calling `POST /auth/refresh` rotates both tokens. If an already-rotated refresh token is reused, the system treats it as token theft and **revokes all active sessions for that user immediately**.
- **Instant Logout & Blacklisting**: `POST /auth/logout` destroys the Redis session and adds the access token `jti` to `auth:blacklist:{jti}` with TTL matching the remaining access token lifetime.
- **Fail-Closed Strategy**: If Redis is unreachable, `JwtAuthGuard` returns `503 Service Unavailable` instead of allowing unverified requests.

### 🔹 RBAC Permissions Matrix

Roles defined in `UserRole` enum: `ADMIN`, `DOCTOR`, `NURSE`, `FINANCE_STAFF`, `PATIENT`.

| Service | Method | Route | Required Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| **IAM** | `POST` | `/auth/register` | `@Public()` | Register new user account |
| **IAM** | `POST` | `/auth/login` | `@Public()` | Authenticate and issue token pair |
| **IAM** | `POST` | `/auth/refresh` | `@Public()` | Rotate access and refresh tokens |
| **IAM** | `POST` | `/auth/logout` | `All Authenticated` | Invalidate session and blacklist access token |
| **IAM** | `GET` | `/auth/me` | `All Authenticated` | Get authenticated user profile |
| **OPD** | `POST` | `/patients` | `ADMIN`, `DOCTOR`, `NURSE` | Create patient |
| **OPD** | `GET` | `/patients` | `ADMIN`, `DOCTOR`, `NURSE` | List all patients |
| **OPD** | `GET` | `/patients/:id` | `ADMIN`, `DOCTOR`, `NURSE`, `PATIENT` | Get patient by ID |
| **OPD** | `PATCH` | `/patients/:id` | `ADMIN`, `DOCTOR`, `NURSE` | Update patient |
| **OPD** | `DELETE` | `/patients/:id` | `ADMIN`, `DOCTOR`, `NURSE` | Delete patient |
| **OPD** | `POST` | `/visits` | `ADMIN`, `DOCTOR`, `NURSE` | Create visit |
| **OPD** | `GET` | `/visits` | `ADMIN`, `DOCTOR`, `NURSE` | List all visits |
| **OPD** | `GET` | `/visits/:id` | `ADMIN`, `DOCTOR`, `NURSE`, `PATIENT` | Get visit by ID |
| **OPD** | `GET` | `/patients/:patientId/visits` | `ADMIN`, `DOCTOR`, `NURSE`, `PATIENT` | Get visit history for patient |
| **EMR** | `POST` | `/records` | `DOCTOR` | Create medical record |
| **EMR** | `PATCH` | `/records/:id` | `DOCTOR` | Update medical record draft |
| **EMR** | `PATCH` | `/records/:id/complete` | `DOCTOR` | Finalize treatment and treatment cost |
| **EMR** | `GET` | `/records` | `DOCTOR`, `NURSE`, `ADMIN`, `PATIENT` | List medical records |
| **EMR** | `GET` | `/records/:id` | `DOCTOR`, `NURSE`, `ADMIN`, `PATIENT` | Get medical record by ID |
| **EMR** | `GET` | `/records/visit/:visitId` | `DOCTOR`, `NURSE`, `ADMIN`, `PATIENT` | Get medical records for visit |
| **Finance** | `PATCH` | `/invoices/:id/pay` | `FINANCE_STAFF`, `ADMIN` | Settle invoice payment |
| **Finance** | `GET` | `/invoices` | `FINANCE_STAFF`, `ADMIN` | List invoices |
| **Finance** | `GET` | `/invoices/:visitId` | `FINANCE_STAFF`, `ADMIN`, `PATIENT` | Get invoices for visit |
| **Health** | `GET` | `/`, `/health` | `@Public()` | Service health probe |

---

## 4. API Specification & JSON:API Envelope Standard

All responses follow the Enterprise Backend Blueprint standard JSON:API envelope structure.

### 🔹 Success Response (`200 OK` / `201 Created`)
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

### 🔹 Error Response Envelope
```json
{
  "status": {
    "code": 403,
    "message": "Forbidden"
  },
  "errors": [
    {
      "code": "403",
      "title": "ForbiddenException",
      "detail": "Forbidden resource"
    }
  ],
  "meta": {
    "timestamp": "2026-08-26T01:05:00.000Z"
  },
  "links": {
    "self": "/records"
  }
}
```

### 🔹 Standard Error Codes Mapping

| HTTP Status | Business Code | Exception Class | Reason |
| :--- | :--- | :--- | :--- |
| `400 Bad Request` | `400001` | `ValidationException` | Request body validation failed (`class-validator`) |
| `400 Bad Request` | `400002` | `InvalidParameterException` | Invalid path or query parameter |
| `401 Unauthorized` | `401` | `UnauthorizedException` | Missing token, invalid signature, expired session, or revoked token |
| `403 Forbidden` | `403` | `ForbiddenException` | Role lacks permission for the endpoint |
| `404 Not Found` | `404` | `NotFoundException` | Resource not found |
| `409 Conflict` | `409` | `ConflictException` | Duplicate entity or invalid status transition |
| `503 Service Unavailable` | `503` | `ServiceUnavailableException` | Database or Redis outage (Fail-closed) |

---

## 5. End-to-End API Flow Walkthrough

### Step 1: User Registration & Login (IAM)
```http
POST http://localhost:3003/auth/register
Content-Type: application/json

{
  "username": "dr_watson",
  "email": "watson@hospital.local",
  "password": "Password123!",
  "first_name": "John",
  "last_name": "Watson",
  "role": "DOCTOR"
}
```
```http
POST http://localhost:3003/auth/login
Content-Type: application/json

{
  "username": "dr_watson",
  "password": "Password123!"
}
```
**Response (`200 OK`):**
```json
{
  "status": { "code": 200000, "message": "Request Succeeded" },
  "data": {
    "type": "tokens",
    "id": "673a5a4d-1768-450f-90a6-5784ef36d14d",
    "attributes": {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "token_type": "Bearer",
      "expires_in": 900
    }
  },
  "meta": { "timestamp": "2026-08-26T01:00:00.000Z" },
  "links": { "self": "/auth/login" }
}
```

### Step 2: Register Patient (OPD)
```http
POST http://localhost:3000/patients
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "hn": "HN-0001",
  "first_name": "Somchai",
  "last_name": "Jaidee",
  "id_card": "1234567890123"
}
```
**Response (`201 Created`):**
```json
{
  "status": { "code": 201000, "message": "Request Succeeded" },
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
  "meta": { "timestamp": "2026-08-26T01:05:00.000Z" },
  "links": { "self": "/patients" }
}
```

### Step 3: Open Visit (OPD)
```http
POST http://localhost:3000/visits
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "patient_id": "6ba7b810-9dad-41d1-80b4-00c04fd430c8"
}
```
**Response (`201 Created`):**
```json
{
  "status": { "code": 201000, "message": "Request Succeeded" },
  "data": {
    "type": "visits",
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "attributes": {
      "patient_id": "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
      "status": "OPEN",
      "visit_date": "2026-08-26T01:06:00.000Z",
      "updated_at": "2026-08-26T01:06:00.000Z"
    }
  },
  "meta": { "timestamp": "2026-08-26T01:06:00.000Z" },
  "links": { "self": "/visits" }
}
```
*(OPD persists the visit and publishes `visit.created`)*

### Step 4: Medical Record Created via Event (EMR)
```http
GET http://localhost:3001/records/visit/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <access_token>
```
**Response (`200 OK`):**
```json
{
  "status": { "code": 200000, "message": "Request Succeeded" },
  "data": [
    {
      "type": "medical-records",
      "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "attributes": {
        "visit_id": "550e8400-e29b-41d4-a716-446655440000",
        "doctor_id": null,
        "diagnosis": null,
        "treatment_note": null,
        "treatment_cost": null,
        "status": "WAITING",
        "created_at": "2026-08-26T01:06:01.000Z",
        "updated_at": "2026-08-26T01:06:01.000Z"
      }
    }
  ],
  "meta": { "timestamp": "2026-08-26T01:06:05.000Z" },
  "links": { "self": "/records/visit/550e8400-e29b-41d4-a716-446655440000" }
}
```

### Step 5: Doctor Completes Treatment (EMR)
```http
PATCH http://localhost:3001/records/7c9e6679-7425-40de-944b-e07fc1f90ae7/complete
Authorization: Bearer <doctor_access_token>
Content-Type: application/json

{
  "doctor_id": "dr_watson",
  "diagnosis": "Influenza Type A",
  "treatment_note": "Prescribed Tamiflu and 3 days bed rest.",
  "treatment_cost": 1500
}
```
**Response (`200 OK`):**
```json
{
  "status": { "code": 200000, "message": "Request Succeeded" },
  "data": {
    "type": "medical-records",
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "attributes": {
      "visit_id": "550e8400-e29b-41d4-a716-446655440000",
      "doctor_id": "dr_watson",
      "diagnosis": "Influenza Type A",
      "treatment_note": "Prescribed Tamiflu and 3 days bed rest.",
      "treatment_cost": 1500,
      "status": "COMPLETED",
      "created_at": "2026-08-26T01:06:01.000Z",
      "updated_at": "2026-08-26T01:10:00.000Z"
    }
  },
  "meta": { "timestamp": "2026-08-26T01:10:00.000Z" },
  "links": { "self": "/records/7c9e6679-7425-40de-944b-e07fc1f90ae7/complete" }
}
```
*(EMR transitions record to `COMPLETED` and publishes `treatment.completed` with cost `1500`)*

### Step 6: Invoice Created via Event (Finance)
```http
GET http://localhost:3002/invoices/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <finance_access_token>
```
**Response (`200 OK`):**
```json
{
  "status": { "code": 200000, "message": "Request Succeeded" },
  "data": [
    {
      "type": "invoices",
      "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "attributes": {
        "visit_id": "550e8400-e29b-41d4-a716-446655440000",
        "record_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
        "total_amount": "1500.00",
        "status": "PENDING",
        "paid_at": null,
        "created_at": "2026-08-26T01:10:01.000Z",
        "updated_at": "2026-08-26T01:10:01.000Z"
      }
    }
  ],
  "meta": { "timestamp": "2026-08-26T01:10:05.000Z" },
  "links": { "self": "/invoices/550e8400-e29b-41d4-a716-446655440000" }
}
```

### Step 7: Invoice Payment Settlement (Finance)
```http
PATCH http://localhost:3002/invoices/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d/pay
Authorization: Bearer <finance_access_token>
Content-Type: application/json

{
  "status": "PAID"
}
```
**Response (`200 OK`):**
```json
{
  "status": { "code": 200000, "message": "Request Succeeded" },
  "data": {
    "type": "invoices",
    "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "attributes": {
      "visit_id": "550e8400-e29b-41d4-a716-446655440000",
      "record_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "total_amount": "1500.00",
      "status": "PAID",
      "paid_at": "2026-08-26T01:15:00.000Z",
      "created_at": "2026-08-26T01:10:01.000Z",
      "updated_at": "2026-08-26T01:15:00.000Z"
    }
  },
  "meta": { "timestamp": "2026-08-26T01:15:00.000Z" },
  "links": { "self": "/invoices/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d/pay" }
}
```
*(Finance updates invoice to `PAID` and publishes `invoice.paid`)*

### Step 8: Visit Closed Automatically (OPD)
```http
GET http://localhost:3000/visits/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <access_token>
```
**Response (`200 OK`):**
```json
{
  "status": { "code": 200000, "message": "Request Succeeded" },
  "data": {
    "type": "visits",
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "attributes": {
      "patient_id": "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
      "status": "CLOSED",
      "visit_date": "2026-08-26T01:06:00.000Z",
      "updated_at": "2026-08-26T01:15:01.000Z"
    }
  },
  "meta": { "timestamp": "2026-08-26T01:15:05.000Z" },
  "links": { "self": "/visits/550e8400-e29b-41d4-a716-446655440000" }
}
```

---

## 6. Docker Infrastructure Setup

The infrastructure services are defined in `docker-compose.yml`:

```bash
# Start all infrastructure containers in the background
docker compose up -d

# Check container health status
docker compose ps

# View infrastructure logs
docker compose logs -f
```

### Services Started
- **PostgreSQL 16**: Port `5432` (Initializes databases `opd_db`, `emr_db`, `finance_db`, and `iam_db` via `docker/postgres/init.sql`)
- **RabbitMQ 3 Management**: Port `5672` (AMQP) and Port `15672` (Management UI - user `guest` / pass `guest`)
- **Redis 7**: Port `6379` (Persistent cache and session store)

---

## 7. Environment Variables Reference

Defined in `his-project/.env` (copied from `his-project/.env.example`):

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `OPD_PORT` | `3000` | HTTP listening port for OPD Service |
| `EMR_PORT` | `3001` | HTTP listening port for EMR Service |
| `FINANCE_PORT` | `3002` | HTTP listening port for Finance Service |
| `IAM_PORT` | `3003` | HTTP listening port for IAM Service |
| `SERVICE_VERSION` | `0.0.1` | Application version for structured logging metadata |
| `LOG_LEVEL` | `debug` | Minimum log output level (`debug`, `info`, `warn`, `error`) |
| `POSTGRES_HOST` | `localhost` | PostgreSQL host |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `POSTGRES_USERNAME` | `postgres` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `postgres` | PostgreSQL password |
| `OPD_DATABASE` | `opd_db` | Logical database name for OPD Service |
| `EMR_DATABASE` | `emr_db` | Logical database name for EMR Service |
| `FINANCE_DATABASE` | `finance_db` | Logical database name for Finance Service |
| `IAM_DATABASE` | `iam_db` | Logical database name for IAM Service |
| `RABBITMQ_URL` | `amqp://guest:guest@localhost:5672` | RabbitMQ connection URL |
| `RABBITMQ_EXCHANGE` | `his.events` | Topic exchange name for domain events |
| `OPD_RABBITMQ_QUEUE` | `opd.events` | Durable queue name for OPD event consumer |
| `EMR_RABBITMQ_QUEUE` | `emr.events` | Durable queue name for EMR event consumer |
| `FINANCE_RABBITMQ_QUEUE` | `finance.events` | Durable queue name for Finance event consumer |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | *(empty)* | Redis password (optional) |
| `JWT_SECRET` | `his-secret-jwt-key-...` | Secret key for signing access tokens |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Access token expiration duration |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token / Redis session expiration duration |

---

## 8. Installation & Running Locally

### 1. Prerequisites
- **Node.js**: `>= 20.x` (Tested on `22.x`)
- **npm**: `>= 10.x`
- **Docker & Docker Compose**

### 2. Setup
```bash
# 1. Start Docker containers
docker compose up -d

# 2. Navigate to project directory and install dependencies
cd his-project
npm install

# 3. Create local environment file
cp .env.example .env
```

### 3. Running Services

#### Run all services concurrently (Recommended for development):
```bash
npm run start:all
```

#### Run individual services:
```bash
npm run start:iam       # IAM Service (Port 3003)
npm run start:dev       # OPD Service (Port 3000)
npm run start:emr       # EMR Service (Port 3001)
npm run start:finance   # Finance Service (Port 3002)
```

#### Run production builds:
```bash
npm run build
npm run start:prod:iam
npm run start:prod:opd
npm run start:prod:emr
npm run start:prod:finance
```

---

## 9. Testing & Quality Verification

All commands execute from the `his-project/` directory:

```bash
# Run all unit and integration test suites
npm test

# Run service-specific unit tests
npm run test:iam
npm run test:opd
npm run test:emr
npm run test:finance

# Run end-to-end tests for all four microservices
npm run test:e2e

# Run IAM-specific E2E tests
npm run test:iam:e2e

# Run unit tests with code coverage analysis
npm run test:cov

# Run ESLint code quality and naming conventions check
npm run lint:check

# Fix autofixable lint errors
npm run lint

# Compile all microservices via Nest CLI and Webpack
npm run build

# Run live HTTP and RabbitMQ event choreography flow test
npm run test:flow
```

### 🔹 Verified Test Results
- **Unit & Integration Tests**: 47 test suites, 235 tests passed (100% pass rate)
- **End-to-End (E2E) Tests**: 4 test suites, 22 tests passed (100% pass rate)
  - `apps/opd-bc/test/e2e/app.e2e-spec.ts` (4 passed)
  - `apps/emr-bc/test/e2e/app.e2e-spec.ts` (4 passed)
  - `apps/finance-bc/test/e2e/app.e2e-spec.ts` (3 passed)
  - `apps/iam-bc/test/e2e/auth.e2e-spec.ts` (11 passed - Register, Conflict, Login, Me, Refresh, Logout, Cross-Service 401/403 RBAC)
- **Linter**: 0 errors, 0 warnings
- **Build**: Successfully compiles `opd-bc`, `emr-bc`, `finance-bc`, `iam-bc`

---

## 10. Continuous Integration (CI)

GitHub Actions workflow is configured in `.github/workflows/ci.yml`. On every push and pull request against `develop` and `main`, CI executes:
1. **Container Initialization**: Starts PostgreSQL 16, RabbitMQ 3, and Redis 7 service containers.
2. **Database Provisioning**: Creates `opd_db`, `emr_db`, `finance_db`, and `iam_db`.
3. **Linter Gate**: Executes `npm run lint:check`.
4. **Unit Test Gate**: Executes `npm run test:cov`.
5. **Build Gate**: Executes `npm run build`.
6. **E2E Test Gate**: Executes `npm run test:e2e`.
7. **Live Flow Gate**: Boots all four production services in the background and executes `npm run test:flow` with deferred event consumers.

---

## 11. Project Structure

```text
his-microservices-assignment/
├── docker-compose.yml              # PostgreSQL 16, RabbitMQ 3, Redis 7 services
├── docker/
│   └── postgres/
│       └── init.sql                # Database initialization (opd_db, emr_db, finance_db, iam_db)
├── .github/
│   └── workflows/
│       └── ci.yml                  # Full CI pipeline definition
└── his-project/
    ├── package.json                # Monorepo scripts and dependencies
    ├── tsconfig.json               # Path aliases (@app/common, @app/contracts)
    ├── apps/
    │   ├── iam-bc/                 # IAM Microservice (Port 3003)
    │   │   ├── src/modules/auth/   # Auth controller, service, password hasher, DTOs
    │   │   ├── src/modules/user/   # User entity (users table), users service
    │   │   └── test/               # Unit & E2E tests (auth.e2e-spec.ts)
    │   ├── opd-bc/                 # OPD Microservice (Port 3000)
    │   │   ├── src/modules/patient/# Patient controller, service, entity
    │   │   ├── src/modules/visit/  # Visit controller, service, entity, event consumer
    │   │   └── test/               # Unit & E2E tests
    │   ├── emr-bc/                 # EMR Microservice (Port 3001)
    │   │   ├── src/modules/medical-record/ # Medical record controller, service, entity, consumer
    │   │   └── test/               # Unit & E2E tests
    │   └── finance-bc/             # Finance Microservice (Port 3002)
    │       ├── src/modules/invoice/# Invoice controller, service, entity, payment handler, consumer
    │       └── test/               # Unit & E2E tests
    └── libs/
        ├── common/                 # Shared Infrastructure & Security Library
        │   ├── src/auth/           # JwtAuthGuard, RolesGuard, @Roles, @Public, @CurrentUser
        │   ├── src/redis/          # RedisModule, RedisService (Session storage & Blacklist)
        │   ├── src/filters/        # AllExceptionsFilter (Standard JSON:API errors)
        │   ├── src/interceptors/   # TransformInterceptor (Standard JSON:API envelopes)
        │   ├── src/logging/        # StructuredLogger (Single-line JSON logs with tracing)
        │   ├── src/outbox/         # OutboxModule, OutboxEventsService, OutboxEvent entity
        │   ├── src/idempotency/    # IdempotencyModule, IdempotencyService, ProcessedEvent entity
        │   └── src/testing/        # Testing utilities and Redis mock helpers
        └── contracts/              # Shared Event Contracts (visit.created, treatment.completed, invoice.paid)
```

---

## 12. Implementation Status

- [x] **Monorepo Architecture**: 4 isolated bounded contexts (`opd-bc`, `emr-bc`, `finance-bc`, `iam-bc`)
- [x] **Database Isolation**: 4 logical databases (`opd_db`, `emr_db`, `finance_db`, `iam_db`) with zero cross-database joins
- [x] **Event Choreography**: RabbitMQ Topic Exchange `his.events` with durable queues (`opd.events`, `emr.events`, `finance.events`)
- [x] **Transactional Outbox**: Guaranteed message publishing via local `outbox_events` table and background polling
- [x] **Consumer Idempotency**: Duplicate event suppression via `processed_events` table
- [x] **Stateful Authentication**: Access Token (15m) + Refresh Token (7d) with Redis session storage and token-theft rotation
- [x] **Immediate Revocation**: Token blacklisting via Redis on user logout
- [x] **Role-Based Access Control (RBAC)**: `RolesGuard` protecting endpoints across all microservices (`ADMIN`, `DOCTOR`, `NURSE`, `FINANCE_STAFF`, `PATIENT`)
- [x] **Standard Response Protocol**: 100% compliance with Enterprise Backend Blueprint JSON:API envelopes and business codes
- [x] **Structured Observability**: JSON logging with distributed tracing correlation (`x-trace-id`, `x-correlation-id`, `x-span-id`)
- [x] **Automated Testing Suite**: 47 unit test suites (235 passed), 4 E2E test suites (22 passed), 0 lint errors, green build
