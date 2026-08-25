# Project Structure

## Organization Philosophy

Monorepo architecture structured around Domain-Driven Design (DDD) Bounded Contexts for applications (`apps/`) and reusable shared modules (`libs/`). Each microservice bounded context is self-contained with its own controllers, services, entities, DTOs, and test suites.

## Directory Patterns

### Bounded Context Applications (`/apps/<context>-bc/`)
**Location**: `apps/opd-bc/`, `apps/emr-bc/`, `apps/finance-bc/`  
**Purpose**: Independent runnable microservices containing domain modules, HTTP endpoints, RabbitMQ listeners, and configuration.  
**Example Structure**:
```text
apps/<context>-bc/
├── src/
│   ├── main.ts                    # Microservice entry point & bootstrap
│   ├── <context>-bc.module.ts     # Root module with TypeORM & dependencies
│   ├── health-checks.controller.ts# Health check endpoint
│   └── modules/<feature>/         # Feature module folder (singular)
│       ├── <feature>.module.ts    # Feature module declaration
│       ├── controllers/           # HTTP controllers & event consumers
│       ├── services/              # Business logic & repository access
│       ├── entities/              # TypeORM entities (singular)
│       └── dto/                   # Request / response DTOs
└── test/
    ├── unit/                      # Unit & naming convention tests
    ├── e2e/                       # Microservice-level E2E tests
    └── mocks/                     # Fixtures & mock data
```

### Shared Common Library (`/libs/common/`)
**Location**: `libs/common/`  
**Purpose**: Cross-cutting infrastructure primitives shared across all bounded contexts (structured logging, exception filters, strict validation pipes, database configuration, idempotency service, outbox publisher).  
**Example**: `import { StructuredLogger, createPostgresOptions } from '@app/common'`

### Shared Contracts Library (`/libs/contracts/`)
**Location**: `libs/contracts/`  
**Purpose**: Shared event interfaces, payloads, event name constants, and schema validation utilities for RabbitMQ message choreography.  
**Example**: `import { VisitCreatedEvent, visitCreatedEventName } from '@app/contracts'`

## Naming Conventions

### NestJS Architecture Patterns

| Element | Format / Pattern | Code Example | File Pattern |
| :--- | :--- | :--- | :--- |
| **Modules** | Singular + `Module` | `PatientModule`, `VisitModule` | `patient.module.ts` |
| **Controllers** | Plural + `Controller` | `PatientsController`, `VisitsController` | `patients.controller.ts` |
| **Event Controllers** | Singular + `EventsController` | `VisitEventsController`, `InvoiceEventsController` | `visit-events.controller.ts` |
| **Services** | Plural + `Service` | `PatientsService`, `VisitsService` | `patients.service.ts` |
| **Entities** | Singular PascalCase | `Patient`, `Visit`, `MedicalRecord` | `patient.entity.ts` |
| **Entity Properties**| `snake_case` | `patient_id`, `created_at`, `total_amount` | (inside entity) |
| **DTOs** | Singular PascalCase | `CreatePatientDTO`, `UpdateInvoiceDTO` | `create-patient.dto.ts` |
| **Enums** | Singular PascalCase | `VisitStatus`, `InvoiceStatus` | (inside entity or enum file) |
| **Booleans** | `is_`, `has_`, `can_`, `should_` | `is_active`, `is_paid` | (inside entity / dto) |

### PostgreSQL Schema & Constraints

| Object | Pattern | Example |
| :--- | :--- | :--- |
| **Tables** | `plural, snake_case` | `patients`, `visits`, `medical_records`, `invoices` |
| **Primary Keys** | Column `id`, constraint `pk_<table_name>` | `@PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'pk_patients' })` |
| **Foreign Keys** | Column `<ref_singular>_id`, constraint `fk_<table>_<ref_table>` | `patient_id` with `fk_visits_patients` (within same DB only) |
| **Unique** | `uq_<table_name>_<column_names>` | `@Unique('uq_patients_hn', ['hn'])` |
| **Indexes** | `idx_<table_name>_<column_names>` | `idx_visits_patient_id` |

## Import Organization

```typescript
// 1. External NestJS & third-party libraries
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// 2. Shared core libraries (Path aliases)
import { StructuredLogger } from '@app/common';
import { VisitCreatedEvent, visitCreatedEventName } from '@app/contracts';

// 3. Application-level path aliases
import { Patient } from '@apps/opd-bc/modules/patient/entities/patient.entity';
import { CreatePatientDTO } from '@apps/opd-bc/modules/patient/dto/create-patient.dto';

// 4. Local relative imports (same module directory only)
import { PatientsService } from './patients.service';
```

**Path Aliases**:
- `@app/common`, `@app/common/*` → `libs/common/src/*`
- `@app/contracts`, `@app/contracts/*` → `libs/contracts/src/*`
- `@apps/opd-bc/*` → `apps/opd-bc/src/*`
- `@apps/emr-bc/*` → `apps/emr-bc/src/*`
- `@apps/finance-bc/*` → `apps/finance-bc/src/*`

## Code Organization Principles

- **Bounded Context Encapsulation**: Never import entities, repositories, or services across different `apps/*` contexts. Inter-service interaction happens exclusively via RabbitMQ events or HTTP endpoints.
- **Contract Ownership**: Message payloads and routing keys are strictly centralized in `libs/contracts`.
- **Stateless Handlers**: Controllers and event consumers delegate business logic to injectable services; database mutations and outbox records execute inside transactional boundaries.

---
_Document patterns, not file trees. New files following patterns shouldn't require updates_
