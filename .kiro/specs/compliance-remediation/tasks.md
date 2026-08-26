# Implementation Plan: Compliance Remediation

---

## 1. Planning Baseline, Git Strategy & Architectural Exceptions

All work is organized against a dedicated integration baseline branch:  
**Baseline Branch**: `planning/compliance-remediation`  
**Target Release Branch**: `main` (Promoted only after final Task 6.1 verification and audit pass)

### Git Workflow Rules
1. **No direct commits to `main`**.
2. **1 Task = 1 Feature/Fix Branch**: Every executable task operates on its designated branch.
3. **Explicit Base Branch**: Parallel-safe tasks branch directly from `planning/compliance-remediation`. Dependent tasks branch from `planning/compliance-remediation` *after* prerequisite branches have been merged into the baseline.
4. **Selective Staging**: NEVER use `git add .` or `git add -A`. Explicitly stage only modified files.
5. **Rollback Safety**: Database migrations, RabbitMQ topologies, and event contracts include explicit rollback procedures.

### Approved Architectural Exceptions (AE)
To reconcile the **Enterprise Backend Blueprint** with the **HIS Microservices Assignment Gist**, the following explicit exceptions are documented and approved:

| Exception ID | Subject | Blueprint Rule | Assignment Rule / Rationale | Resolution in Remediation |
|---|---|---|---|---|
| **AE-1** | API Route Structure & Versioning | Global prefix `/{service-prefix}/{version}` (e.g. `/opd-bc/v1/patients`) | Gist defines exact root paths (`/patients`, `/visits`, `/records`, `/invoices`, `/invoices/:id/pay`, `/docs`) | **Preserve Direct Root Routes**: Maintain exact Gist URLs to avoid breaking external Postman suites, automated grading, and live flow runners. |
| **AE-2** | IAM Application Naming | Infrastructure / IAM services named without `-bc` suffix (e.g. `iam`) | Assignment defines all monorepo apps with uniform directory patterns | **Preserve `iam-bc`**: Maintain consistent monorepo package structure and test scripts. Naming convention tests allow `iam-bc` as an approved exception. |
| **AE-3** | Asynchronous Transport | Generic microservice setup mentions TCP transport | Assignment Gist explicitly specifies RabbitMQ topic exchange choreography | **RabbitMQ Choreography**: RabbitMQ topic exchange (`his.events`) is mandatory per assignment requirements. |

---

## 2. Dependency Graph & Git Branch Matrix

```text
planning/compliance-remediation (Integration Baseline)
│
├── [Wave 1: Foundation]
│   ├── fix/dependency-security          (Task 1.1) ─┐
│   ├── fix/jwt-secret-validation        (Task 1.2) ─┤
│   └── fix/database-isolation           (Task 1.3) ─┴─► [CRITICAL FOUNDATION GATE]
│
├── [Wave 1: Core Security]
│   ├── fix/public-role-escalation       (Task 2.1) ─┐
│   ├── feat/ownership-projection        (Task 2.2) ─┼─► [Depends: 1.3, 2.1]
│   ├── fix/resource-ownership           (Task 2.3) ─┼─► [Depends: 2.2]
│   ├── feat/permission-guard            (Task 2.4) ─┼─► [Depends: 2.1]
│   ├── feat/phi-audit                   (Task 2.5) ─┼─► [Depends: 1.3]
│   └── feat/auth-rate-limit             (Task 2.6) ─┴─► [Depends: 1.2]
│
├── [Wave 2: Messaging & Reliability]
│   ├── feat/atomic-idempotency          (Task 3.1) ─┐
│   ├── feat/rabbitmq-dlq-resilience     (Task 3.2) ─┼─► [Depends: 3.1]
│   ├── feat/log-redaction-trace         (Task 3.3) ─┤
│   ├── fix/redis-fail-closed            (Task 3.4) ─┼─► [Depends: 1.2]
│   └── fix/architecture-boundaries      (Task 3.5) ─┘
│
├── [Wave 3: Blueprint Conformance]
│   ├── feat/entity-standards            (Task 4.1) ─┐ [Depends: 1.3, 2.2]
│   ├── feat/blueprint-decorators        (Task 4.2) ─┼─► [Depends: 2.4] (AE-1 documented)
│   └── test/naming-conventions          (Task 4.3) ─┴─► [Depends: 4.1, 4.2] (AE-2 documented)
│
├── [Wave 4: CI & Documentation]
│   ├── test/openapi-contract            (Task 5.1) ─┐ [Depends: 1.1, 4.2]
│   ├── test/postman-newman              (Task 5.2) ─┼─► [Depends: 2.1, 2.3, 2.4]
│   ├── ci/harden-workflow               (Task 5.3) ─┼─► [Depends: 1.1, 1.3, 5.1, 5.2]
│   └── docs/sync-and-drift-test         (Task 5.4) ─┴─► [Depends: 4.2, 5.3]
│
└── [Wave 5: Final Verification & Audit Gate]
    └── audit/final-compliance-verification (Task 6.1) ──► [Exhaustive his-compliance-audit -> PR to main]
```

---

## 3. Wave 1: Foundation & Security Setup

- [x] 1. Foundation: Dependency Security, Secret Entropy & Schema Isolation

