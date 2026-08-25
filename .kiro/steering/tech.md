# Technology Stack

## Architecture

- **Pattern**: Monorepo Event-Driven Microservices Architecture (Choreography)
- **Bounded Contexts**: 
  - `opd-bc` (Port `3000`): Outpatient Department & Visit Lifecycle
  - `emr-bc` (Port `3001`): Electronic Medical Records & Treatment Completion
  - `finance-bc` (Port `3002`): Invoicing & Payment Processing
- **Decoupling Strategy**: Database-per-service logical isolation with transactional outbox publishing and RabbitMQ messaging.

## Core Technologies

- **Language**: TypeScript 5.7+ (`strictNullChecks: true`, `noImplicitAny: true`, NodeNext module resolution)
- **Framework**: NestJS 11 (Express HTTP adapter, NestJS Microservices for RabbitMQ)
- **Runtime**: Node.js 20+ / 24+
- **Database**: PostgreSQL 16 (Logical DBs: `opd_db`, `emr_db`, `finance_db`)
- **Message Broker**: RabbitMQ 3 (Topic / Direct exchange with durable queues)

## Key Libraries

- **TypeORM 1.1+ / `@nestjs/typeorm`**: PostgreSQL ORM with explicit constraint naming (`pk_*`, `fk_*`, `uq_*`, `idx_*`).
- **`amqplib` & `amqp-connection-manager`**: Resilient RabbitMQ transport and connection recovery.
- **`class-validator` & `class-transformer`**: Strict whitelist validation and type coercion on DTOs.
- **`@nestjs/swagger`**: OpenAPI documentation served at `/docs` per service.

## Development Standards

### Type Safety
- TypeScript strict mode enforced across all apps and shared libraries.
- No loose `any` types; all request/response models and event payloads use strict interfaces and DTOs.
- Cross-boundary communication relies strictly on `@app/contracts`.

### Code Quality & Naming
- ESLint 9 + Prettier for uniform code formatting.
- Naming conventions enforced via automated Jest architecture tests (`*-naming.spec.ts`).
- Service configuration managed via `@nestjs/config` loaded from `.env` (no hardcoded credentials or ports).

### Observability & Logging
- Centralized `StructuredLogger` outputs single-line JSON logs containing `timestamp`, `level`, `message`, `service`, `trace`, and `context`.
- Distributed tracing propagation via `x-correlation-id`, `x-trace-id`, and `x-span-id` in HTTP headers and RabbitMQ message metadata.

### Resilience & Idempotency
- **Transactional Outbox**: Outgoing events are persisted to local `outbox_events` table within aggregate transactions before async publishing.
- **Idempotent Consumers**: Inbound event handlers record processed events to `processed_events` to guard against duplicate message handling.

### Testing Strategy
- Unit tests for services, controllers, and naming rules (`npm test`).
- E2E tests for isolated microservice flows (`npm run test:e2e`).
- Multi-service integration flow testing with live dependencies (`npm run test:flow`).

## Development Environment

### Required Tools
- Node.js 20+ and npm 10+
- Docker Desktop or Docker Engine with Docker Compose

### Common Commands
```bash
# Infrastructure
docker compose up -d

# Development (Run all services or individual)
npm run start:all
npm run start:dev       # OPD (Port 3000)
npm run start:emr       # EMR (Port 3001)
npm run start:finance   # Finance (Port 3002)

# Build & Lint
npm run build
npm run lint:check

# Testing
npm test                # Unit & naming tests
npm run test:cov        # Coverage
npm run test:e2e        # E2E test suites
npm run test:flow       # Live HTTP + RabbitMQ flow test
```

## Key Technical Decisions

- **Zero Cross-DB Joins**: Strictly no joins or cross-database foreign keys. Inter-service references use scalar UUID strings.
- **Outbox Pattern over 2PC**: Avoid distributed locking/two-phase commit by using local transactional outbox tables and polling publishers.
- **Contract-First Messaging**: Shared event interfaces defined in `libs/contracts` ensure synchronized producer/consumer schemas.

---
_Document standards and patterns, not every dependency_
