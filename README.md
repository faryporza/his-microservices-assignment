<div align="center">

# Hospital Information System (HIS)

### Event-Driven Microservices with NestJS, RabbitMQ, PostgreSQL & Redis

ระบบสารสนเทศโรงพยาบาลที่แยกความรับผิดชอบออกเป็น 4 Bounded Contexts ได้แก่ **IAM**, **OPD**, **EMR** และ **Finance**<br>
แต่ละ service มีฐานข้อมูลแบบ Logical Database แยกขาดจากกัน สื่อสารข้าม service แบบ Asynchronous ผ่าน RabbitMQ Events<br>
และรักษาความปลอดภัยด้วย Stateful JWT Authentication & Role-Based Access Control (RBAC) ตามมาตรฐาน [Enterprise Backend Blueprint](https://iots1.github.io/enterprise-backend-blueprint/)

</div>

---

## 1. ภาพรวมระบบ (System Overview)

ระบบรองรับวงจรการรักษาและบริหารจัดการข้อมูลโรงพยาบาล ตั้งแต่การยืนยันตัวตน, การลงทะเบียนผู้ป่วย, การบันทึกเวชระเบียน, การออกใบแจ้งหนี้, จนถึงการปิด Visit หลังชำระเงิน:

```text
User Authentication & RBAC (IAM)
       │
       ▼
Patient → Visit (OPEN) → Medical Record (WAITING)
        → Treatment (COMPLETED) → Invoice (PENDING)
        → Payment (PAID) → Visit (CLOSED)
```

### 🔹 Bounded Contexts & Services Matrix

| Bounded Context | App Name | Port | Database | บทบาทและหน้าที่หลัก | Swagger UI |
| :--- | :--- | ---: | :--- | :--- | :--- |
| **IAM** | `iam-bc` | `3003` | `iam_db` | User Identity, Registration, Login, Token Refresh/Revocation, RBAC | [http://localhost:3003/docs](http://localhost:3003/docs) |
| **OPD** | `opd-bc` | `3000` | `opd_db` | Patient Management, Patient Registration, Visit Management | [http://localhost:3000/docs](http://localhost:3000/docs) |
| **EMR** | `emr-bc` | `3001` | `emr_db` | Electronic Medical Records, Clinical Diagnosis, Treatment Notes | [http://localhost:3001/docs](http://localhost:3001/docs) |
| **Finance** | `finance-bc` | `3002` | `finance_db` | Billing, Invoice Management, Payment Processing | [http://localhost:3002/docs](http://localhost:3002/docs) |

> ⚠️ **Database Isolation Rule**: ทุก Microservice เข้าถึงเฉพาะ Logical Database ของตนเองเท่านั้น ไม่มีการทำ Cross-Database Join หรือ Cross-Service Distributed Transactions

---

## 2. สถาปัตยกรรมระบบ (Architecture)

```mermaid
graph TB
    subgraph Clients["Clients / API Consumers"]
        ApiClient[HTTP REST Client / Frontend]
    end

    subgraph Infrastructure["Shared Infrastructure"]
        Postgres[(PostgreSQL 16 Multi-DB)]
        Redis[(Redis 7 Session Store)]
        RabbitMQ[(RabbitMQ 3 Message Broker)]
    end

    subgraph IAM_BC["apps/iam-bc - Port 3003"]
        AuthCtrl[AuthController]
        AuthSvc[AuthService]
        UsersSvc[UsersService]
        IamDB[(iam_db)]
    end

    subgraph OPD_BC["apps/opd-bc - Port 3000"]
        OpdGuards[JwtAuthGuard + RolesGuard]
        OpdCtrl[Patients & Visits Controllers]
        OpdOutbox[Outbox Service]
        OpdDB[(opd_db)]
    end

    subgraph EMR_BC["apps/emr-bc - Port 3001"]
        EmrGuards[JwtAuthGuard + RolesGuard]
        EmrCtrl[MedicalRecords Controller]
        EmrOutbox[Outbox Service]
        EmrDB[(emr_db)]
    end

    subgraph FIN_BC["apps/finance-bc - Port 3002"]
        FinGuards[JwtAuthGuard + RolesGuard]
        FinCtrl[Invoices Controller]
        FinOutbox[Outbox Service]
        FinDB[(finance_db)]
    end

    %% Client calls
    ApiClient -->|1. Register / Login / Refresh| AuthCtrl
    AuthCtrl --> AuthSvc
    AuthSvc --> UsersSvc
    UsersSvc --> IamDB
    AuthSvc -->|Store Session & Blacklist| Redis

    ApiClient -->|2. Protected REST Calls + Bearer Token| OpdCtrl
    ApiClient -->|Protected REST Calls + Bearer Token| EmrCtrl
    ApiClient -->|Protected REST Calls + Bearer Token| FinCtrl

    %% Guard validations
    OpdCtrl --- OpdGuards
    EmrCtrl --- EmrGuards
    FinCtrl --- FinGuards

    OpdGuards -.->|Verify Session & Blacklist| Redis
    EmrGuards -.->|Verify Session & Blacklist| Redis
    FinGuards -.->|Verify Session & Blacklist| Redis

    %% Local DB access
    OpdCtrl --> OpdDB
    EmrCtrl --> EmrDB
    FinCtrl --> FinDB

    %% Event flows via Outbox and RabbitMQ
    OpdCtrl --> OpdOutbox
    OpdOutbox -.->|visit.created| RabbitMQ
    RabbitMQ -.->|visit.created| EmrCtrl

    EmrCtrl --> EmrOutbox
    EmrOutbox -.->|treatment.completed| RabbitMQ
    RabbitMQ -.->|treatment.completed| FinCtrl

    FinCtrl --> FinOutbox
    FinOutbox -.->|invoice.paid| RabbitMQ
    RabbitMQ -.->|invoice.paid| OpdCtrl
```

---

## 3. ระบบความปลอดภัย, Authentication และ RBAC (IAM)

ระบบใช้สถาปัตยกรรม **Stateful JWT Authentication** ร่วมกับ **Redis Session Store** และ **Role-Based Access Control (RBAC)**:

### 🔹 Token Lifecycle & Session Architecture
1. **Access Token (Short-lived)**: อายุ 15 นาที (`15m`) บรรจุ payload `sub` (User ID), `username`, `role`, `sid` (Session ID), และ `jti` (Token ID) สำหรับยืนยันตัวตนข้าม service แบบไร้สถานะ
2. **Refresh Token (Long-lived)**: อายุ 7 วัน (`7d`) บรรจุ payload `sub`, `sid`, และ `jti`
3. **Stateful Session Cache (Redis)**: จัดเก็บสถานะ session ที่ `auth:session:{userId}:{sessionId}` และ user session set ที่ `auth:user_sessions:{userId}`
4. **Token Rotation & Token-Theft Detection**: ทุกครั้งที่มีการเรียก `POST /auth/refresh` จะทำการออก Token คู่ใหม่และ rotate `refreshTokenJti` ใน Redis ทันที หากพบว่ามีการนำ Refresh Token เก่าที่ถูก rotate ไปแล้วมาใช้ซ้ำ ระบบจะทำการ **Revoke ทุก session ของผู้ใช้นั้นทันที** (Token Reuse Revocation)
5. **Instant Revocation on Logout**: เมื่อเรียก `POST /auth/logout` ระบบจะลบ session ออกจาก Redis และนำ Access Token `jti` ไปบันทึกลงใน Redis Blacklist (`auth:blacklist:{jti}`) ตามเวลาอายุที่เหลืออยู่
6. **Fail-Closed Resilience**: หาก Redis ขัดข้อง ชั่วคราว `JwtAuthGuard` จะปฏิเสธคำขอและตอบกลับด้วย `503 Service Unavailable` อย่างปลอดภัยโดยไม่ปล่อยให้ unauthenticated request ผ่านเข้าสู่ระบบ

### 🔹 บทบาทและสิทธิ์การเข้าถึง (RBAC Matrix)

ระบบแบ่งบทบาทผู้ใช้งานออกเป็น 5 บทบาทหลักใน `UserRole` enum:

| Endpoint | Method | Path | Allowed Roles | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/auth/register` | `@Public()` | ลงทะเบียนผู้ใช้ใหม่ |
| **Auth** | `POST` | `/auth/login` | `@Public()` | เข้าสู่ระบบและรับ Token Pair |
| **Auth** | `POST` | `/auth/refresh` | `@Public()` | ต่ออายุ Access/Refresh Token |
| **Auth** | `POST` | `/auth/logout` | `All Authenticated` | ยกเลิก session และขึ้น Blacklist |
| **Auth** | `GET` | `/auth/me` | `All Authenticated` | ดึงข้อมูลโปรไฟล์ของผู้ใช้ปัจจุบัน |
| **OPD** | `POST` | `/patients` | `ADMIN`, `DOCTOR`, `NURSE` | สร้างข้อมูลผู้ป่วย |
| **OPD** | `GET` | `/patients` | `ADMIN`, `DOCTOR`, `NURSE` | ดูรายชื่อผู้ป่วยทั้งหมด |
| **OPD** | `GET` | `/patients/:id` | `ADMIN`, `DOCTOR`, `NURSE`, `PATIENT` | ดูข้อมูลผู้ป่วยรายคน |
| **OPD** | `PATCH` | `/patients/:id` | `ADMIN`, `DOCTOR`, `NURSE` | แก้ไขข้อมูลผู้ป่วย |
| **OPD** | `DELETE` | `/patients/:id` | `ADMIN`, `DOCTOR`, `NURSE` | ลบข้อมูลผู้ป่วย |
| **OPD** | `POST` | `/visits` | `ADMIN`, `DOCTOR`, `NURSE` | เปิด Visit ผู้ป่วย |
| **OPD** | `GET` | `/visits` | `ADMIN`, `DOCTOR`, `NURSE` | ดูรายการ Visit ทั้งหมด |
| **OPD** | `GET` | `/visits/:id` | `ADMIN`, `DOCTOR`, `NURSE`, `PATIENT` | ดูข้อมูล Visit |
| **OPD** | `GET` | `/patients/:patientId/visits` | `ADMIN`, `DOCTOR`, `NURSE`, `PATIENT` | ดูประวัติ Visit ของผู้ป่วย |
| **EMR** | `POST` | `/records` | `DOCTOR` | บันทึกเวชระเบียนใหม่ |
| **EMR** | `PATCH` | `/records/:id` | `DOCTOR` | แก้ไขเวชระเบียน |
| **EMR** | `PATCH` | `/records/:id/complete` | `DOCTOR` | สรุปผลการรักษาและค่ารักษา |
| **EMR** | `GET` | `/records` | `DOCTOR`, `NURSE`, `ADMIN`, `PATIENT` | ดูเวชระเบียนทั้งหมด |
| **EMR** | `GET` | `/records/:id` | `DOCTOR`, `NURSE`, `ADMIN`, `PATIENT` | ดูเวชระเบียนรายอัน |
| **EMR** | `GET` | `/records/visit/:visitId` | `DOCTOR`, `NURSE`, `ADMIN`, `PATIENT` | ดูเวชระเบียนตาม Visit ID |
| **Finance**| `PATCH` | `/invoices/:id/pay` | `FINANCE_STAFF`, `ADMIN` | บันทึกการชำระเงินของใบแจ้งหนี้ |
| **Finance**| `GET` | `/invoices` | `FINANCE_STAFF`, `ADMIN` | ดูใบแจ้งหนี้ทั้งหมด |
| **Finance**| `GET` | `/invoices/:visitId` | `FINANCE_STAFF`, `ADMIN`, `PATIENT` | ดูใบแจ้งหนี้ตาม Visit ID |
| **Health** | `GET` | `/`, `/health` | `@Public()` | ตรวจสอบสถานะการทำงานของ service |

---

## 4. มาตรฐาน API Response & Error Handling (Blueprint Compliant)

API ทุก Endpoint ถูกหุ้มด้วย **JSON:API Envelope** อัตโนมัติผ่าน `TransformInterceptor` และ `AllExceptionsFilter`:

### 1. Success Response Envelope
```json
{
  "status": {
    "code": 200000,
    "message": "Request Succeeded"
  },
  "data": {
    "type": "resource-name",
    "id": "uuid",
    "attributes": {
      "field_name": "value"
    }
  },
  "meta": {
    "timestamp": "2026-08-26T00:00:00.000Z"
  },
  "links": {
    "self": "/resource-path"
  }
}
```

* **Business Codes**: คำนวณจาก `HTTP Status × 1000` เช่น `200` $\rightarrow$ `200000`, `201` $\rightarrow$ `201000`
* **Resource Structure**: แยก `id` ไประดับบน และรวม properties อื่นไว้ใน `attributes`

### 2. Error Response Envelope
```json
{
  "status": {
    "code": 401,
    "message": "Unauthorized"
  },
  "errors": [
    {
      "code": "401",
      "title": "UnauthorizedException",
      "detail": "Missing, invalid, or revoked authorization token"
    }
  ],
  "meta": {
    "timestamp": "2026-08-26T00:00:00.000Z"
  },
  "links": {
    "self": "/resource-path"
  }
}
```

| Exception Type | HTTP Status | Business Code | สาเหตุ / สถานการณ์ |
| :--- | :--- | :--- | :--- |
| `UnauthorizedException` | `401` | `401` | ไม่มี token, token หมดอายุ, ถูก blacklist, หรือ login ผิดพลาด |
| `ForbiddenException` | `403` | `403` | บทบาทผู้ใช้งานไม่ได้รับอนุญาตให้เข้าถึง Endpoint นี้ |
| `ValidationException` | `400` | `400001` | Body validation ล้มเหลว (`class-validator`) |
| `InvalidParameterException` | `400` | `400002` | Query / Path Param validation ล้มเหลว |
| `NotFoundException` | `404` | `404` | ไม่พบ Resource ในระบบ |
| `ConflictException` | `409` | `409` | ข้อมูลซ้ำซ้อน เช่น username/email ซ้ำ หรือชำระเงินซ้ำ |
| `ServiceUnavailableException` | `503` | `503` | Database หรือ Redis ใช้งานไม่ได้ (Fail-closed) |

---

## 5. Event-Driven Workflow & Transactional Outbox

```mermaid
sequenceDiagram
    autonumber
    actor Patient as ผู้ป่วย / แพทย์ / การเงิน
    participant OPD as opd-bc<br/>(Port 3000)
    participant RMQ as RabbitMQ<br/>(Topic Exchange)
    participant EMR as emr-bc<br/>(Port 3001)
    participant FIN as finance-bc<br/>(Port 3002)

    Patient->>OPD: 1. สร้าง Visit (สถานะ: OPEN)
    OPD->>OPD: บันทึก Visit & Insert Outbox Table (Local Transaction)
    OPD-)RMQ: Outbox Publisher เผยแพร่ Event: visit.created
    RMQ-)EMR: Consumer รับ Event: visit.created
    EMR->>EMR: บันทึก processed_events & เตรียม Medical Record เปล่า (สถานะ: WAITING)

    Note over EMR: แพทย์ทำการรักษาเสร็จสิ้น
    Patient->>EMR: 2. บันทึกผลการรักษา (Complete Treatment)
    EMR->>EMR: อัปเดต Record (COMPLETED) & Insert Outbox Table
    EMR-)RMQ: Outbox Publisher เผยแพร่ Event: treatment.completed (cost: 1500)
    RMQ-)FIN: Consumer รับ Event: treatment.completed
    FIN->>FIN: บันทึก processed_events & สร้าง Invoice (สถานะ: PENDING)

    Patient->>FIN: 3. ชำระเงินค่ารักษา (Pay Invoice)
    FIN->>FIN: อัปเดต Invoice (PAID) & Insert Outbox Table
    FIN-)RMQ: Outbox Publisher เผยแพร่ Event: invoice.paid
    RMQ-)OPD: Consumer รับ Event: invoice.paid
    OPD->>OPD: บันทึก processed_events & อัปเดต Visit (สถานะ: CLOSED)
