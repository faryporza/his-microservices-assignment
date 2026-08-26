# HIS Microservices Assignment Gist Reference

Source: [https://gist.github.com/iots1/e5d1b5c19b39171a96b236af4a0a7f27](https://gist.github.com/iots1/e5d1b5c19b39171a96b236af4a0a7f27)

## Microservices Topology
- **`opd-bc`** (Port: `3000`): Outpatient Department (Patient Registration, Visits).
- **`emr-bc`** (Port: `3001`): Electronic Medical Records (Medical Records, Diagnosis & Treatment).
- **`finance-bc`** (Port: `3002`): Billing & Invoices (Invoice Management, Payment Processing).
- **`iam-bc`** (Port: `3003`): Identity & Access Management (User Registration, Stateful JWT Auth, RBAC).

## Databases & Persistence
- Logical Databases: `opd_db`, `emr_db`, `finance_db`, `iam_db` running on PostgreSQL 16.
- Zero cross-database joins across service boundaries.

## Event Choreography Flow
1. `opd-bc` registers visit -> Emits `visit.created`
   - Payload: `{ "visitId": "uuid", "patientId": "uuid", "timestamp": "ISO8601" }`
2. `emr-bc` consumes `visit.created` -> Prepares empty record with status `WAITING`.
3. `emr-bc` doctor completes treatment -> Emits `treatment.completed`
   - Payload: `{ "visitId": "uuid", "recordId": "uuid", "treatmentCost": 1500.00 }`
4. `finance-bc` consumes `treatment.completed` -> Creates invoice with status `PENDING`.
5. `finance-bc` receives payment -> Updates invoice to `PAID` -> Emits `invoice.paid`
   - Payload: `{ "visitId": "uuid", "invoiceId": "uuid", "status": "PAID" }`
6. `opd-bc` consumes `invoice.paid` -> Updates visit status to `CLOSED`.

## Reliability & Fault Tolerance
- Durable RabbitMQ Topic Exchange `his.events`.
- Durable Queues (`opd.events`, `emr.events`, `finance.events`).
- Transactional Outbox Pattern (`outbox_events` table).
- Idempotent Consumers (`idempotent_consumers` table).
