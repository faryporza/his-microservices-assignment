# HIS Microservices

Hospital Information System implemented as a NestJS monorepo with four bounded
contexts aligned with the [Enterprise Backend Blueprint](https://iots1.github.io/enterprise-backend-blueprint/):

| Service | HTTP base URL           | Swagger UI               | Database     | Owns                  |
| ------- | ----------------------- | ------------------------ | ------------ | --------------------- |
| IAM     | `http://localhost:3003/api/v1` | `http://localhost:3003/docs` | `iam_db` | identity and access-audit records |
| OPD     | `http://localhost:3000/api/v1` | `http://localhost:3000/docs` | `opd_db` | patients and visits |
| EMR     | `http://localhost:3001/api/v1` | `http://localhost:3001/docs` | `emr_db` | medical records |
| Finance | `http://localhost:3002/api/v1` | `http://localhost:3002/docs` | `finance_db` | invoices and payments |

Health probes remain at `/`; HTTP APIs use the configured `API_PREFIX` (the
default is `/api/v1`).

## Event flow

`Patient → Visit (OPEN) → MedicalRecord (COMPLETED) → Invoice (PENDING) → Payment (PAID) → Visit (CLOSED)`

1. OPD persists a visit and publishes `visit.created`.
2. EMR consumes `visit.created`, then publishes `treatment.completed` after a
   record is completed.
3. Finance creates one invoice per visit from `treatment.completed` and
   publishes `invoice.paid` after payment.
4. OPD consumes `invoice.paid` and closes the visit.

Event payload contracts deliberately remain camelCase for compatibility.
Entity and HTTP DTO properties use `snake_case`.

## Standardized JSON:API Response Envelope

All HTTP responses are formatted into standard envelopes by `TransformInterceptor` and `AllExceptionsFilter`:

### Success Envelope (`status`, `data`, `meta`, `links`)
```json
{
  "status": {
    "code": 201000,
    "message": "Request Succeeded"
  },
  "data": {
    "type": "patients",
    "id": "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
    "attributes": {
      "hn": "HN000001",
      "first_name": "Somchai",
      "last_name": "Jaidee",
      "id_card": "1101700203456",
      "created_at": "2026-08-24T10:00:00.000Z",
      "updated_at": "2026-08-24T10:00:00.000Z"
    }
  },
  "meta": {
    "timestamp": "2026-08-24T10:00:00.000Z"
  },
  "links": {
    "self": "/patients"
  }
}
```

### Error Envelope (`status`, `errors`, `meta`, `links`)
```json
{
  "status": {
    "code": 404,
    "message": "Resource Not Found"
  },
  "errors": [
    {
      "code": "404",
      "title": "NotFoundException",
      "detail": "Patient with ID '...' not found"
    }
  ],
  "meta": {
    "timestamp": "2026-08-24T10:00:00.000Z"
  },
  "links": {
    "self": "/patients/..."
  }
}
```

## HTTP Request & Response Endpoints

All request bodies must use `snake_case`. UUID values below are examples.

### Create a patient

```http
POST /patients
Content-Type: application/json

{
  "hn": "HN000001",
  "first_name": "Somchai",
  "last_name": "Jaidee",
  "id_card": "1101700203456"
}
```

Privileged verification users are not part of production migrations. Create
them only in a test environment with the guarded `npm run seed:test` command.
Patient accounts must be linked to an OPD patient identity by an administrator
before patient-scoped reads can succeed.

### Create a visit

```http
POST /visits
Content-Type: application/json
X-Correlation-Id: 550e8400-e29b-41d4-a716-446655440000

{
  "patient_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Create or update a medical record

```http
POST /records
Content-Type: application/json

{
  "visit_id": "550e8400-e29b-41d4-a716-446655440000",
  "patient_id": "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
  "doctor_id": "doctor-001",
  "diagnosis": "Influenza",
  "treatment_note": "Rest and fluids",
  "treatment_cost": 1500
}
```

```http
PATCH /records/:id/complete
Content-Type: application/json
X-Correlation-Id: 550e8400-e29b-41d4-a716-446655440000

{
  "doctor_id": "doctor-001",
  "diagnosis": "Influenza",
  "treatment_note": "Treatment completed",
  "treatment_cost": 1500
}
```

### Pay an invoice

Invoices are created only from `treatment.completed`; there is no public
invoice-creation endpoint.

```http
PATCH /invoices/:id/pay
Content-Type: application/json
X-Correlation-Id: 550e8400-e29b-41d4-a716-446655440000

{
  "status": "PAID"
}
```

## Persistence naming

| Database      | Table              | Primary key           | Unique / foreign key                    |
| ------------- | ------------------ | --------------------- | --------------------------------------- |
| `opd_db`      | `patients`         | `pk_patients`         | `uq_patients_hn`, `uq_patients_id_card` |
| `opd_db`      | `visits`           | `pk_visits`           | `fk_visits_patients`, `idx_visits_patient_id` |
| `emr_db`      | `medical_records`  | `pk_medical_records`  | `uq_medical_records_visit_id`           |
| `finance_db`  | `invoices`         | `pk_invoices`         | `uq_invoices_visit_id`                  |
| service-local | `processed_events` | `pk_processed_events` | `uq_processed_events_event_id`          |
| service-local | `outbox_events`    | `pk_outbox_events`    | `uq_outbox_events_event_id`, `idx_outbox_events_published_at` |

All table and column names are `snake_case`; tables are plural. Cross-service
references such as `visit_id` are scalar UUIDs and never database foreign keys.
Each service persists outgoing events in its own `outbox_events` table and retries
unpublished rows until RabbitMQ confirms delivery.

## Run and verify

From `his-project/`:

```bash
npm install
npm test -- --runInBand
npm run lint:check
npm run test:cov
npm run test:e2e
npm run build
```

Configure database, RabbitMQ, Redis, and both required JWT secrets in `.env`;
use `.env.example` as the template. Do not commit `.env`.