```

### 🔹 Transactional Outbox Pattern
เพื่อป้องกันเหตุการณ์ Dual-Write (บันทึก Database สำเร็จแต่ส่ง RabbitMQ ล้มเหลว หรือในทางกลับกัน) ทุก microservice ใช้ **Transactional Outbox Pattern**:
1. เมื่อเกิด Business Mutation ข้อมูล Domain Entity และข้อมูล Event จะถูกเขียนลงตาราง `outbox_events` ภายใต้ **Database Transaction เดียวกัน**
2. Background Worker (`OutboxEventsService`) จะทำการดึง Pending Events ขึ้นมาส่งต่อไปยัง RabbitMQ
3. เมื่อส่งสำเร็จจะทำเครื่องหมายสถานะเป็น `PUBLISHED`

### 🔹 Idempotent Consumer Pattern
ทุก Event Consumer ใช้งานตาราง `processed_events` (`event_id` UNIQUE) เพื่อตรวจสอบว่า Event ID นั้นถูกประมวลผลไปแล้วหรือไม่ ป้องกันการทำงานซ้ำในกรณี At-Least-Once Delivery

---

## 6. คู่มือการใช้งาน API (Step-by-Step Flow)

### Step 1: ลงทะเบียนผู้ใช้ (IAM)
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

### Step 2: เข้าสู่ระบบเพื่อรับ Token Pair (IAM)
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
    "id": "doctor-user-uuid",
    "attributes": {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "token_type": "Bearer",
      "expires_in": 900
    }
  }
}
```
> นำ `access_token` ไปใส่ใน Header: `Authorization: Bearer <access_token>` สำหรับทุก Request ถัดไป