- [x] 1.1 Remediate production dependency vulnerability in Swagger package resolution
  - **Git Branch**: `fix/dependency-security`
  - **Base Branch**: `planning/compliance-remediation`
  - **Depends**: None
  - **Merge Target**: `planning/compliance-remediation`
  - **Parallel Safe**: YES
  - **Scope / Boundary**: `his-project/package.json`, `his-project/package-lock.json` (`RootPackage`)
  - **Expected Files**:
    - `his-project/package.json`
    - `his-project/package-lock.json`
  - **Acceptance Criteria**:
    - `@nestjs/swagger` and transitive dependencies resolve `js-yaml` to a safe, patched version outside the GHSA-pm4m-ph32-ghv5 advisory range (`^4.1.0` / `^4.3.0`).
    - `npm audit --omit=dev --audit-level=low` reports 0 vulnerabilities.
  - **Required Tests**:
    - Production dependency scan: `npm audit --omit=dev --audit-level=low`
    - Build test: `npm run build`
  - **Regression Verification**: Ensure all OpenAPI documentation endpoints (`/docs`, `/docs-json`) continue to load schemas accurately.
  - **Rollback Consideration**: Revert `package.json` overrides and restore previous `package-lock.json`.
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 1.2 Enforce fail-closed secret configuration, runtime entropy validation and dynamic token expiration
  - **Git Branch**: `fix/jwt-secret-validation`
  - **Base Branch**: `planning/compliance-remediation`
  - **Depends**: None
  - **Merge Target**: `planning/compliance-remediation`
  - **Parallel Safe**: YES
  - **Scope / Boundary**: `AuthCommonModule`, `ConfigModule`, `live-flow.e2e.mjs` (`@app/common`)
  - **Expected Files**:
    - `his-project/libs/common/src/config/environment.config.ts`
    - `his-project/libs/common/src/auth/auth-common.module.ts`
    - `his-project/apps/iam-bc/src/modules/auth/services/auth.service.ts`
    - `his-project/test/e2e/live-flow.e2e.mjs`
    - `his-project/libs/common/src/config/environment.config.spec.ts`
    - `his-project/apps/iam-bc/test/unit/auth.service.spec.ts`
    - `.github/workflows/ci.yml`
  - **Acceptance Criteria**:
    - Helper `getRequiredSecret(config, key, minLength = 32)` throws on missing or weak (<32 characters) secrets.
    - All hardcoded fallback secrets removed from `AuthCommonModule` and `AuthService`.
    - `JWT_ACCESS_EXPIRES_IN` and `JWT_REFRESH_EXPIRES_IN` parsed dynamically via `parseDurationToSeconds`.
    - `live-flow.e2e.mjs` uses ephemeral credentials and revokes Redis sessions in a `finally` block.
  - **Required Tests**:
    - Unit tests: `environment.config.spec.ts`, `auth.service.spec.ts`
    - Negative test: Assert service fails to boot if `JWT_SECRET` has <32 chars.
  - **Regression Verification**: Existing authentication login/refresh/logout tests pass with configured secrets.
  - **Rollback Consideration**: Revert environment helper changes; configuration is backward compatible if `.env` provides strong secrets.
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 1.3 Implement per-bounded-context database schema migrations and disable runtime schema synchronization
  - **Git Branch**: `fix/database-isolation`
  - **Base Branch**: `planning/compliance-remediation`
  - **Depends**: None
  - **Merge Target**: `planning/compliance-remediation`
  - **Parallel Safe**: YES *(High-Risk Foundation Review Gate)*
  - **Scope / Boundary**: `DatabaseIsolationEngine`, TypeORM configurations across all apps (`@app/common`, `apps/*`)
  - **Expected Files**:
    - `his-project/libs/common/src/config/environment.config.ts`
    - `his-project/apps/opd-bc/src/opd-bc.module.ts`
    - `his-project/apps/emr-bc/src/emr-bc.module.ts`
    - `his-project/apps/finance-bc/src/finance-bc.module.ts`
    - `his-project/apps/iam-bc/src/iam-bc.module.ts`
    - `his-project/libs/common/src/migrations/opd/1000000000000-init-opd.ts`
    - `his-project/libs/common/src/migrations/emr/1000000000000-init-emr.ts`
    - `his-project/libs/common/src/migrations/finance/1000000000000-init-finance.ts`
    - `his-project/libs/common/src/migrations/iam/1000000000000-init-iam.ts`
    - `his-project/test/integration/schema-isolation.integration-spec.ts`
  - **Acceptance Criteria**:
    - `synchronize: false` enforced for all database connections in non-unit-test environments.
    - Each bounded context module registers only its designated entity classes in `TypeOrmModule.forRoot`.
    - Dedicated initial migrations create domain tables from an empty database.
    - Schema isolation test verifies:
      - `opd_db` contains ONLY `patients`, `visits`, `outbox_events`, `processed_events`, `migrations`
      - `emr_db` contains ONLY `medical_records`, `outbox_events`, `processed_events`, `migrations`
      - `finance_db` contains ONLY `invoices`, `outbox_events`, `processed_events`, `migrations`
      - `iam_db` contains ONLY `users`, `audit_logs`, `outbox_events`, `processed_events`, `migrations`
  - **Required Tests**:
    - Integration test: `schema-isolation.integration-spec.ts` connecting to live Postgres and querying `information_schema.tables`.
    - Migration verification: Boot fresh database containers and assert successful migration run from empty state.
  - **Regression Verification**: All entity CRUD unit tests pass.
  - **Rollback Consideration**: Each migration file provides an explicit `down(queryRunner)` implementation dropping created tables cleanly.
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

---

## 4. Wave 1: Core Security & Access Control

- [x] 2. Core Security: Role Escalation Prevention, Ownership Projections & Access Guards

