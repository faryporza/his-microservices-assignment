---
name: his-microservices-assignment
description: Guide and specifications for Hospital Information System (HIS) Microservices Internship Project
---

# 🏥 โจทย์ฝึกงาน: ระบบ Hospital Information System (HIS) Microservices

**เป้าหมาย:** สร้างระบบจัดการข้อมูลผู้ป่วยแบบ Microservices โดยใช้โครงสร้าง NestJS Monorepo สื่อสารผ่าน RabbitMQ และจัดการฐานข้อมูลแยกจากกัน (Database-per-Service)

---

## 🏗️ 1. Architecture & Infrastructure

### โครงสร้างโปรเจกต์ (NestJS Monorepo)
- **Root Directory:** `his-project/`
- **Applications:** `apps/opd-bc`, `apps/emr-bc`, `apps/finance-bc`
- **Shared Libraries:** `libs/contracts`, `libs/common`

### Microservices & Ports Matrix:
| Service Name | Port | Responsibilities (หน้าที่หลัก) | Database Schema |
| :--- | :--- | :--- | :--- |
| **`opd-bc`** | `3000` | ลงทะเบียนผู้ป่วย, เปิด/ปิด การรักษา (Visit) | `opd_db` |
| **`emr-bc`** | `3001` | บันทึกข้อมูลการแพทย์ (Medical Record) | `emr_db` |
| **`finance-bc`** | `3002` | ออกใบแจ้งหนี้ (Invoice), รับชำระเงิน | `finance_db` |

---

## 🔄 2. Business Flow & Event Messages (RabbitMQ)

การสื่อสารระหว่าง Service จะใช้ **Event-Driven Architecture (Fire and Forget)** ผ่าน RabbitMQ Exchange (Topic / Direct):

```
[OPD] --(visit.created)--> [EMR]
[EMR] --(treatment.completed)--> [Finance]
[Finance] --(invoice.paid)--> [OPD]
```

### Event Specification:
1. **OPD (Registration)**: ผู้ป่วยมาถึง -> `opd-bc` ลงทะเบียนและสร้าง Visit (สถานะ `OPEN`)
   - 📤 **Emit Event**: `visit.created`
   - 📦 **Payload**: `{ "visitId": "uuid", "patientId": "uuid", "timestamp": "2026-07-25T10:00:00Z" }`
2. **EMR (Preparation/Treatment)**: หมอบันทึกผลการรักษาใน `emr-bc` เสร็จสิ้น
   - 📤 **Emit Event**: `treatment.completed`
   - 📦 **Payload**: `{ "visitId": "uuid", "recordId": "uuid", "treatmentCost": "1500.00" }` (ส่งเป็น string เพื่อรักษาความแม่นยำของ PostgreSQL `decimal`)
3. **Finance (Billing)**: `finance-bc` รับ Event `treatment.completed` -> สร้าง Invoice (สถานะ `PENDING`) ตามราคาที่ส่งมา
   - ลูกค้าจ่ายเงินที่ `finance-bc` -> อัปเดต Invoice เป็น `PAID`
   - 📤 **Emit Event**: `invoice.paid`
   - 📦 **Payload**: `{ "visitId": "uuid", "invoiceId": "uuid", "status": "PAID" }`
4. **OPD (Closing)**: `opd-bc` รับ Event `invoice.paid` -> อัปเดต Visit เป็นสถานะ `CLOSED`

---

## 💾 3. Database Schema & Models TypeORM

> ⚠️ **กฎเหล็ก**: เพื่อจำลอง Microservices อย่างแท้จริง **ห้าม Join ข้าม DB เด็ดขาด** และ **ห้ามสร้าง Foreign Key ข้าม Database**

### 🔹 `opd-bc` (Port 3000 -> `opd_db`)
- **`Patient`** (ตาราง `patients`)
  - `id`: UUID (PK)
  - `hn`: String (**Unique**)
  - `first_name`: String
  - `last_name`: String
  - `id_card`: String (**Unique**)
- **`Visit`** (ตาราง `visits`)
  - `id`: UUID (PK)
  - `patient_id`: UUID (FK -> `patients.id` ภายใน `opd_db`)
  - `visit_date`: Date
  - `status`: Enum (`OPEN`, `CLOSED`)

### 🔹 `emr-bc` (Port 3001 -> `emr_db`)
- **`MedicalRecord`** (ตาราง `medical_records`)
  - `id`: UUID (PK)
  - `visit_id`, `patient_id`: UUID scalar references อ้างอิงจาก OPD (**ไม่มี FK ข้าม DB**)
  - `correlation_id`: String (สำหรับ idempotency ของ event)
  - `diagnosis`, `treatment_note`: Text
  - `doctor_id`: String
  - `treatment_cost`: Decimal (`scale=2`)
  - `status`: Enum (`WAITING`, `COMPLETED`)

### 🔹 `finance-bc` (Port 3002 -> `finance_db`)
- **`Invoice`** (ตาราง `invoices`)
  - `id`: UUID (PK)
  - `visit_id`, `record_id`: UUID scalar references อ้างอิงจาก OPD/EMR (**ไม่มี FK ข้าม DB**)
  - `correlation_id`: String (สำหรับ idempotency ของ event)
  - `total_amount`: Decimal (`scale=2`)
  - `status`: Enum (`PENDING`, `PAID`)