### Step 3: สร้าง Patient (OPD)
```http
POST http://localhost:3000/patients
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "hn": "HN-0001",
  "first_name": "สมชาย",
  "last_name": "ใจดี",
  "id_card": "1234567890123"
}
```

### Step 4: สร้าง Visit (OPD)
```http
POST http://localhost:3000/visits
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "patient_id": "<PATIENT_UUID>"
}
```
*(ระบบส่ง event `visit.created` ไปยัง EMR อัตโนมัติ)*

### Step 5: แพทย์บันทึกผลการรักษา (EMR)
```http
PATCH http://localhost:3001/records/<RECORD_UUID>/complete
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "doctor_id": "dr_watson",
  "diagnosis": "ไข้หวัดใหญ่สายพันธุ์ A",
  "treatment_note": "ให้ยา Tamiflu และพักผ่อน 3 วัน",
  "treatment_cost": 1500
}
```
*(ระบบส่ง event `treatment.completed` ไปยัง Finance อัตโนมัติ)*

### Step 6: เจ้าหน้าที่การเงินบันทึกการชำระเงิน (Finance)
*(เข้าสู่ระบบด้วย user ที่มี role `FINANCE_STAFF` หรือ `ADMIN`)*
```http
PATCH http://localhost:3002/invoices/<INVOICE_UUID>/pay
Authorization: Bearer <finance_access_token>
Content-Type: application/json

{
  "status": "PAID"
}
```
*(ระบบส่ง event `invoice.paid` กลับไปยัง OPD เพื่อปิด Visit เป็น `CLOSED` อัตโนมัติ)*