- [x] 2.1 Prevent public role self-assignment and add dedicated administrative role management operation
  - **Git Branch**: `fix/public-role-escalation`
  - **Base Branch**: `planning/compliance-remediation` (after 1.2 merged)
  - **Depends**: 1.2
  - **Merge Target**: `planning/compliance-remediation`
  - **Parallel Safe**: YES
  - **Scope / Boundary**: `AuthSecurityModule`, `iam-bc`
  - **Expected Files**:
    - `his-project/apps/iam-bc/src/modules/auth/dto/register-user.dto.ts`
    - `his-project/apps/iam-bc/src/modules/auth/controllers/auth.controller.ts`
    - `his-project/apps/iam-bc/src/modules/auth/services/auth.service.ts`
    - `his-project/apps/iam-bc/src/modules/user/controllers/users.controller.ts`
    - `his-project/apps/iam-bc/src/modules/user/dto/update-user-role.dto.ts`
    - `his-project/apps/iam-bc/src/modules/user/services/users.service.ts`
    - `his-project/apps/iam-bc/test/unit/users.controller.spec.ts`
    - `his-project/apps/iam-bc/test/e2e/auth.e2e-spec.ts`
  - **Acceptance Criteria**:
    - `RegisterUserDTO` stripped of `role` property (`forbidNonWhitelisted: true` returns HTTP 400 if client sends `role`).
    - Public registrations unconditionally assign `UserRole.PATIENT`.
    - `PATCH /users/:id/role` requires `ADMIN` role and permission `user:manage-roles`.
    - Non-admin role modification attempts return HTTP 403 Forbidden.
  - **Required Tests**:
    - Unit tests: `users.controller.spec.ts`
    - E2E tests: `auth.e2e-spec.ts` asserting 400 on `{ role: "ADMIN" }` in public registration, and 403 on unprivileged role update.
  - **Regression Verification**: Patient registration and login flows continue to operate normally.
  - **Rollback Consideration**: Revert controller endpoint and DTO changes; existing users maintain assigned roles.
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2.2 Implement server-side patient ownership projections in EMR and Finance databases & contract versioning
  - **Git Branch**: `feat/ownership-projection`
  - **Base Branch**: `planning/compliance-remediation` (after 1.3, 2.1 merged)
  - **Depends**: 1.3, 2.1
  - **Merge Target**: `planning/compliance-remediation`
  - **Parallel Safe**: NO
  - **Scope / Boundary**: `OwnershipProjectionEngine`, `@app/contracts`, `emr-bc`, `finance-bc`
  - **Expected Files**:
    - `his-project/libs/contracts/src/events/treatment-completed.event.ts`
    - `his-project/apps/emr-bc/src/modules/medical-record/entities/medical-record.entity.ts`
    - `his-project/apps/emr-bc/src/modules/medical-record/controllers/medical-record-events.controller.ts`
    - `his-project/apps/finance-bc/src/modules/invoice/entities/invoice.entity.ts`
    - `his-project/apps/finance-bc/src/modules/invoice/controllers/invoice-events.controller.ts`
    - `his-project/apps/finance-bc/src/modules/invoice/services/invoices.service.ts`
    - `his-project/libs/contracts/src/events/events.spec.ts`
    - `his-project/apps/emr-bc/test/unit/medical-record-events.controller.spec.ts`
    - `his-project/apps/finance-bc/test/unit/invoice-events.controller.spec.ts`
  - **Acceptance Criteria**:
    - `TreatmentCompletedEvent` contract explicitly defines `patientId: string` as a required field for deterministic downstream audit tracking.
    - `emr-bc` event consumer stores `patient_id` from `visit.created` into `medical_records.patient_id`.
    - `emr-bc` emits `treatment.completed` containing the trusted `patientId`.
    - `finance-bc` event consumer stores `patient_id` from `treatment.completed` into `invoices.patient_id`.
    - **Fail-Closed Guarantee**: If an event or local record lacks trusted `patient_id`, invoice creation/record query strictly refuses to grant patient-scoped access.
  - **Required Tests**:
    - Contract test: `events.spec.ts` asserting required `patientId` field.
    - Unit tests: `medical-record-events.controller.spec.ts`, `invoice-events.controller.spec.ts`.
  - **Regression Verification**: End-to-end choreography (`visit.created` → `treatment.completed` → `invoice.paid`) completes with `patient_id` persisted across all three databases.
  - **Rollback Consideration**: Event consumers support reading legacy event payloads with fallback logging while failing closed for patient access.
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 2.3 Implement ResourceOwnershipGuard with deterministic fail-closed BOLA protection
  - **Git Branch**: `fix/resource-ownership`
  - **Base Branch**: `planning/compliance-remediation` (after 2.2 merged)
  - **Depends**: 2.2
  - **Merge Target**: `planning/compliance-remediation`
  - **Parallel Safe**: NO
  - **Scope / Boundary**: `ResourceOwnershipGuard` (`@app/common`, `apps/*`)
  - **Expected Files**:
    - `his-project/libs/common/src/auth/guards/resource-ownership.guard.ts`
    - `his-project/apps/opd-bc/src/modules/patient/controllers/patients.controller.ts`
    - `his-project/apps/opd-bc/src/modules/visit/controllers/visits.controller.ts`
    - `his-project/apps/emr-bc/src/modules/medical-record/controllers/medical-records.controller.ts`
    - `his-project/apps/finance-bc/src/modules/invoice/controllers/invoices.controller.ts`
    - `his-project/libs/common/src/auth/guards/resource-ownership.guard.spec.ts`
    - `his-project/test/e2e/ownership.e2e-spec.ts`
  - **Acceptance Criteria**:
    - `ResourceOwnershipGuard` extracts `actor.patient_id` from the verified JWT.
    - Evaluates resource ownership server-side using local database queries (`entity.patient_id === actor.patient_id`).
    - Client-supplied request body or header assertions are strictly ignored.
    - Unmatched patient requests return HTTP 403 Forbidden ("Access denied: resource belongs to another patient").
    - Missing records return HTTP 404 Not Found without leaking metadata or bypassing authorization.
    - Clinical/admin roles (`DOCTOR`, `ADMIN`) bypass patient ownership checks if authorized by permissions.
  - **Required Tests**:
    - Unit tests: `resource-ownership.guard.spec.ts`
    - E2E tests: `ownership.e2e-spec.ts` asserting Patient A receives HTTP 403 when querying Patient B's visits, medical records, or invoices.
  - **Regression Verification**: Patient A can successfully retrieve their own visits, records, and invoices (HTTP 200).
  - **Rollback Consideration**: Guard can be configured via feature flag or disabled per route if critical operational issues occur.
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 2.4 Implement PermissionGuard and granular @RequirePermission decorators
  - **Git Branch**: `feat/permission-guard`
  - **Base Branch**: `planning/compliance-remediation` (after 2.1 merged)
  - **Depends**: 2.1
  - **Merge Target**: `planning/compliance-remediation`
  - **Parallel Safe**: YES
  - **Scope / Boundary**: `PermissionsGuard` (`@app/common`, all controllers)
  - **Expected Files**:
    - `his-project/libs/common/src/auth/decorators/require-permission.decorator.ts`
    - `his-project/libs/common/src/auth/guards/permissions.guard.ts`
    - `his-project/apps/iam-bc/src/modules/user/controllers/users.controller.ts`
    - `his-project/apps/opd-bc/src/modules/visit/controllers/visits.controller.ts`
    - `his-project/apps/emr-bc/src/modules/medical-record/controllers/medical-records.controller.ts`
    - `his-project/apps/finance-bc/src/modules/invoice/controllers/invoices.controller.ts`
    - `his-project/libs/common/src/auth/guards/permissions.guard.spec.ts`
  - **Acceptance Criteria**:
    - `@RequirePermission(...permissions: string[])` decorator attaches required permission metadata to route handlers.
    - `PermissionsGuard` maps authenticated user roles to permissions (`ADMIN` -> all, `DOCTOR` -> clinical, `PATIENT` -> patient-owned, `NURSE` -> triage/visit).
    - Requests lacking required permissions receive HTTP 403 Forbidden with structured JSON:API error format.
  - **Required Tests**:
    - Unit tests: `permissions.guard.spec.ts` testing role-to-permission mapping and refusal of unauthorized access.
  - **Regression Verification**: Existing authorized endpoints continue to succeed for valid roles.
  - **Rollback Consideration**: Guard falls back to base `RolesGuard` if permission checks are unconfigured.
  - _Requirements: 2.1, 2.2_

