# Enterprise Backend Blueprint Reference

Source: [https://iots1.github.io/enterprise-backend-blueprint/](https://iots1.github.io/enterprise-backend-blueprint/)

## 1. Naming Conventions

### NestJS Architecture
- **Modules**: Singular + Module (`PatientModule`, `VisitModule`, `InvoiceModule`, `AuthModule`)
- **Controllers**: Plural + Controller (`PatientsController`, `VisitsController`, `InvoicesController`, `AuthController`)
- **Services**: Plural + Service (`PatientsService`, `VisitsService`, `InvoicesService`, `AuthService`)
- **Event Controllers**: Singular + -events (`VisitEventsController`, `InvoiceEventsController`, `MedicalRecordEventsController`)
- **Entities**: Singular, PascalCase (`Patient`, `Visit`, `MedicalRecord`, `Invoice`, `User`)
- **DTOs**: Singular, PascalCase (`CreatePatientDTO`, `UpdateInvoiceDTO`, `RegisterUserDTO`)
- **File Patterns**: kebab-case (`patient.module.ts`, `patients.controller.ts`, `patients.service.ts`, `create-patient.dto.ts`)

### PostgreSQL Rules
- **Tables**: plural, snake_case (`patients`, `visits`, `medical_records`, `invoices`, `users`, `outbox_events`, `idempotent_consumers`)
- **Columns**: snake_case (`first_name`, `id_card`, `total_amount`, `created_at`, `is_active`)
- **Primary Key Constraint**: `pk_<table_name>` (e.g. `pk_patients`, `pk_visits`)
- **Foreign Key Constraint**: `fk_<table>_<ref_table>` (e.g. `fk_visits_patients`)
- **Index Constraint**: `idx_<table_name>_<column_names>` (e.g. `idx_visits_patient_id`)
- **Unique Constraint**: `uq_<table_name>_<column_names>` (e.g. `uq_patients_hn`, `uq_users_username`)
- **Check Constraint**: `chk_<table_name>_<condition>` (e.g. `chk_visits_status`, `chk_invoices_status`)

## 2. API Response Protocol (JSON:API Envelope)

### Success Envelope
```json
{
  "status": {
    "code": 200000,
    "message": "Request Succeeded"
  },
  "data": {
    "id": "uuid-v4",
    "type": "resource-type",
    "attributes": {
      "key": "value"
    }
  },
  "meta": {
    "timestamp": "2026-08-26T00:00:00.000Z"
  }
}
```

### Error Envelope
```json
{
  "status": {
    "code": 400001,
    "message": "Validation Failed"
  },
  "errors": [
    {
      "code": "400001",
      "title": "ValidationException",
      "detail": "first_name must be a string",
      "source": { "pointer": "/data/attributes/first_name" }
    }
  ],
  "meta": {
    "timestamp": "2026-08-26T00:00:00.000Z"
  },
  "links": {
    "self": "/patients"
  }
}
```

## 3. Distributed Tracing & Observability
- Request Headers: `x-correlation-id`, `x-trace-id`, `x-span-id`
- Response Headers: propagated in HTTP responses
- Structured JSON Logger: standard format with `timestamp`, `level`, `message`, `service`, `trace`, `context`, `details`
