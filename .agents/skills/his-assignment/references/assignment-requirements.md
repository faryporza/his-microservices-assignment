# HIS assignment requirements

Source: [HIS Microservices Assignment Gist](https://gist.github.com/iots1/e5d1b5c19b39171a96b236af4a0a7f27), reviewed 2026-08-07.

Use this file as a working acceptance checklist. Recheck the source when the user asks for the latest requirements.

## Required architecture

| Application | Port | Own database | Own domain |
| --- | ---: | --- | --- |
| `opd-bc` | 3000 | `opd_db` | Patient, Visit |
| `emr-bc` | 3001 | `emr_db` | MedicalRecord |
| `finance-bc` | 3002 | `finance_db` | Invoice, payment |

- Implement the services as a NestJS monorepo.
- Run PostgreSQL and RabbitMQ through Docker Compose.
- Keep one logical database per service. Never join or transact across databases.
- Communicate across bounded contexts with RabbitMQ events, not direct repository access or synchronous service-to-service HTTP.

## Required business flow

1. OPD creates a patient and opens a visit with status `OPEN`.
2. OPD publishes `visit.created`; EMR may use it to prepare record state.
3. EMR records treatment and publishes `treatment.completed`.
4. Finance consumes the treatment event and creates one `PENDING` invoice for the visit.
5. Finance marks the invoice `PAID` and publishes `invoice.paid`.
6. OPD consumes the paid event and closes the visit as `CLOSED`.

Use the shared contracts in `his-project/libs/contracts` as the implementation authority. The Gist examples require these event semantics:

- `visit.created`: visit ID, patient ID, timestamp.
- `treatment.completed`: visit ID, record ID, treatment cost.
- `invoice.paid`: visit ID, invoice ID, `PAID` status.

Do not silently rename an established event field merely to copy an example payload.

## Required persistence

- `patients`: UUID primary key, unique HN, first name, last name, and ID card.
- `visits`: UUID primary key, OPD-local patient foreign key, visit date, and `OPEN`/`CLOSED` status.
- `medical_records`: UUID primary key, scalar external visit ID, diagnosis, treatment note, and doctor ID.
- `invoices`: UUID primary key, scalar external visit ID, decimal total amount, and `PENDING`/`PAID` status.

Apply the repository and Blueprint naming conventions to physical tables, columns, properties, files, classes, indexes, and constraints.

## Mandatory phases

### Phase 1 — services and data

- Provide the monorepo and Docker Compose infrastructure.
- Implement the service-owned schemas.
- Provide at least these APIs:
  - OPD: `POST /patients`, `POST /visits`.
  - EMR: `POST /records`.
  - Finance: `GET /invoices/:visitId`, `PATCH /invoices/:id/pay`.

### Phase 2 — messaging

- Configure RabbitMQ exchange, queues, and bindings.
- Implement the complete `visit.created` → `treatment.completed` → `invoice.paid` flow.
- Use durable queues and persistent delivery so messages survive consumer restarts.
- Make duplicate deliveries safe, especially invoice creation and visit closure.

### Phase 3 — production readiness

- Validate requests with `class-validator` and `class-transformer`.
- Return appropriate HTTP errors.
- Load configuration with `ConfigModule` and environment variables; do not hardcode secrets or connection details.
- Document setup and execution in README.
- Export a Postman collection for the required flow.

## Optional scope

Phase 4 IAM and stateful JWT behavior are optional. Do not report their absence as a Phase 1–3 defect unless the user adds them to scope.

## Completion evidence

- Build and relevant unit tests pass.
- Required HTTP endpoints succeed and validation/error paths are exercised.
- The full persisted state transition is observed: Patient → Visit `OPEN` → Record → Invoice `PENDING` → Invoice `PAID` → Visit `CLOSED`.
- Duplicate event delivery does not duplicate invoices or regress a closed visit.
- An event published while a consumer is stopped is processed after restart.
- README, `.env.example`, and the exported Postman collection match actual behavior.