- [x] 2.5 Implement durable PHI and billing access auditing subsystem
  - **Git Branch**: `feat/phi-audit`
  - **Base Branch**: `planning/compliance-remediation` (after 1.3 merged)
  - **Depends**: 1.3
  - **Merge Target**: `planning/compliance-remediation`
  - **Parallel Safe**: YES
  - **Scope / Boundary**: `AuditModule`, `iam_db` (`@app/common`, `apps/iam-bc`)
  - **Expected Files**:
    - `his-project/libs/common/src/audit/entities/audit-log.entity.ts`
    - `his-project/libs/common/src/audit/audit.service.ts`
    - `his-project/libs/common/src/audit/audit.module.ts`
    - `his-project/libs/common/src/audit/audit.service.spec.ts`
    - `his-project/test/integration/audit-logging.integration-spec.ts`
  - **Acceptance Criteria**:
    - `audit_logs` table created in `iam_db` with `actor_id`, `actor_role`, `action`, `resource_type`, `resource_id`, `ip_address`, `outcome`, `metadata`, `created_at`.
    - `AuditService.logAccess(...)` records asynchronous audit entries for both GRANTED and DENIED access attempts on medical records, visits, and invoices.
    - Audit logging errors fail safely without crashing primary request execution while emitting structured error logs.
  - **Required Tests**:
    - Unit tests: `audit.service.spec.ts`
    - Integration test: `audit-logging.integration-spec.ts` asserting audit rows are written to `iam_db` upon BOLA denial.
  - **Regression Verification**: Controller request latencies remain within acceptable thresholds (<50ms overhead).
  - **Rollback Consideration**: Table schema is append-only; service can be no-oped via configuration.
  - _Requirements: 2.4_

- [x] 2.6 Implement Redis-backed authentication rate limiting throttler
  - **Git Branch**: `feat/auth-rate-limit`
  - **Base Branch**: `planning/compliance-remediation` (after 1.2 merged)
  - **Depends**: 1.2
  - **Merge Target**: `planning/compliance-remediation`
  - **Parallel Safe**: YES
  - **Scope / Boundary**: `RateLimitGuard`, `iam-bc` (`@app/common`)
  - **Expected Files**:
    - `his-project/libs/common/src/throttler/rate-limit.guard.ts`
    - `his-project/libs/common/src/throttler/rate-limit.decorator.ts`
    - `his-project/apps/iam-bc/src/modules/auth/controllers/auth.controller.ts`
    - `his-project/libs/common/src/throttler/rate-limit.guard.spec.ts`
    - `his-project/test/e2e/rate-limit.e2e-spec.ts`
  - **Acceptance Criteria**:
    - `RateLimitGuard` tracks IP and user attempt counts in Redis with sliding window TTLs.
    - Requests exceeding threshold (e.g. 5 failed login attempts per minute) receive HTTP 429 Too Many Requests with `Retry-After` header.
    - Rate limit resets upon window expiration.
  - **Required Tests**:
    - Unit tests: `rate-limit.guard.spec.ts`
    - E2E tests: `rate-limit.e2e-spec.ts` verifying HTTP 429 upon 6 rapid login requests.
  - **Regression Verification**: Single valid login requests pass without delay.
  - **Rollback Consideration**: Remove guard decorator from controller routes.
  - _Requirements: 2.5_

---

## 5. Wave 2: Messaging Reliability & Observability Hardening

- [x] 3. Messaging Reliability, Idempotency, Redis Partition & Observability Hardening

