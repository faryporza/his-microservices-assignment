# Product Overview

Hospital Information System (HIS) backend built as an event-driven microservices architecture using NestJS, RabbitMQ, and PostgreSQL. The system manages outpatient healthcare workflows across three independent bounded contexts: Outpatient Department (OPD), Electronic Medical Records (EMR), and Finance (Billing & Payments).

## Core Capabilities

- **Patient Registration & Visit Management (OPD)**: Manage patient identity (HN, Thai National ID) and lifecycle of outpatient visits (`OPEN` → `CLOSED`).
- **Clinical Records & Treatment (EMR)**: Auto-provision medical record stubs on visit creation, capture doctor clinical diagnoses, treatment notes, and treatment costs (`WAITING` → `COMPLETED`).
- **Billing & Payment Processing (Finance)**: Auto-generate invoices upon treatment completion, process patient payments, and record payment audit trails (`PENDING` → `PAID`).
- **Asynchronous Choreographed Event Flow**: Loosely coupled service integration using RabbitMQ topics with transactional outbox publishing and idempotent event consumers.

## Target Use Cases

- **End-to-End Outpatient Care Flow**:
  1. Patient registers at OPD (`POST /patients`).
  2. OPD opens a visit (`POST /visits`, status `OPEN`) and publishes `visit.created`.
  3. EMR receives `visit.created` and provisions a medical record (`status: WAITING`).
  4. Doctor records clinical diagnosis, notes, and treatment cost (`PATCH /records/:id/complete`, status `COMPLETED`) and publishes `treatment.completed`.
  5. Finance receives `treatment.completed` and creates an invoice (`status: PENDING`).
  6. Patient pays invoice (`PATCH /invoices/:id/pay`, status `PAID`) and Finance publishes `invoice.paid`.
  7. OPD receives `invoice.paid` and closes the visit (`status: CLOSED`).

- **Resilient Distributed Consistency**: Maintain eventual consistency across bounded contexts without cross-database transactions, handling message retries and duplicate events gracefully.

## Value Proposition

- **Domain Isolation**: Each bounded context owns its logical database (`opd_db`, `emr_db`, `finance_db`) with strictly zero cross-database queries or foreign keys.
- **Reliable Event Choreography**: Transactional outbox persistence guarantees at-least-once message delivery, paired with consumer idempotency tables to eliminate duplicate processing.
- **Enterprise Standards**: End-to-end distributed tracing (`x-correlation-id`, `x-trace-id`), structured JSON logging, strict DTO validation, and automated API documentation.

---
_Focus on patterns and purpose, not exhaustive feature lists_