### Step 7: ออกจากระบบ (IAM)
```http
POST http://localhost:3003/auth/logout
Authorization: Bearer <access_token>
```

---

## 7. Configuration & Environment Variables

ตัวแปรสภาพแวดล้อมทั้งหมดถูกโหลดผ่าน `@nestjs/config` จากไฟล์ `.env`:

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `OPD_PORT` | `3000` | HTTP Port สำหรับ OPD Service |
| `EMR_PORT` | `3001` | HTTP Port สำหรับ EMR Service |
| `FINANCE_PORT` | `3002` | HTTP Port สำหรับ Finance Service |
| `IAM_PORT` | `3003` | HTTP Port สำหรับ IAM Service |
| `SERVICE_VERSION` | `0.0.1` | Application Version สำหรับ JSON Logging |
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
| `REDIS_HOST` | `localhost` | Redis Server Host |
| `REDIS_PORT` | `6379` | Redis Server Port |
| `REDIS_PASSWORD` | *(empty)* | Redis Authentication Password (ถ้ามี) |
| `JWT_SECRET` | *(secret)* | Secret Key สำหรับลงลายมือชื่อ JWT Token |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | อายุการใช้งานของ Access Token |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | อายุการใช้งานของ Refresh Token / Redis Session |

---

## 8. การติดตั้งและเริ่มต้นระบบ (Setup & Running)