- [x] 3.1 Implement atomic event reservation in idempotency engine and crash-resilient outbox state publishing
  - **Git Branch**: `feat/atomic-idempotency`
  - **Base Branch**: `planning/compliance-remediation` (after 1.3 merged)
  - **Depends**: 1.3
  - **Merge Target**: `planning/compliance-remediation`
  - **Parallel Safe**: YES
  - **Scope / Boundary**: `AtomicIdempotencyEngine`, `OutboxEventsService` (`@app/common`)
  - **Expected Files**:
    - `his-project/libs/common/src/idempotency/idempotency.service.ts`
    - `his-project/libs/common/src/outbox/outbox-events.service.ts`
    - `his-project/libs/common/src/idempotency/idempotency.service.spec.ts`
    - `his-project/test/integration/concurrency-idempotency.integration-spec.ts`
  - **Acceptance Criteria**:
    - `IdempotencyService` uses atomic `INSERT INTO processed_events (event_id, event_name) VALUES ($1, $2) ON CONFLICT DO NOTHING` inside the transaction.
    - Concurrent duplicate deliveries detect 0 inserted rows, rolling back/skipping domain mutations while safely ACKing the duplicate message.
    - Outbox publisher marks events `PUBLISHED` only after confirmed broker publish.
  - **Required Tests**:
    - Integration test: `concurrency-idempotency.integration-spec.ts` dispatching 20 parallel duplicate events, asserting exactly 1 domain entity created.
  - **Regression Verification**: Existing single-event message consumer tests pass.
  - **Rollback Consideration**: Atomic SQL statement is self-contained and backward compatible with existing `processed_events` table.
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 3.2 Configure RabbitMQ Dead-Letter Exchanges, resilient versioned queue topologies, retry backoff and operator replay CLI
  - **Git Branch**: `feat/rabbitmq-dlq-resilience`
  - **Base Branch**: `planning/compliance-remediation` (after 3.1 merged)
  - **Depends**: 3.1
  - **Merge Target**: `planning/compliance-remediation`
  - **Parallel Safe**: NO
  - **Scope / Boundary**: `RabbitMqResilienceEngine`, `amqplib` transport (`@app/common`)
  - **Expected Files**:
    - `his-project/libs/common/src/rmq/rabbitmq-options.service.ts`
    - `his-project/libs/common/src/rmq/rabbitmq-replay.service.ts`
    - `his-project/libs/contracts/src/rabbitmq.constants.ts`
    - `his-project/libs/common/src/rmq/rabbitmq-options.service.spec.ts`
    - `his-project/test/integration/rabbitmq-dlq-replay.integration-spec.ts`
  - **Acceptance Criteria**:
    - Primary exchange `his.events` dead-letters rejected messages to `his.events.dlx` (AE-3 compliant).
    - Consumer queues configured with `x-dead-letter-exchange: his.events.dlx` and `x-dead-letter-routing-key: <service>.events.dlq`.
    - **Safe Queue Migration Strategy**:
      - Test/Dev: Harness redeclares queues if argument mismatches exist (`406 PRECONDITION_FAILED` handled).
      - Production: Blue-green `.v2` queue declaration with dual binding and shovel drain (0 message loss guarantee).
    - Operator CLI `npm run replay:dlq -- --queue <queue_name>` reads quarantined DLQ messages and republishes to primary exchange.
  - **Required Tests**:
    - Unit tests: `rabbitmq-options.service.spec.ts`
    - Integration test: `rabbitmq-dlq-replay.integration-spec.ts` simulating poison message quarantine and subsequent CLI replay.
  - **Regression Verification**: Happy-path choreographed event flow completes with 0 messages dead-lettered.
  - **Rollback Consideration**: Revert queue configuration to unversioned queue names without dropping messages.
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 3.3 Implement parameterized sensitive field masking in structured logging and forward distributed trace headers across RabbitMQ hops
  - **Git Branch**: `feat/log-redaction-trace`
  - **Base Branch**: `planning/compliance-remediation`
  - **Depends**: None
  - **Merge Target**: `planning/compliance-remediation`
  - **Parallel Safe**: YES
  - **Scope / Boundary**: `StructuredLogRedactor`, `TraceInterceptor` (`@app/common`)
  - **Expected Files**:
    - `his-project/libs/common/src/logging/structured.logger.ts`
    - `his-project/libs/common/src/rmq/trace-propagation.interceptor.ts`
    - `his-project/libs/common/src/logging/structured.logger.spec.ts`
    - `his-project/test/unit/trace-propagation.spec.ts`
  - **Acceptance Criteria**:
    - `StructuredLogger` recursively replaces values of sensitive keys (`password`, `token`, `access_token`, `refresh_token`, `authorization`, `id_card`, `email`, `username`, `jti`, `secret`) with `[REDACTED]`.
    - RabbitMQ publisher injects `x-correlation-id` and `x-trace-id` into message properties headers; consumer extracts headers and binds to execution context.
  - **Required Tests**:
    - Parameterized unit tests in `structured.logger.spec.ts` covering all sensitive keys and nested JSON payloads.
  - **Regression Verification**: Standard log messages continue to output valid JSON without missing contextual fields.
  - **Rollback Consideration**: Revert log masking set; does not affect application state or API contracts.
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 3.4 Implement real Redis fail-closed lifecycle handling and connection partition protection in authentication guards
  - **Git Branch**: `fix/redis-fail-closed`
  - **Base Branch**: `planning/compliance-remediation` (after 1.2 merged)
  - **Depends**: 1.2
  - **Merge Target**: `planning/compliance-remediation`
  - **Parallel Safe**: YES
  - **Scope / Boundary**: `JwtAuthGuard`, `RedisService` (`@app/common`)
  - **Expected Files**:
    - `his-project/libs/common/src/auth/guards/jwt-auth.guard.ts`
    - `his-project/libs/common/src/redis/redis.service.ts`
    - `his-project/libs/common/src/auth/guards/jwt-auth.guard.spec.ts`
    - `his-project/test/integration/redis-fail-closed.integration-spec.ts`
  - **Acceptance Criteria**:
    - `JwtAuthGuard` catches Redis connectivity and timeout exceptions and fails closed (HTTP 401 Unauthorized or HTTP 503 Service Unavailable).
    - Under no circumstance does a Redis outage allow unverified JWT tokens to access protected routes.
  - **Required Tests**:
    - Unit tests: `jwt-auth.guard.spec.ts` simulating Redis throw.
    - Integration test: `redis-fail-closed.integration-spec.ts` pausing Redis container and asserting protected endpoints return 401/503.
  - **Regression Verification**: Protected endpoints return HTTP 200 when Redis is healthy.
  - **Rollback Consideration**: Revert guard catch block; no database or infrastructure changes involved.
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 3.5 Enforce monorepo Clean Architecture layer seams and automated cross-bounded-context import boundary rules
  - **Git Branch**: `fix/architecture-boundaries`
  - **Base Branch**: `planning/compliance-remediation`
  - **Depends**: None
  - **Merge Target**: `planning/compliance-remediation`
  - **Parallel Safe**: YES
  - **Scope / Boundary**: ESLint config, architecture boundary test suite
  - **Expected Files**:
    - `his-project/eslint.config.mjs`
    - `his-project/test/unit/architecture-boundaries.spec.ts`
  - **Acceptance Criteria**:
    - ESLint rules prohibit direct relative/absolute imports between `apps/*` folders (e.g. `apps/opd-bc` importing from `apps/emr-bc`).
    - Cross-bounded-context communication strictly restricted to `@app/contracts` and `@app/common`.
    - Automated architecture test scans all TypeScript files and asserts 0 boundary violations.
  - **Required Tests**:
    - Architecture test: `npm test test/unit/architecture-boundaries.spec.ts`
    - Linter check: `npm run lint:check`
  - **Regression Verification**: Monorepo builds cleanly with zero ESLint warnings.
  - **Rollback Consideration**: Revert ESLint boundary overrides if unexpected third-party tool issues occur.
  - _Requirements: 7.1, 7.2, 7.3_