---

## 🛠️ 4. แผนการทำงาน (Sprint Plan / Tasks)

### 📌 Phase 1: Setup & Core APIs (Week 1)
- [x] Setup NestJS Monorepo และจัดการไฟล์ `docker-compose.yml` เพื่อรัน Postgres และ RabbitMQ
- [x] สร้าง Entity / Schema สำหรับทั้ง 3 Services (`opd-bc`, `emr-bc`, `finance-bc`)
- [x] สร้าง API พื้นฐานของแต่ละ Service
  - `opd-bc`: `POST /patients`, `GET /patients`, `GET /patients/:id`, `PATCH /patients/:id`, `DELETE /patients/:id`, `POST /visits`, `GET /visits`, `GET /visits/:id`, `GET /patients/:patientId/visits`
  - `emr-bc`: `POST /records`, `GET /records`, `GET /records/:id`, `GET /records/visit/:visitId`, `PATCH /records/:id`, `PATCH /records/:id/complete`
  - `finance-bc`: `GET /invoices`, `GET /invoices/:visitId`, `PATCH /invoices/:id/pay` (ไม่มี public invoice creation)

### 📌 Phase 2: Microservice Communication (Week 2)
- [x] คอนฟิก `@nestjs/microservices` เพื่อเชื่อมต่อ RabbitMQ ด้วย durable exchange/queues/bindings
- [x] ยิง Event จาก `opd-bc` (`visit.created`) ให้ `emr-bc` เป็น Consumer สร้าง Medical Record สถานะ `WAITING`
- [x] ยิง Event จาก `emr-bc` (`treatment.completed`) ส่งให้ `finance-bc` สร้าง Invoice อัตโนมัติ
- [x] ยิง Event จาก `finance-bc` (`invoice.paid`) กลับไปให้ `opd-bc` ปิด Visit
- [x] ใช้ transactional outbox, retry, ACK/NACK และ idempotency เพื่อไม่ให้ event หายหรือประมวลผลซ้ำ

### 📌 Phase 3: Refactoring & Best Practices (Week 3)
- [x] **Validation**: ใส่ `class-validator` และ `class-transformer` เพื่อตรวจจับ Request Body ให้ถูกต้อง
- [x] **Error Handling**: จัดการกรณีข้อมูลผิดพลาด (เช่น จ่ายเงิน Invoice ที่ไม่มีอยู่จริง)
- [x] **Environment**: ใช้ `@nestjs/config` ดึงค่าจากไฟล์ `.env` (ไม่ Hardcode connection string)
- [x] สร้างไฟล์ `README.md`, แยก test structure/config และ Export Postman Collection แนบมาด้วย

### 📌 Phase 4: User Management (IAM) (Week 4 optional)
- **Security - Stateful JWT with Redis**: พัฒนาระบบ Login ด้วย Stateful JWT
- **Identity & Access Management (IAM)**: ต่อยอดมาจากระบบ RBAC เป็นระบบ IAM จัดการสิทธิ์การเข้าถึงข้อมูลผู้ป่วย

---

## 💡 5. คำแนะนำสำหรับน้องฝึกงาน (Pro Tips & Guidelines)

1. **Docker Compose**: ไม่ต้องลง DB 3 ตัว ให้ลง Postgres ตัวเดียวแต่สร้าง 3 Logical Databases (`opd_db`, `emr_db`, `finance_db`) ใน script `init.sql`
2. **RabbitMQ Connection**: ใช้ Transport แบบ RMQ และศึกษาเรื่อง Queue, Exchange ให้ดี หาก Service ไหนดับไปแล้วเปิดใหม่ Message ต้องไม่หาย (Durable)
3. **Eventual Consistency**: ระบบนี้จะไม่มี Transaction แบบปกติ (เช่น rollback ข้าม DB ไม่ได้) ให้เน้นทำ Flow ทางบวกให้สมบูรณ์ก่อน
4. **Idempotency (ระดับ Advance)**: ป้องกันการประมวลผล Event ซ้ำ (เช่น หาก RabbitMQ ส่ง `invoice.paid` มา 2 รอบ ระบบจะไม่พัง)
5. **Naming Conventions**: ใช้ [Enterprise Backend Blueprint Naming Conventions](https://iots1.github.io/enterprise-backend-blueprint/guides/naming-conventions/) เป็น source of truth
   - Module และ module folder ใช้ชื่อเอกพจน์; Controller และ Service ใช้ชื่อพหูพจน์; filename/folder ใช้ `kebab-case`
   - Entity และ DTO properties ใช้ `snake_case`; variables และ functions อื่นใน TypeScript ใช้ `camelCase`
   - Table ใช้ชื่อพหูพจน์แบบ `snake_case`; column ใช้ `snake_case`
   - Constraint names ใช้ `pk_`, `fk_`, `idx_`, `uq_`, หรือ `chk_` ตามประเภท
   - Boolean/status properties ต้องขึ้นต้นด้วย `is`, `has`, `can`, หรือ `should`
   - Import ที่ข้าม module boundary ต้องใช้ path alias
6. **Essential Best Practices**: ออกแบบ RESTful API & URIs ให้สะอาดและสอดคล้องตามมาตรฐาน REST
