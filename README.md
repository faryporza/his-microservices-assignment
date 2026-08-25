<div align="center">

# Hospital Information System (HIS) Microservices

### Production-Ready Event-Driven Microservices Architecture with NestJS 11, PostgreSQL, RabbitMQ & Redis

ระบบสารสนเทศโรงพยาบาลระดับองค์กร (Hospital Information System) ที่ออกแบบตามมาตรฐาน **[Enterprise Backend Blueprint](https://iots1.github.io/enterprise-backend-blueprint/)**<br>
แบ่งแยกขอบเขตการทำงานออกเป็น 4 Bounded Contexts (**IAM**, **OPD**, **EMR**, **Finance**)<br>
พร้อมระบบความปลอดภัย Stateful JWT Authentication & Role-Based Access Control (RBAC), Transactional Outbox Pattern และ Idempotent Event Consumers

[![NestJS](https://img.shields.io/badge/NestJS-11.0-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16.0-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-3.x-FF6600?logo=rabbitmq&logoColor=white)](https://www.rabbitmq.com/)
[![Redis](https://img.shields.io/badge/Redis-7.x-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Unit Tests](https://img.shields.io/badge/Unit_Tests-47%20Suites%20%7C%20235%20Passed-brightgreen)](https://jestjs.io/)
[![E2E Tests](https://img.shields.io/badge/E2E_Tests-4%20Suites%20%7C%2023%20Passed-brightgreen)](https://jestjs.io/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

---

## 1. ขอบเขตและสถาปัตยกรรมระบบ (System Architecture)

ระบบประกอบด้วย 4 Microservices แยกเป็นอิสระภายใน Monorepo (`his-project/apps/`):

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

### 🔹 Bounded Contexts Matrix

| Microservice | Bounded Context | Port | Logical Database | บทบาทและหน้าที่หลัก | OpenAPI Docs |
| :--- | :--- | ---: | :--- | :--- | :--- |
| **`iam-bc`** | **IAM** | `3003` | `iam_db` | ยืนยันตัวตน, ลงทะเบียน, Login, Token Refresh/Revocation, RBAC | [http://localhost:3003/docs](http://localhost:3003/docs) |
| **`opd-bc`** | **OPD** | `3000` | `opd_db` | จัดการข้อมูลผู้ป่วย (Patient), เปิด/ปิด Visit ของผู้ป่วย | [http://localhost:3000/docs](http://localhost:3000/docs) |
| **`emr-bc`** | **EMR** | `3001` | `emr_db` | บันทึกเวชระเบียน (Medical Records), สรุปผลการรักษาและค่ารักษา | [http://localhost:3001/docs](http://localhost:3001/docs) |
| **`finance-bc`**| **Finance** | `3002` | `finance_db` | จัดการใบแจ้งหนี้ (Invoice), ตรวจสอบและบันทึกการชำระเงิน | [http://localhost:3002/docs](http://localhost:3002/docs) |

> 🔒 **Zero Cross-Database Joins Rule**: แต่ละ Service เชื่อมต่อเฉพาะ Logical Database ของตนเองเท่านั้น ไม่มีการ Query ข้าม Database หรือทำ Distributed Transaction ข้าม Service ข้อมูลเชื่อมโยงกันด้วย UUID เท่านั้น

---

## 2. เริ่มต้นใช้งานด่วน (Quick Start)

### สิ่งที่ต้องเตรียม (Prerequisites)
- **Node.js**: `>= 20.x` (แนะนำ `22.x`)
- **npm**: `>= 10.x`
- **Docker Desktop** หรือ **Docker Engine & Compose**

### 1. รัน Infrastructure Containers
รันคำสั่งจาก Root Directory ของ Repository:
```bash
docker compose up -d
```
*บริการที่เริ่มทำงาน:*
- **PostgreSQL 16**: `localhost:5432` (สร้าง `opd_db`, `emr_db`, `finance_db`, `iam_db` อัตโนมัติจาก `docker/postgres/init.sql`)
- **RabbitMQ 3 Management**: `localhost:5672` (AMQP) และ [http://localhost:15672](http://localhost:15672) (UI: `guest` / `guest`)
- **Redis 7**: `localhost:6379` (Stateful Session Store & Blacklist)

### 2. ติดตั้ง Dependencies และเตรียม Environment
```bash
cd his-project
npm install
cp .env.example .env
```

### 3. รัน Microservices

#### แบบรันทุก Service พร้อมกัน (Concurrently - แนะนำ):
```bash
npm run start:all
```

#### แบบแยกรันราย Service (Development Mode):
```bash
# Terminal 1 — IAM Service
npm run start:iam

# Terminal 2 — OPD Service
npm run start:dev

# Terminal 3 — EMR Service
npm run start:emr

# Terminal 4 — Finance Service
npm run start:finance
```

---

## 3. วงจรการรักษาและ Event-Driven Flow (Core Workflow)

```mermaid
sequenceDiagram
    autonumber
    actor Staff as บุคลากรโรงพยาบาล
    participant IAM as iam-bc (3003)
    participant OPD as opd-bc (3000)
    participant RMQ as RabbitMQ Broker
    participant EMR as emr-bc (3001)
    participant FIN as finance-bc (3002)

    Staff->>IAM: 1. Login รับ Access Token (POST /auth/login)
    IAM-->>Staff: 200 OK { access_token, refresh_token }

    Staff->>OPD: 2. สร้าง Visit ผู้ป่วย (POST /visits) [Bearer Token]
    OPD->>OPD: บันทึก Visit (สถานะ: OPEN) และบันทึกลง outbox_events
    OPD-)RMQ: Outbox Publisher เผยแพร่ Event: visit.created
    RMQ-)EMR: Consumer รับ Event: visit.created
    EMR->>EMR: บันทึก processed_events และสร้าง Medical Record (สถานะ: WAITING)

    Staff->>EMR: 3. แพทย์บันทึกผลการรักษา (PATCH /records/:id/complete) [Doctor Token]
    EMR->>EMR: อัปเดต Record (COMPLETED) และบันทึกลง outbox_events
    EMR-)RMQ: Outbox Publisher เผยแพร่ Event: treatment.completed (cost: 1500)
    RMQ-)FIN: Consumer รับ Event: treatment.completed
    FIN->>FIN: บันทึก processed_events และสร้าง Invoice (สถานะ: PENDING)

    Staff->>FIN: 4. ชำระเงินค่ารักษา (PATCH /invoices/:id/pay) [Finance Token]
    FIN->>FIN: อัปเดต Invoice (PAID) และบันทึกลง outbox_events
    FIN-)RMQ: Outbox Publisher เผยแพร่ Event: invoice.paid
    RMQ-)OPD: Consumer รับ Event: invoice.paid
    OPD->>OPD: บันทึก processed_events และปิด Visit (สถานะ: CLOSED)
```

### 🔹 Transactional Outbox Pattern
เพื่อแก้ปัญหา Dual-Write ทุก Microservice จัดเก็บ Event ลงตาราง `outbox_events` ใน Local Transaction เดียวกันกับการเปลี่ยนแปลงข้อมูลใน Database จากนั้น `OutboxEventsService` จะทำการดึงข้อมูลมา Publish ไปยัง RabbitMQ และเปลี่ยนสถานะเป็น `PUBLISHED`

### 🔹 Idempotent Event Consumers
ทุก Event Consumer ทำงานร่วมกับตาราง `processed_events` (`event_id` UNIQUE) เพื่อตรวจสอบว่า Event ID ดังกล่าวได้รับการประมวลผลไปแล้วหรือไม่ ป้องกันการทำงานซ้ำซ้อนในสภาวะ At-Least-Once Delivery

---

## 4. ระบบความปลอดภัย, Authentication และ RBAC (IAM)

ระบบใช้ **Stateful JWT Authentication** ร่วมกับ **Redis 7 Session Store** และ **Role-Based Access Control (RBAC)**:

```mermaid
flowchart TD
    Req[Incoming HTTP Request] --> AuthCheck{Has @Public?}
    AuthCheck -- Yes --> Handler[Execute Route Handler]
    AuthCheck -- No --> Guard[JwtAuthGuard]
    
    Guard --> VerifyJWT{Valid JWT Signature & Exp?}
    VerifyJWT -- No --> Err401A[401 Unauthorized: Invalid/Expired Token]
    VerifyJWT -- Yes --> BlacklistCheck{Blacklisted in Redis?}
    
    BlacklistCheck -- Yes --> Err401B[401 Unauthorized: Revoked Token]
    BlacklistCheck -- No --> SessionCheck{Active Session in Redis?}
    
    SessionCheck -- Redis Down --> Err503[503 Service Unavailable: Fail-Closed]
    SessionCheck -- No --> Err401C[401 Unauthorized: Session Expired]
    SessionCheck -- Yes --> RoleGuard[RolesGuard]
    
    RoleGuard --> RoleCheck{User Role Matches @Roles?}
    RoleCheck -- No --> Err403[403 Forbidden: Insufficient Permissions]
    RoleCheck -- Yes --> Handler
```

### 🔹 Token & Session Management
1. **Access Token (15 นาที)**: Payload ประกอบด้วย `sub` (User ID), `username`, `role`, `sid` (Session ID), และ `jti` (Token ID)
2. **Refresh Token (7 วัน)**: Payload ประกอบด้วย `sub`, `sid`, และ `jti`
3. **Stateful Session Store (Redis)**: จัดเก็บสถานะ Session ที่ `auth:session:{userId}:{sessionId}` (TTL 7 วัน)
4. **Token Rotation & Token-Theft Protection**: เมื่อเรียก `POST /auth/refresh` ระบบจะ Rotate Token คู่ใหม่ หากพบการนำ Refresh Token เก่าที่ถูกใช้ไปแล้วมาใช้ซ้ำ ระบบจะถือว่าเกิดการขโมย Token และทำการ **Revoke ทุก Session ของผู้ใช้นั้นทันที**
5. **Instant Revocation on Logout**: เมื่อเรียก `POST /auth/logout` ระบบจะลบ Session ใน Redis และขึ้น Blacklist Access Token `jti` (`auth:blacklist:{jti}`) ตามเวลาอายุที่เหลืออยู่
6. **Fail-Closed Resilience**: หาก Redis ขัดข้อง `JwtAuthGuard` จะปฏิเสธคำขอและตอบกลับด้วย `503 Service Unavailable` ทันทีเพื่อความปลอดภัย

### 🔹 บทบาทและสิทธิ์การเข้าถึง (RBAC Matrix)

ระบบกำหนด 5 บทบาทตาม `UserRole` enum (`ADMIN`, `DOCTOR`, `NURSE`, `FINANCE_STAFF`, `PATIENT`):

| Endpoint | Method | Path | Required Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/auth/register` | `@Public()` | ลงทะเบียนผู้ใช้ใหม่ |
| **Auth** | `POST` | `/auth/login` | `@Public()` | ยืนยันตัวตนและรับ Token Pair |
| **Auth** | `POST` | `/auth/refresh` | `@Public()` | ต่ออายุ Access/Refresh Token |
| **Auth** | `POST` | `/auth/logout` | `All Authenticated` | ยกเลิก Session และขึ้น Blacklist |
| **Auth** | `GET` | `/auth/me` | `All Authenticated` | เรียกดูข้อมูลโปรไฟล์ตนเอง |
| **OPD** | `POST` | `/patients` | `ADMIN`, `DOCTOR`, `NURSE` | ลงทะเบียนผู้ป่วยใหม่ |
| **OPD** | `GET` | `/patients` | `ADMIN`, `DOCTOR`, `NURSE` | ดูรายชื่อผู้ป่วยทั้งหมด |
| **OPD** | `GET` | `/patients/:id` | `ADMIN`, `DOCTOR`, `NURSE`, `PATIENT` | ดูข้อมูลผู้ป่วยรายบุคคล |
| **OPD** | `PATCH` | `/patients/:id` | `ADMIN`, `DOCTOR`, `NURSE` | แก้ไขข้อมูลผู้ป่วย |
| **OPD** | `DELETE` | `/patients/:id` | `ADMIN`, `DOCTOR`, `NURSE` | ลบข้อมูลผู้ป่วย |
| **OPD** | `POST` | `/visits` | `ADMIN`, `DOCTOR`, `NURSE` | เปิด Visit ผู้ป่วย |
| **OPD** | `GET` | `/visits` | `ADMIN`, `DOCTOR`, `NURSE` | ดูรายการ Visit ทั้งหมด |
| **OPD** | `GET` | `/visits/:id` | `ADMIN`, `DOCTOR`, `NURSE`, `PATIENT` | ดูรายละเอียด Visit |
| **OPD** | `GET` | `/patients/:patientId/visits` | `ADMIN`, `DOCTOR`, `NURSE`, `PATIENT` | ดูประวัติ Visit ของผู้ป่วย |
| **EMR** | `POST` | `/records` | `DOCTOR` | สร้างเวชระเบียน |
| **EMR** | `PATCH` | `/records/:id` | `DOCTOR` | อัปเดตรายละเอียดเวชระเบียน |
| **EMR** | `PATCH` | `/records/:id/complete` | `DOCTOR` | สรุปผลการรักษาและค่ารักษา |
| **EMR** | `GET` | `/records` | `DOCTOR`, `NURSE`, `ADMIN`, `PATIENT` | ดูเวชระเบียนทั้งหมด |
| **EMR** | `GET` | `/records/:id` | `DOCTOR`, `NURSE`, `ADMIN`, `PATIENT` | ดูเวชระเบียนรายอัน |
| **EMR** | `GET` | `/records/visit/:visitId` | `DOCTOR`, `NURSE`, `ADMIN`, `PATIENT` | ดูเวชระเบียนตาม Visit ID |
| **Finance**| `PATCH` | `/invoices/:id/pay` | `FINANCE_STAFF`, `ADMIN` | ชำระเงินค่ารักษา |
| **Finance**| `GET` | `/invoices` | `FINANCE_STAFF`, `ADMIN` | ดูรายการใบแจ้งหนี้ทั้งหมด |
| **Finance**| `GET` | `/invoices/:visitId` | `FINANCE_STAFF`, `ADMIN`, `PATIENT` | ดูใบแจ้งหนี้ตาม Visit ID |
| **Health** | `GET` | `/`, `/health` | `@Public()` | ตรวจสอบสถานะการทำงานของ Service |

---

## 5. มาตรฐาน API Response & Error Handling (Blueprint Compliant)

API ทั้งหมดตอบกลับตามมาตรฐาน **JSON:API Envelope** อัตโนมัติ:

### 🔹 Success Response Envelope
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
      "first_name": "สมชาย",
      "last_name": "ใจดี",
      "id_card": "1234567890123"
    }
  },
  "meta": { "timestamp": "2026-08-26T00:00:00.000Z" },
  "links": { "self": "/patients" }
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
  "meta": { "timestamp": "2026-08-26T00:00:00.000Z" },
  "links": { "self": "/records" }
}
```

| HTTP Status | Business Code | Exception Class | สถานการณ์ที่เกิดขึ้น |
| :--- | :--- | :--- | :--- |
| `400 Bad Request` | `400001` | `ValidationException` | ข้อมูลใน Request Body ไม่ผ่าน Validation (`class-validator`) |
| `400 Bad Request` | `400002` | `InvalidParameterException` | Path / Query Parameter ไม่ถูกต้อง |
| `401 Unauthorized` | `401` | `UnauthorizedException` | ไม่มี Token, Token หมดอายุ, ถูก Blacklist หรือ Login ไม่ถูกต้อง |
| `403 Forbidden` | `403` | `ForbiddenException` | บทบาทผู้ใช้ (Role) ไม่มีสิทธิ์เข้าถึง Endpoint |
| `404 Not Found` | `404` | `NotFoundException` | ไม่พบข้อมูลที่ต้องการในระบบ |
| `409 Conflict` | `409` | `ConflictException` | ข้อมูลซ้ำซ้อน เช่น Username/Email ซ้ำ หรือบันทึกชำระเงินซ้ำ |
| `503 Service Unavailable` | `503` | `ServiceUnavailableException` | Database หรือ Redis ใช้งานไม่ได้ (Fail-closed) |

---

## 6. ตัวแปรสภาพแวดล้อม (Environment Variables)

กำหนดค่าทั้งหมดในไฟล์ `.env` (คัดลอกจาก `.env.example`):

| Variable | Example / Default | Description |
| :--- | :--- | :--- |
| `OPD_PORT` | `3000` | HTTP Port สำหรับ OPD Service |
| `EMR_PORT` | `3001` | HTTP Port สำหรับ EMR Service |
| `FINANCE_PORT` | `3002` | HTTP Port สำหรับ Finance Service |
| `IAM_PORT` | `3003` | HTTP Port สำหรับ IAM Service |
| `SERVICE_VERSION` | `0.0.1` | Application Version สำหรับ Structured JSON Logger |
| `LOG_LEVEL` | `debug` | ระดับการแสดงผล Log (`debug`, `info`, `warn`, `error`) |
| `POSTGRES_HOST` | `localhost` | PostgreSQL Host Address |
| `POSTGRES_PORT` | `5432` | PostgreSQL Port |
| `POSTGRES_USERNAME`| `postgres` | Database Username |
| `POSTGRES_PASSWORD`| `postgres` | Database Password |
| `OPD_DATABASE` | `opd_db` | Logical Database Name สำหรับ OPD |
| `EMR_DATABASE` | `emr_db` | Logical Database Name สำหรับ EMR |
| `FINANCE_DATABASE`| `finance_db` | Logical Database Name สำหรับ Finance |
| `IAM_DATABASE` | `iam_db` | Logical Database Name สำหรับ IAM |
| `RABBITMQ_URL` | `amqp://guest:guest@localhost:5672` | RabbitMQ Connection URL |
| `RABBITMQ_EXCHANGE`| `his.events` | Topic Exchange Name กลางสำหรับ Domain Events |
| `OPD_RABBITMQ_QUEUE` | `opd.events` | Durable Queue Name สำหรับ OPD Consumer |
| `EMR_RABBITMQ_QUEUE` | `emr.events` | Durable Queue Name สำหรับ EMR Consumer |
| `FINANCE_RABBITMQ_QUEUE` | `finance.events` | Durable Queue Name สำหรับ Finance Consumer |
| `REDIS_HOST` | `localhost` | Redis Host Address |
| `REDIS_PORT` | `6379` | Redis Port |
| `REDIS_PASSWORD` | *(empty)* | Redis Password (ถ้ามี) |
| `JWT_SECRET` | `his-secret-jwt-key-...` | Secret Key สำหรับลงลายมือชื่อ JWT Token |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | อายุการใช้งานของ Access Token |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | อายุการใช้งานของ Refresh Token / Redis Session |

---

## 7. คำสั่งทดสอบและการตรวจสอบคุณภาพ (Testing & Quality Gates)

รันคำสั่งทั้งหมดจากโฟลเดอร์ `his-project/`:

```bash
# 1. รัน Unit Tests ทั้งหมดใน Monorepo (47 Test Suites, 235 Tests)
npm test

# 2. รัน Unit Tests แยกตาม Microservice
npm run test:iam
npm run test:opd
npm run test:emr
npm run test:finance

# 3. รัน End-to-End Tests ทั้ง 4 Microservices (รวม Security & RBAC)
npm run test:e2e

# 4. รัน E2E Test เฉพาะ IAM Service
npm run test:iam:e2e

# 5. ตรวจสอบ Code Coverage (Unit & Integration)
npm run test:cov

# 6. ตรวจสอบ Code Quality และ Naming Conventions (ESLint)
npm run lint:check

# 7. คอมไพล์ Monorepo ทุก Service
npm run build

# 8. ทดสอบ Live HTTP + RabbitMQ Flow (ต้องรัน Infrastructure ก่อน)
npm run test:flow
```

### 🔹 ผลการทดสอบที่ผ่านการตรวจสอบแล้ว (Verified Test Status)
- ✅ **Unit Tests**: ผ่าน 100% (`47/47` test suites, `235/235` tests passing)
- ✅ **E2E Tests**: ผ่าน 100% (`4/4` test suites, `23/23` tests passing across OPD, EMR, Finance, IAM)
- ✅ **Cross-Service RBAC**: ผ่านการทดสอบการแยกสิทธิ์ระหว่าง `DOCTOR`, `FINANCE_STAFF`, `ADMIN`, `PATIENT`
- ✅ **ESLint Linter**: `0` errors, `0` warnings
- ✅ **TypeScript Build**: คอมไพล์ผ่านสมบูรณ์ทั้ง 4 Microservices

---

## 8. โครงสร้างโปรเจกต์ (Project Structure)

```text
his-microservices-assignment/
├── docker-compose.yml              # PostgreSQL 16, RabbitMQ 3, Redis 7
├── docker/postgres/init.sql        # Database initialization script (opd_db, emr_db, finance_db, iam_db)
├── .github/workflows/ci.yml        # GitHub Actions CI Workflow
└── his-project/
    ├── apps/
    │   ├── iam-bc/                 # Identity & Access Management Service (Port 3003)
    │   │   ├── src/modules/auth/   # Auth Controller, Service, PasswordHashService, DTOs
    │   │   ├── src/modules/user/   # User Entity (users table), Users Service
    │   │   └── test/               # Unit & E2E Tests (auth.e2e-spec.ts)
    │   ├── opd-bc/                 # Outpatient Department Service (Port 3000)
    │   │   ├── src/modules/patient/# Patient Controller, Service, Entity
    │   │   └── src/modules/visit/  # Visit Controller, Service, Entity, Event Consumers
    │   ├── emr-bc/                 # Electronic Medical Records Service (Port 3001)
    │   │   └── src/modules/medical-record/ # Medical Records Controller, Service, Entity
    │   └── finance-bc/             # Finance & Invoices Service (Port 3002)
    │       └── src/modules/invoice/# Invoice Controller, Service, Entity, Payment Handler
    └── libs/
        ├── common/                 # Reusable Core Infrastructure & Security Library
        │   ├── src/auth/           # JwtAuthGuard, RolesGuard, @Roles, @Public, @CurrentUser
        │   ├── src/redis/          # RedisModule, RedisService (Session Store, Blacklist)
        │   ├── src/filters/        # AllExceptionsFilter (Blueprint JSON:API Error Format)
        │   ├── src/interceptors/   # TransformInterceptor (JSON:API Success Envelope)
        │   ├── src/logging/        # StructuredLogger (Single-line JSON Logging & Tracing)
        │   ├── src/outbox/         # Outbox Module & Service (Transactional Outbox Pattern)
        │   ├── src/idempotency/    # Idempotency Service (ProcessedEvent Entity)
        │   └── src/testing/        # Test Helpers (createMockJwtToken, createMockRedisService)
        └── contracts/              # Shared Event Contracts (visit.created, etc.)
```

---

## 9. สรุปความสมบูรณ์ของระบบ (Implementation Status)

- ✅ **Authentication & Stateful Sessions**: ลงทะเบียนผู้ใช้, Login, Token Refresh/Rotation, Stateful Logout, Blacklist (`iam-bc`, Redis 7)
- ✅ **Role-Based Access Control (RBAC)**: `RolesGuard`, `@Roles()` Decorator และการป้องกัน Endpoint ทั้ง 4 Services
- ✅ **Event-Driven Choreography**: Durable RabbitMQ Exchange & Queues (`visit.created`, `treatment.completed`, `invoice.paid`)
- ✅ **Data Reliability**: Transactional Outbox Pattern & Idempotent Event Consumers
- ✅ **Database Isolation**: แยก 4 Logical Databases โดยไม่มี Cross-DB Joins
- ✅ **Enterprise Blueprint Compliance**: มาตรฐาน JSON:API Envelope และ Business Status Codes
- ✅ **Observability & Auditability**: Structured JSON Logging พร้อม Distributed Tracing Headers (`x-trace-id`, `x-correlation-id`, `x-span-id`)
- ✅ **Interactive API Docs**: Swagger UI พร้อมใช้งานครบทุก Microservice บน `/docs`