---

## 6. Wave 3: Blueprint Conformance & Metadata Standardization

- [x] 4. Enterprise Blueprint Conformance: Entity Standards, API Decorators & Naming Gates

- [x] 4.1 Standardize TypeORM entity schema metadata with ITimestamp contract, explicit database keys, comments, and timestamptz typing
  - **Git Branch**: `feat/entity-standards`
  - **Base Branch**: `planning/compliance-remediation` (after 1.3, 2.2 merged)
  - **Depends**: 1.3, 2.2
  - **Merge Target**: `planning/compliance-remediation`
  - **Parallel Safe**: YES
  - **Scope / Boundary**: `EntityMetadataModule`, all `@Entity` definitions (`apps/*`, `@app/common`)
  - **Expected Files**:
    - `his-project/libs/common/src/entities/timestamp.interface.ts` (export `ITimestamp`)
    - `his-project/apps/opd-bc/src/modules/patient/entities/patient.entity.ts`
    - `his-project/apps/opd-bc/src/modules/visit/entities/visit.entity.ts`
    - `his-project/apps/emr-bc/src/modules/medical-record/entities/medical-record.entity.ts`
    - `his-project/apps/finance-bc/src/modules/invoice/entities/invoice.entity.ts`
    - `his-project/apps/iam-bc/src/modules/user/entities/user.entity.ts`
    - `his-project/libs/common/src/outbox/outbox-event.entity.ts`
    - `his-project/libs/common/src/idempotency/processed-event.entity.ts`
    - `his-project/test/unit/entity-metadata.spec.ts`
  - **Acceptance Criteria**:
    - Export `ITimestamp` interface in `@app/common` with `created_at: Date`, `updated_at: Date`, `deleted_at?: Date | null`.
    - All domain entities implement `ITimestamp` where applicable and use `Date | null` for nullable timestamps.
    - All entity classes declare explicit `database: '<bc>_db'` in `@Entity()`.
    - All column definitions include descriptive `comment: '...'`.
    - Timestamp columns use `type: 'timestamptz'`.
    - Primary keys use column `id` with constraint `pk_<table_name>`.
    - Foreign keys use column `<ref>_id` with constraint `fk_<table>_<ref>`.
  - **Required Tests**:
    - Metadata test: `test/unit/entity-metadata.spec.ts` reflecting on TypeORM metadata to verify 100% compliance.
  - **Regression Verification**: Entity CRUD unit and integration tests pass.
  - **Rollback Consideration**: Non-breaking annotations; entity metadata reflects database schema directly.
  - _Requirements: 11.1, 11.2, 11.3_