### ข้อกำหนดเบื้องต้น (Prerequisites)
- **Node.js**: เวอร์ชัน `>= 20.x`
- **npm**: เวอร์ชัน `>= 10.x`
- **Docker Desktop** หรือ **Docker Engine & Compose**

### 1. เริ่มต้น Infrastructure Containers (Postgres, RabbitMQ, Redis)
รันจาก Root Directory ของ Repository:
```bash
docker compose up -d
```
- **PostgreSQL**: `localhost:5432` (พร้อม Logical DBs: `opd_db`, `emr_db`, `finance_db`, `iam_db`)
- **RabbitMQ Management UI**: [http://localhost:15672](http://localhost:15672) (User: `guest` / Pass: `guest`)
- **Redis Server**: `localhost:6379`

### 2. ติดตั้ง Dependencies และตั้งค่า Environment
```bash
cd his-project
npm install
cp .env.example .env
```

### 3. รัน Microservices

#### ทางเลือกที่ 1: รันทุก Service พร้อมกันในหน้าจอเดียว (Concurrently)
```bash
npm run start:all
```

#### ทางเลือกที่ 2: รันแยกทีละ Terminal (Development Mode)
```bash
# Terminal 1 — IAM Service (Port 3003)
npm run start:iam

# Terminal 2 — OPD Service (Port 3000)
npm run start:dev

# Terminal 3 — EMR Service (Port 3001)
npm run start:emr

# Terminal 4 — Finance Service (Port 3002)
npm run start:finance
```

---

## 9. การทดสอบและการตรวจสอบคุณภาพ (Testing & Verification)

รันคำสั่งทั้งหมดจากโฟลเดอร์ `his-project/`:

```bash
# 1. รัน Unit Tests ทั้งหมดใน Monorepo (47 Test Suites, 235 Tests)
npm test

# 2. รัน Unit Test แยกตาม Microservice
npm run test:iam
npm run test:opd
npm run test:emr
npm run test:finance

# 3. รัน End-to-End Tests ทั้ง 4 Microservices (รวม Security & Cross-Service RBAC)
npm run test:e2e

# 4. รัน E2E Test เฉพาะ IAM Service
npm run test:iam:e2e

# 5. ตรวจสอบ Code Coverage
npm run test:cov

# 6. ตรวจสอบ Code Quality และ Naming Convention (ESLint)
npm run lint:check

# 7. คอมไพล์โปรเจกต์ทุก Microservices
npm run build

# 8. ทดสอบ Live HTTP + RabbitMQ Flow
npm run test:flow
```

### 🔹 สถานะการทดสอบปัจจุบัน (Test Status)
- ✅ **Unit Tests**: ผ่าน 100% (47/47 suites, 235/235 tests)
- ✅ **E2E Security & RBAC Tests**: ผ่าน 100% (4/4 suites, 23/23 tests)
- ✅ **ESLint Linter**: 0 errors, 0 warnings
- ✅ **TypeScript Compilation**: ผ่าน 100% ทุก Microservices (`opd-bc`, `emr-bc`, `finance-bc`, `iam-bc`)

---

## 10. โครงสร้างโปรเจกต์ (Project Structure)

```text
his-project/
├── apps/
│   ├── iam-bc/                     # Identity & Access Management (Port 3003)
│   │   ├── src/
│   │   │   ├── modules/auth/       # Auth Controller, Service, PasswordHashService, DTOs
│   │   │   ├── modules/user/       # User Entity (users table), Users Service
│   │   │   └── health-checks/      # Health check probes
│   │   └── test/                   # Unit & E2E Tests (auth.e2e-spec.ts)
│   ├── opd-bc/                     # Outpatient Department Service (Port 3000)
│   │   ├── src/modules/patient/    # Patient Controller, Service, Entity
│   │   └── src/modules/visit/      # Visit Controller, Service, Entity, Event Consumers
│   ├── emr-bc/                     # Electronic Medical Records Service (Port 3001)
│   │   └── src/modules/medical-record/ # Medical Records Controller, Service, Entity
│   └── finance-bc/                 # Finance & Invoices Service (Port 3002)
│       └── src/modules/invoice/    # Invoice Controller, Service, Entity, Payment Handler
└── libs/
    ├── common/                     # Reusable Core Infrastructure & Security Library
    │   ├── src/auth/               # JwtAuthGuard, RolesGuard, @Roles, @Public, @CurrentUser
    │   ├── src/redis/              # RedisModule, RedisService (Session Store, Blacklist)
    │   ├── src/filters/            # AllExceptionsFilter (Blueprint JSON:API Error Format)
    │   ├── src/interceptors/       # TransformInterceptor (JSON:API Success Envelope)
    │   ├── src/logging/            # StructuredLogger (Single-line JSON Logging & Tracing)
    │   ├── src/outbox/             # Outbox Module & Service (Transactional Outbox Pattern)
    │   ├── src/idempotency/        # Idempotency Service (ProcessedEvent Entity)
    │   └── src/testing/            # createMockJwtToken, createMockRedisService, createTestApp
    └── contracts/                  # Event Schemas & Message Definitions (visit.created, etc.)
```

---

## 11. ความสมบูรณ์ของระบบตามข้อกำหนด (Current Implementation Status)

- ✅ **IAM & Authentication**: User Registration, Login, Token Refresh/Rotation, Stateful Logout, Blacklist (`iam-bc`)
- ✅ **Role-Based Access Control**: RBAC Guard (`RolesGuard`), `@Roles()` Decorator และการป้องกัน Endpoint ทั้ง 4 Services
- ✅ **Event-Driven Choreography**: Durable RabbitMQ Exchange & Queues (`visit.created`, `treatment.completed`, `invoice.paid`)
- ✅ **Resilience & Reliability**: Transactional Outbox Pattern & Idempotent Event Consumers
- ✅ **Enterprise Blueprint Compliance**: JSON:API Envelopes, Business Codes (`200000`, `201000`, `400001`, `401`, `403`, `404`, `409`, `503`)
- ✅ **Observability**: Structured JSON Logging พร้อม Distributed Tracing Headers (`x-trace-id`, `x-correlation-id`, `x-span-id`)
- ✅ **OpenAPI / Swagger UI Documentation**: ทุก Microservice บน `/docs` (`3000/docs`, `3001/docs`, `3002/docs`, `3003/docs`)