- [x] 4.2 Standardize controller endpoint annotations with JSON:API response decorators and explicit permission metadata
  - **Git Branch**: `feat/blueprint-decorators`
  - **Base Branch**: `planning/compliance-remediation` (after 2.4 merged)
  - **Depends**: 2.4
  - **Merge Target**: `planning/compliance-remediation`
  - **Parallel Safe**: YES
  - **Scope / Boundary**: `BlueprintDecoratorEngine`, all HTTP controllers (`apps/*`)
  - **Expected Files**:
    - `his-project/libs/common/src/response/decorators/api-success-response.decorator.ts`
    - `his-project/libs/common/src/response/decorators/api-error-response.decorator.ts`
    - `his-project/apps/opd-bc/src/modules/patient/controllers/patients.controller.ts`
    - `his-project/apps/opd-bc/src/modules/visit/controllers/visits.controller.ts`
    - `his-project/apps/emr-bc/src/modules/medical-record/controllers/medical-records.controller.ts`
    - `his-project/apps/finance-bc/src/modules/invoice/controllers/invoices.controller.ts`
    - `his-project/apps/iam-bc/src/modules/auth/controllers/auth.controller.ts`
    - `his-project/apps/iam-bc/src/modules/user/controllers/users.controller.ts`
    - `his-project/test/unit/controller-metadata.spec.ts`
  - **Acceptance Criteria**:
    - **AE-1 Alignment**: Annotations apply to direct root endpoints (`/patients`, `/visits`, `/records`, `/invoices`), preserving exact assignment URLs.
    - All non-health controller methods annotated with `@ApiOperation`, explicit `@HttpCode`, `@ApiSuccessResponse`, `@ApiErrorResponse`, and `@RequirePermission`.
    - Response interceptor formats all data output in JSON:API envelopes (`data: { id, type, attributes }`).
  - **Required Tests**:
    - Metadata test: `test/unit/controller-metadata.spec.ts` verifying all endpoints declare required decorators.
  - **Regression Verification**: API responses conform to OpenAPI contracts without breaking clients.
  - **Rollback Consideration**: Revert controller decorators; response formatting logic is preserved in interceptor.
  - _Requirements: 12.1, 12.2, 12.3_

- [x] 4.3 Implement comprehensive architecture naming convention test suites across all monorepo modules and symbols
  - **Git Branch**: `test/naming-conventions`
  - **Base Branch**: `planning/compliance-remediation` (after 4.1, 4.2 merged)
  - **Depends**: 4.1, 4.2
  - **Merge Target**: `planning/compliance-remediation`
  - **Parallel Safe**: NO
  - **Scope / Boundary**: Naming test suites across all apps and libs
  - **Expected Files**:
    - `his-project/apps/opd-bc/test/unit/opd-naming.spec.ts`
    - `his-project/apps/emr-bc/test/unit/emr-naming.spec.ts`
    - `his-project/apps/finance-bc/test/unit/invoice-naming.spec.ts`
    - `his-project/apps/iam-bc/test/unit/user-naming.spec.ts`
  - **Acceptance Criteria**:
    - Tests verify:
      - Modules named `Singular + Module` (`PatientModule`, `VisitModule`, `InvoiceModule`)
      - Controllers named `Plural + Controller` (`PatientsController`, `VisitsController`, `InvoicesController`)
      - Event controllers named `Singular + EventsController` (`VisitEventsController`, `InvoiceEventsController`)
      - Services named `Plural + Service` (`PatientsService`, `VisitsService`, `InvoicesService`)
      - Database table and column names use `snake_case` with standard constraint prefixes (`pk_`, `fk_`, `uq_`, `idx_`, `chk_`).
      - **AE-2 Alignment**: `iam-bc` allowed as an approved architectural exception for monorepo consistency.
  - **Required Tests**:
    - Unit tests: `npm test -- --testPathPattern="naming.spec.ts"`
  - **Regression Verification**: 100% pass rate across naming test suites.
  - **Rollback Consideration**: Test-only changes; no runtime impact.
  - _Requirements: 13.1, 13.2, 13.3_

---

## 7. Wave 4: CI, Conformance Gates & Documentation Synchronization

- [x] 5. CI Pipeline, Automated Conformance Verification & Documentation Drift Prevention

- [x] 5.1 Build automated end-to-end OpenAPI 3.0 schema and contract conformance verification test suite
  - **Git Branch**: `test/openapi-contract`
  - **Base Branch**: `planning/compliance-remediation` (after 1.1, 4.2 merged)
  - **Depends**: 1.1, 4.2
  - **Merge Target**: `planning/compliance-remediation`
  - **Parallel Safe**: YES
  - **Scope / Boundary**: `OpenApiContractSuite`, Swagger schemas across all 4 apps
  - **Expected Files**:
    - `his-project/test/e2e/openapi-contract.e2e-spec.ts`
  - **Acceptance Criteria**:
    - E2E test boots all 4 services, fetches `/docs-json` from ports 3000, 3001, 3002, 3003, and validates against OpenAPI 3.0 schema validator.
    - Asserts Bearer authentication security schemes and JSON:API envelope schemas are defined for all operations.
  - **Required Tests**:
    - E2E test: `npm run test:e2e -- test/e2e/openapi-contract.e2e-spec.ts`
  - **Regression Verification**: Swagger UI at `/docs` renders all endpoints without schema errors.
  - **Rollback Consideration**: Test-only changes.
  - _Requirements: 14.1, 14.2, 14.3_

- [x] 5.2 Add Newman Postman test runner scripts, pre-request script fixtures and automated execution in CI
  - **Git Branch**: `test/postman-newman`
  - **Base Branch**: `planning/compliance-remediation` (after 2.1, 2.3, 2.4 merged)
  - **Depends**: 2.1, 2.3, 2.4
  - **Merge Target**: `planning/compliance-remediation`
  - **Parallel Safe**: YES
  - **Scope / Boundary**: `NewmanPostmanSuite`, `docs/postman/his.postman_collection.json`
  - **Expected Files**:
    - `docs/postman/his.postman_collection.json`
    - `his-project/package.json` (add `"test:postman": "newman run ..."` script)
  - **Acceptance Criteria**:
    - Postman collection refactored: removes insecure public admin registration, uses dynamic patient authentication and pre-seeded admin credentials.
    - Newman runner executes the complete outpatient workflow (Registration → Visit → Treatment → Invoice → Payment → Closure) with 0 assertion failures.
  - **Required Tests**:
    - Postman runner: `npm run test:postman`
  - **Regression Verification**: Live flow test `npm run test:flow` also passes cleanly.
  - **Rollback Consideration**: Restore previous Postman collection file if needed.
  - _Requirements: 15.1, 15.2, 15.3_

- [x] 5.3 Harden CI workflow with automated dependency audit, SAST, schema isolation validation, and Newman live-stack gates
  - **Git Branch**: `ci/harden-workflow`
  - **Base Branch**: `planning/compliance-remediation` (after 1.1, 1.3, 5.1, 5.2 merged)
  - **Depends**: 1.1, 1.3, 5.1, 5.2
  - **Merge Target**: `planning/compliance-remediation`
  - **Parallel Safe**: NO
  - **Scope / Boundary**: `.github/workflows/ci.yml`
  - **Expected Files**:
    - `.github/workflows/ci.yml`
  - **Acceptance Criteria**:
    - CI workflow runs in sequence:
      1. Linting & Clean Architecture boundary tests
      2. Production dependency vulnerability audit (`npm audit --omit=dev --audit-level=low`)
      3. Unit and naming test suites
      4. Database migrations on clean empty PostgreSQL instances
      5. Schema isolation integration tests
      6. Microservices startup & health check verification
      7. OpenAPI 3.0 schema contract validation
      8. Newman Postman automated E2E workflow
  - **Required Tests**:
    - CI run: GitHub Actions workflow completion with green checkmarks across all jobs.
  - **Regression Verification**: CI run time remains under 10 minutes.
  - **Rollback Consideration**: Revert workflow YAML changes.
  - _Requirements: 16.1, 16.2, 16.3_

- [x] 5.4 Synchronize root documentation and implement automated documentation/RBAC drift verification test suite
  - **Git Branch**: `docs/sync-and-drift-test`
  - **Base Branch**: `planning/compliance-remediation` (after 2.1, 4.2 merged)
  - **Depends**: 2.1, 4.2
  - **Merge Target**: `planning/compliance-remediation`
  - **Parallel Safe**: YES
  - **Scope / Boundary**: Documentation & drift test suite
  - **Expected Files**:
    - `README.md`
    - `docs/ARCHITECTURE.md`
    - `his-project/test/unit/documentation-drift.spec.ts`
  - **Acceptance Criteria**:
    - `README.md` updated with accurate service ports (3000-3003), logical database schema ownership, migration commands, and complete RBAC permission matrix.
    - Automated test `documentation-drift.spec.ts` parses `README.md` permission tables and compares against live controller route metadata (`@RequirePermission` / `@Roles`), asserting 0 drift.
    - Stale/duplicate documentation files consolidated.
  - **Required Tests**:
    - Documentation drift test: `npm test test/unit/documentation-drift.spec.ts`
  - **Regression Verification**: Markdown formatting renders cleanly on GitHub.
  - **Rollback Consideration**: Restore previous documentation files.
  - _Requirements: 17.1, 17.2, 17.3_

---

## 8. Wave 5: Final Verification & Tiered Compliance Audit Gate

- [x] 6. Comprehensive Full-Stack Verification & Tiered Audit Gate

- [x] 6.1 Execute full compliance test suite and run his-compliance-audit to achieve READY verdict
  - **Git Branch**: `audit/final-compliance-verification`
  - **Base Branch**: `planning/compliance-remediation` (all previous tasks merged)
  - **Depends**: All tasks (1.1 through 5.4)
  - **Merge Target**: `main` (via PR from `planning/compliance-remediation`)
  - **Parallel Safe**: NO
  - **Scope / Boundary**: Full monorepo codebase & live stack execution
  - **Expected Files**:
    - `docs/HIS_COMPLIANCE_AUDIT_2026-08-26.md` (Updated audit report with tiered verification breakdown)
  - **Tiered Acceptance Criteria**:
    1. **Assignment Core Mandatory Compliance**: 100% VERIFIED across all mandatory Gist items (OPD/EMR/Finance microservices, separate `opd_db`/`emr_db`/`finance_db`, zero cross-DB joins, RabbitMQ event choreography `visit.created` → `treatment.completed` → `invoice.paid` → `CLOSED`, Swagger `/docs`, strict validation).
    2. **Applicable Blueprint Mandatory Standards**: 100% VERIFIED across applicable Blueprint rules (Entity `database`, column `comment`, `ITimestamp`, `snake_case` properties, JSON:API response decorators, `@RequirePermission` fine-grained authorization, fail-closed secrets, dynamic TTL).
    3. **Security Hardening & Advanced Features**: Implemented and verified (Atomic idempotency DB lock, RabbitMQ DLX/DLQ & replay, server-side BOLA ownership projections, Redis fail-closed lifecycle, structured log redaction).
    4. **Documented Architectural Exceptions**: AE-1 (Direct root routes), AE-2 (`iam-bc` naming), and AE-3 (RabbitMQ transport) explicitly recognized and approved without penalty.
    - Final audit verdict: **READY** for production and assignment delivery.
  - **Required Tests**:
    - Complete automated test suite: `npm run lint:check`, `npm run build`, `npm test`, `npm run test:e2e`, `npm run test:flow`, `npm run test:postman`.
    - Full-stack runtime verification with `his-compliance-audit`.
  - **Regression Verification**: Full end-to-end outpatient healthcare journey executes flawlessly on live stack.
  - **Rollback Consideration**: Release branch `planning/compliance-remediation` is only merged into `main` after this gate passes unconditionally.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3, 9.4, 10.1, 10.2, 10.3, 10.4, 11.1, 11.2, 11.3, 12.1, 12.2, 12.3, 13.1, 13.2, 13.3, 14.1, 14.2, 14.3, 15.1, 15.2, 15.3, 16.1, 16.2, 16.3, 17.1, 17.2, 17.3_
