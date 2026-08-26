# Requirements Document: Compliance Remediation

## Introduction

This specification defines the complete set of brownfield remediation requirements for the Hospital Information System (HIS) Microservices platform (consisting of `opd-bc`, `emr-bc`, `finance-bc`, `iam-bc`, and shared common libraries).

The goal is to remediate all 17 finding areas (R1–R17) and 15 missing automated test domains identified in [`docs/HIS_COMPLIANCE_AUDIT_2026-08-26.md`](file:///Users/tanakitchuchoed/Documents/GitHub/his-microservices-assignment/docs/HIS_COMPLIANCE_AUDIT_2026-08-26.md) to elevate the system from its current audit verdict of **NOT READY** (63.2% verified) to a verified **READY** state against the [Enterprise Backend Blueprint](https://iots1.github.io/enterprise-backend-blueprint/) and the [HIS Internship Assignment](https://gist.github.com/iots1/e5d1b5c19b39171a96b236af4a0a7f27).

Existing verified functionality—including service bootstrap on ports 3000/3001/3002/3003, OpenAPI exposure, transactional outbox publishing, end-to-end RabbitMQ choreographed event flows (`visit.created` → `treatment.completed` → `invoice.paid` → `CLOSED`), and baseline test suites—must be strictly preserved.

## Boundary Context

- **In Scope**:
  - Remediations R1 through R17 and Automated Test Domains 1 through 15.
  - Role-based and object-level resource ownership (BOLA prevention) access control across all bounded contexts.
  - Per-bounded-context logical database schema isolation and TypeORM migrations with `synchronize: false`.
  - Concurrency-safe event deduplication and outbox crash-resilient publishing.
  - RabbitMQ Dead-Letter Exchange (DLX), Dead-Letter Queue (DLQ), bounded retry/backoff, and operator replay mechanism.
  - Fail-closed secret configuration with entropy validation and ephemeral integration test session lifecycle.
  - Real Redis lifecycle validation and fail-closed authentication guard behavior during network partitions.
  - Elimination of production dependency vulnerabilities (`js-yaml` / `@nestjs/swagger`).
  - Standardized JSON:API decorators, structured log masking, distributed trace propagation, and naming convention enforcement.
  - Automated CI verification gates including Newman Postman execution, OpenAPI schema validation, and documentation drift checks.

- **Out of Scope**:
  - Modifying the core business workflow stages (OPD visit → EMR medical record → Finance invoice → Payment → OPD visit closure).
  - Introducing cross-database foreign keys or distributed two-phase commit transactions.
  - Replacing primary technology components (NestJS 11, PostgreSQL 16, RabbitMQ 3, Redis 7).

- **Adjacent Expectations**:
  - Single PostgreSQL instance hosting 4 isolated logical databases (`opd_db`, `emr_db`, `finance_db`, `iam_db`).
  - RabbitMQ broker providing topic exchange `his.events` and service-specific consumer queues.
  - Redis instance on port 6379 providing token blacklisting, active session registry, and rate-limiting storage.

---

## Requirements

### Priority 1: CRITICAL (Security & Access Control)

---

### Requirement 1: Public Role Escalation Prevention & Privileged Role Provisioning
- **Audit Finding ID**: R1 (SEC-001)
- **Severity**: CRITICAL
- **Problem Statement**: The public user registration endpoint (`POST /auth/register`) accepts a `role` attribute in the request body, allowing unauthenticated attackers to self-assign privileged roles such as `ADMIN` or `DOCTOR`.
- **Expected Behavior**: Public registration strictly rejects any role parameter or unconditionally creates users with the default `PATIENT` role. Privileged role assignments are restricted to a dedicated administrative endpoint (`PATCH /users/:id/role`) protected by administrator role and explicit permission checks.
- **Affected Bounded Contexts / Modules**: `apps/iam-bc/` (AuthModule, UserModule, DTOs, Guards).
- **Backward Compatibility Constraints**: Valid patient registration requests containing only standard user attributes (`username`, `password`, `email`, `id_card`, `first_name`, `last_name`) continue to succeed with HTTP 201 Created.

#### Acceptance Criteria
1. When an unauthenticated client submits a registration request containing a `role` property, the IAM Service shall reject the request with HTTP 400 Bad Request.
2. When an unauthenticated client submits a valid registration request without a `role` property, the IAM Service shall create the user account with `PATIENT` role and return HTTP 201 Created.
3. When an authenticated user with `ADMIN` role and `user:manage-roles` permission submits a valid role update request to `PATCH /users/:id/role`, the IAM Service shall update the target user's role and return HTTP 200 OK.
4. If an authenticated non-administrator user or a user lacking `user:manage-roles` permission attempts to access `PATCH /users/:id/role`, then the IAM Service shall deny the request with HTTP 403 Forbidden.

#### Required Automated Tests
- **Test Domain 1**: Anonymous privileged-role registration rejection, default `PATIENT` assignment assertion, administrator role update success, and unauthorized role update rejection.

---

### Requirement 2: Patient Resource Ownership Authorization (BOLA Prevention), Durable Access Audit & Rate Limiting
- **Audit Finding ID**: R5 (SEC-002, SEC-003, SEC-008)
- **Severity**: CRITICAL
- **Problem Statement**: Authorization checks in OPD, EMR, and Finance bounded contexts verify only high-level user roles but do not verify object-level resource ownership (Broken Object Level Authorization / BOLA). A user with `PATIENT` role can access or query another patient's visits, medical records, or invoices. Furthermore, access to sensitive Protected Health Information (PHI) and billing records lacks durable audit logging, and authentication endpoints lack rate limiting.
- **Expected Behavior**: A granular permission and resource ownership guard (`@RequirePermission`) evaluates actor identity, role, target resource ID, and patient ownership mapping (`patient_id`). A `PATIENT` actor attempting to access resources belonging to another patient is rejected with HTTP 403 Forbidden. Every PHI and financial record access emits a durable audit record. Authentication and sensitive endpoints enforce Redis-backed rate limiting.
- **Affected Bounded Contexts / Modules**: `apps/opd-bc/`, `apps/emr-bc/`, `apps/finance-bc/`, `apps/iam-bc/`, `libs/common/` (Guards, Interceptors, Audit Module, Rate Limit Throttler).
- **Backward Compatibility Constraints**: Authorized doctors, administrators, and patients accessing their own records must continue to receive standard response envelopes and HTTP 200/201 status codes.

#### Acceptance Criteria
1. When an authenticated user with `PATIENT` role requests an OPD patient or visit resource, the OPD Service shall verify that the resource's `patient_id` matches the actor's associated patient ID before granting access.
2. If an authenticated user with `PATIENT` role requests an OPD, EMR, or Finance resource belonging to another patient, the requested Service shall return HTTP 403 Forbidden.
3. Where an authenticated user has `DOCTOR` or `ADMIN` role with valid clinical or administrative permissions, the system shall grant access to clinical and visit resources in accordance with their role permissions.
4. When any client accesses or modifies PHI records (patient details, medical records, diagnoses, treatments) or financial invoices, the Audit Subsystem shall persist a durable audit log record capturing actor ID, action, resource ID, timestamp, IP, and outcome.
5. If incoming requests to authentication endpoints (`/auth/register`, `/auth/login`, `/auth/refresh`) exceed the configured rate limit threshold, the IAM Service shall reject subsequent requests with HTTP 429 Too Many Requests.

#### Required Automated Tests
- **Test Domain 2**: Cross-patient BOLA/ownership denial for every patient-visible OPD, EMR, and Finance route.
- **Test Domain 11**: Durable PHI and billing access audit persistence and query verification.
- **Test Domain 12**: Rate-limit enforcement and header reset behavior under load.

---

### Priority 2: HIGH (Security & Dependency Vulnerabilities)

---

### Requirement 3: Production Dependency Vulnerability Remediation
- **Audit Finding ID**: R17 (SEC-004, HIS-035)
- **Severity**: HIGH
- **Problem Statement**: Production dependencies contain high-severity security vulnerabilities (GHSA-pm4m-ph32-ghv5 in transitive `js-yaml` dependency resolved by `@nestjs/swagger@11.4.6`), causing production dependency security scans to fail.
- **Expected Behavior**: Dependency graph and lockfile are updated to patched, secure package versions such that production dependency scans yield zero high- or critical-severity vulnerabilities.
- **Affected Bounded Contexts / Modules**: Root `package.json`, `package-lock.json`, and all bounded contexts consuming `@nestjs/swagger`.
- **Backward Compatibility Constraints**: OpenAPI 3.0.0 specification generation, Swagger UI rendering at `/docs`, and Swagger decorators must remain fully functional.

#### Acceptance Criteria
1. The Package Manager shall resolve all runtime production dependencies without transitive packages affected by GHSA-pm4m-ph32-ghv5.
2. When `npm audit --omit=dev --audit-level=low` is executed, the Build System shall report 0 vulnerabilities and exit with code 0.
3. While executing production applications, the Swagger documentation UI and JSON endpoints (`/docs`, `/docs-json`) shall function without regression.

#### Required Automated Tests
- **Test Domain 15**: Production dependency audit gate (`npm audit --omit=dev`).

---

### Requirement 4: Fail-Closed Secret Configuration & Ephemeral Test Session Management
- **Audit Finding ID**: R8 (SEC-005, SEC-006, SEC-007)
- **Severity**: HIGH
- **Problem Statement**: JWT secrets (`JWT_SECRET`, `JWT_REFRESH_SECRET`) fall back to hardcoded default development strings if unconfigured, secrets lack runtime entropy validation at startup, token TTL values ignore configured environment variables, and live integration tests leave persistent test sessions in Redis.
- **Expected Behavior**: IAM and consumer services enforce fail-closed configuration via `ConfigService.getOrThrow`, refusing to start if JWT secrets are missing or fail minimum entropy requirements (minimum 32 characters / 256 bits). JWT TTL configuration values are parsed and validated. Test flows dynamically provision short-lived test credentials and revoke them cleanly in lifecycle `finally` blocks.
- **Affected Bounded Contexts / Modules**: `apps/iam-bc/`, `libs/common/` (ConfigModule, JwtModule, AuthModule, Test scripts).
- **Backward Compatibility Constraints**: Local `.env` and `.env.example` configurations containing strong secrets continue to boot cleanly.

#### Acceptance Criteria
1. If any required security secret (`JWT_SECRET`, `JWT_REFRESH_SECRET`) is missing or shorter than 32 characters in a non-test environment, the IAM Service shall abort startup with a descriptive configuration error.
2. When validating JWT expiration, the IAM Service shall enforce the duration configured in `JWT_ACCESS_EXPIRES_IN` and `JWT_REFRESH_EXPIRES_IN`.
3. When automated integration flow tests (`npm run test:flow`) complete or encounter errors, the Test Runner shall revoke all created sessions and blacklist tokens in Redis during test teardown.

#### Required Automated Tests
- **Test Domain 15**: Negative boot tests proving refusal of missing/weak secrets, secret configuration validation, and ephemeral test credential cleanup.

---

### Requirement 5: Real Redis Lifecycle & Fail-Closed Guard Verification
- **Audit Finding ID**: R16 (SEC-002, BP-021)
- **Severity**: HIGH
- **Problem Statement**: Redis integration for session tracking, token blacklisting, and rate limiting lacks automated integration tests against real Redis instances covering connection failures and network partitions.
- **Expected Behavior**: Authentication guards and token verification layers fail closed (returning HTTP 401 or HTTP 503) when Redis is unreachable, preventing unverified or revoked tokens from bypassing validation during outages.
- **Affected Bounded Contexts / Modules**: `apps/iam-bc/`, `libs/common/` (RedisService, AuthGuard, TokenBlacklistService).
- **Backward Compatibility Constraints**: Normal valid token authentication succeeds with sub-millisecond overhead when Redis is healthy.

#### Acceptance Criteria
1. While Redis is operational, the IAM Service shall validate active sessions and reject blacklisted tokens with HTTP 401 Unauthorized.
2. If the Redis server becomes unavailable or disconnected, the Auth Guard shall fail closed and reject incoming protected requests with HTTP 401 Unauthorized or HTTP 503 Service Unavailable without executing route handlers.
3. When an authenticated user logs out, the IAM Service shall remove the active session and blacklist the access token JTI in Redis until its natural expiration.

#### Required Automated Tests
- **Test Domain 5**: Real Redis lifecycle, token revocation, refresh rotation replay detection, and real Redis fail-closed integration test.

---

### Priority 3: Architecture Blockers (Schema Isolation & Clean Architecture)

---

### Requirement 6: Deterministic Schema Isolation & Migration Ownership
- **Audit Finding ID**: R2 (HIS-005, HIS-006, HIS-032, SEC-011)
- **Severity**: ARCHITECTURE BLOCKER / HIGH
- **Problem Statement**: TypeORM configuration uses global entity autoloading and `synchronize: true`, resulting in every logical database (`opd_db`, `emr_db`, `finance_db`, `iam_db`) containing all tables from all bounded contexts, violating database-per-service isolation and migration requirements.
- **Expected Behavior**: Each bounded context specifies an explicit entity allowlist containing only its own domain entities plus shared outbox/processed event entities. Database synchronization is disabled (`synchronize: false`), and each bounded context manages its schema through dedicated TypeORM migrations executed at startup or via CLI.
- **Affected Bounded Contexts / Modules**: `apps/opd-bc/`, `apps/emr-bc/`, `apps/finance-bc/`, `apps/iam-bc/`, `libs/common/` (DatabaseModule, TypeORM migration files).
- **Backward Compatibility Constraints**: All existing table names, column types, foreign keys, and indexes must match the HIS assignment specification exactly.

#### Acceptance Criteria
1. The Database Layer shall disable runtime schema synchronization (`synchronize: false`) for all production and E2E database connections.
2. Each Bounded Context shall register an explicit entity list containing only its context-specific tables and shared outbox/idempotency tables.
3. When migrations run against an empty database, each Bounded Context shall create only its designated tables without cross-database table contamination.
4. If an unknown table is detected in a bounded context's logical database schema, the Schema Validation Test shall fail.

#### Required Automated Tests
- **Test Domain 3**: Per-database table/constraint allowlist test after migrations and E2E suite.
- **Test Domain 4**: Migration execution from empty database with `synchronize: false` for all 4 services.

---

### Requirement 7: Clean-Architecture Layer Seams & Dependency Boundary Enforcement
- **Audit Finding ID**: R15 (BP-001, BP-004, BP-026)
- **Severity**: ARCHITECTURE BLOCKER
- **Problem Statement**: Business logic in services is tightly coupled to TypeORM repositories, HTTP decorators, and external frameworks, lacking clear hexagonal/clean-architecture seams between domain entities, use case application services, and infrastructure adapters. Cross-context boundary linting is not automated.
- **Expected Behavior**: Domain logic and business invariants are encapsulated within core domain models/entities, application services orchestrate use cases, and repository/transport logic resides in adapter layers. ESLint rules strictly forbid cross-bounded-context imports and enforce inward dependency flow.
- **Affected Bounded Contexts / Modules**: Root `.eslintrc.js` / ESLint config, `apps/opd-bc/`, `apps/emr-bc/`, `apps/finance-bc/`, `apps/iam-bc/`, `libs/contracts/`.
- **Backward Compatibility Constraints**: Existing public service method signatures and contract event payload interfaces remain unchanged.

#### Acceptance Criteria
1. The Linter shall enforce dependency boundaries such that no bounded context application imports code from another bounded context application.
2. Bounded Context Applications shall communicate inter-service contracts exclusively via the `@app/contracts` shared library.
3. Domain Entities and Use Cases shall execute core business validation independently of transport controllers and external database drivers.

#### Required Automated Tests
- Architecture Boundary Lint Rule Verification and Monorepo Dependency Graph Test.

---

### Priority 4: Reliability (Idempotency, Messaging & Observability)

---

### Requirement 8: Concurrency-Safe Event Deduplication & Crash-Resilient Outbox
- **Audit Finding ID**: R3 (HIS-015, HIS-016, HIS-017)
- **Severity**: RELIABILITY / HIGH
- **Problem Statement**: Consumer idempotency uses a non-atomic check-then-insert pattern on `processed_events`, which is susceptible to race conditions under concurrent delivery of duplicate messages. In addition, an outbox publisher crash after broker publish but before database commit may result in duplicate event dispatch without recovery.
- **Expected Behavior**: Inbound message handlers atomically claim event IDs using database-level unique constraint handling or `INSERT ... ON CONFLICT DO NOTHING` within the domain transaction. Outbox publishers handle publish confirmations, retry unconfirmed messages safely, and prevent perpetual reprocessing.
- **Affected Bounded Contexts / Modules**: `libs/common/` (IdempotencyService, OutboxEventsService, OutboxRelayService), consumer controllers in all bounded contexts.
- **Backward Compatibility Constraints**: Preserves all existing event routing keys (`visit.created`, `treatment.completed`, `invoice.paid`) and payload schemas.

#### Acceptance Criteria
1. When duplicate messages with identical `eventId` are delivered concurrently to a consumer, the Consumer Service shall process the business mutation exactly once and acknowledge all duplicates.
2. If an event ID has already been recorded in `processed_events`, the Consumer Service shall acknowledge the message immediately and skip domain mutation.
3. When an outbox relay publishes an event, the Outbox Publisher shall mark `published_at` within a persistent transaction upon broker confirmation.
4. If the Outbox Publisher restarts or crashes after publishing, subsequent relay runs shall handle unacknowledged outbox records without creating duplicate unhandled state.

#### Required Automated Tests
- **Test Domain 6**: Concurrent duplicate-event delivery test (parallel concurrent event invocations).
- **Test Domain 8**: Outbox crash after publish before `published_at` update test.

---

### Requirement 9: Poison-Message Handling, Dead-Letter Recovery & Operator Replay
- **Audit Finding ID**: R4 (SEC-010, HIS-007, HIS-008)
- **Severity**: RELIABILITY / HIGH
- **Problem Statement**: RabbitMQ consumers reject malformed, poison, or unprocessable messages without a Dead-Letter Exchange (DLX) or Dead-Letter Queue (DLQ), resulting in lost messages or unhandled queue blockage. No operator replay tooling exists.
- **Expected Behavior**: RabbitMQ topology defines dead-letter exchanges (`his.events.dlx`) and dedicated dead-letter queues (`*.dlq`) with bounded exponential retry policies (maximum retry attempts with backoff). Unprocessable messages are quarantined in DLQ with original headers and error traces. An administrative replay CLI/service enables controlled redelivery of dead-lettered events.
- **Affected Bounded Contexts / Modules**: `libs/common/` (RabbitMQ transport, DLQ handler, Replay service), `libs/contracts/`.
- **Backward Compatibility Constraints**: Existing main queues (`opd.events`, `emr.events`, `finance.events`) and topic exchange (`his.events`) bindings remain intact.

#### Acceptance Criteria
1. When a consumer fails to process a message due to a transient error, the Message Broker shall retry delivery with exponential backoff up to the maximum retry count.
2. If a message exceeds maximum retry attempts or fails due to an unrecoverable validation error, the Message Broker shall route the message to the Dead-Letter Queue preserving error context and trace headers.
3. When an operator triggers a DLQ replay command, the Replay Service shall redeliver quarantined messages to the primary service queue.
4. Where a broker disconnect occurs, the RabbitMQ Connection Manager shall buffer outgoing messages and reconnect automatically without losing events.

#### Required Automated Tests
- **Test Domain 7**: DLQ routing, bounded retry/backoff, poison event quarantine, broker restart, and operator replay test.

---

### Requirement 10: Typed Exceptions, Sensitive Field Log Masking & Distributed Trace Propagation
- **Audit Finding ID**: R10 (SEC-009, BP-019, BP-020)
- **Severity**: RELIABILITY / MEDIUM
- **Problem Statement**: Generic exceptions leak internal implementation details in error responses. Routine application logs contain unmasked sensitive fields (passwords, tokens, national ID cards, email addresses, usernames, and JWT IDs). Distributed trace headers (`x-correlation-id`, `x-trace-id`, `x-span-id`) are not consistently propagated through asynchronous message hops into downstream log entries.
- **Expected Behavior**: All HTTP and microservice exceptions use standardized typed exceptions conforming to JSON:API error envelopes. The structured logger redacts all sensitive fields before outputting JSON. Distributed trace headers are preserved and propagated from HTTP controllers through RabbitMQ event headers into consumer logs.
- **Affected Bounded Contexts / Modules**: `libs/common/` (StructuredLogger, GlobalExceptionFilter, TracingMiddleware, RmqClientService).
- **Backward Compatibility Constraints**: Structured JSON log format (`timestamp`, `level`, `message`, `service`, `trace`, `context`) remains backward-compatible with log aggregators.

#### Acceptance Criteria
1. When logging any message or object containing sensitive fields (passwords, tokens, authorization headers, national ID card numbers, emails, JTIs), the Structured Logger shall redact sensitive values with `[REDACTED]`.
2. When an error occurs during HTTP request execution, the Global Exception Filter shall return a standardized JSON:API error envelope with appropriate HTTP status code and non-leaking error message.
3. When an HTTP request initiates an asynchronous domain event, the Event Publisher shall attach `x-correlation-id` and `x-trace-id` to the RabbitMQ message headers.
4. When an asynchronous message is consumed, the Event Consumer Logger shall log downstream operations containing the originating correlation and trace identifiers.

#### Required Automated Tests
- **Test Domain 10**: Trace propagation from HTTP through RabbitMQ hops to logs.
- **Test Domain 11**: Parameterized log redaction test covering all sensitive fields.

---

### Priority 5: Blueprint Conformance (Entities, API & Naming)

---

### Requirement 11: Entity & Database Schema Standard Conformance
- **Audit Finding ID**: R6 (BP-006, BP-007, BP-008, BP-009)
- **Severity**: BLUEPRINT CONFORMANCE / MEDIUM
- **Problem Statement**: TypeORM entities lack explicit `database:` connection parameters, non-sensitive column `comment:` metadata is missing, timestamp fields do not uniformly use `timestamptz`, and nullability between TypeScript types, database schema, and OpenAPI documentation has discrepancies.
- **Expected Behavior**: All entity definitions include explicit database keys, column comments, `timestamptz` timestamp types, named constraints (`pk_*`, `fk_*`, `uq_*`, `idx_*`, `chk_*`), and strict TypeScript/DB nullability alignment.
- **Affected Bounded Contexts / Modules**: `apps/opd-bc/`, `apps/emr-bc/`, `apps/finance-bc/`, `apps/iam-bc/` (All Entity files).
- **Backward Compatibility Constraints**: Table names and column names in PostgreSQL remain identical.

#### Acceptance Criteria
1. The ORM Entity Definitions shall specify explicit `database` configuration, table name, and named primary key constraint for every entity.
2. The ORM Entity Columns shall specify non-empty, descriptive `comment` metadata and appropriate PostgreSQL data types (`timestamptz`, `varchar`, `uuid`, `numeric`).
3. The Schema Metadata Test shall inspect all registered TypeORM entities and assert 100% compliance with naming, commenting, typing, and constraint conventions.

#### Required Automated Tests
- Entity Schema Metadata Test Suite (asserting database key, column comments, timestamp types, and named constraints).

---

### Requirement 12: API Decorators, JSON:API Envelope & Metadata Standardization
- **Audit Finding ID**: R7 (BP-010, BP-011, BP-012, BP-013, BP-014)
- **Severity**: BLUEPRINT CONFORMANCE / MEDIUM
- **Problem Statement**: HTTP controllers use generic Swagger decorators instead of Enterprise Blueprint standardized JSON:API decorators (`@ApiSuccessResponse`, `@ApiErrorResponse`), and endpoints lack explicit `@HttpCode`, `@ApiOperation`, and `@RequirePermission` metadata.
- **Expected Behavior**: All controller endpoints are decorated with standardized API documentation annotations, explicit HTTP status codes, operation summaries, and security requirement metadata matching Blueprint JSON:API standards.
- **Affected Bounded Contexts / Modules**: All HTTP controllers across `apps/opd-bc/`, `apps/emr-bc/`, `apps/finance-bc/`, `apps/iam-bc/`.
- **Backward Compatibility Constraints**: JSON:API envelope response formats remain backward-compatible with existing client integration tests.

#### Acceptance Criteria
1. Every non-health controller endpoint shall declare explicit `@HttpCode(...)`, `@ApiOperation(...)`, `@RequirePermission(...)`, and JSON:API response decorators.
2. When an API endpoint returns data, the Response Interceptor shall serialize output conforming to the standard JSON:API envelope structure (`data: { id, type, attributes }`).
3. The Controller Metadata Test shall inspect all registered controller routes and fail if any required decorator or status code mapping is missing.

#### Required Automated Tests
- Controller Decorator Conformance Test Suite (enumerating all controller methods and validating presence of required annotations).

---

### Requirement 13: Strict Naming Convention Alignment & Automated Metadata Gates
- **Audit Finding ID**: R13 (BP-001, BP-002, BP-003, BP-005)
- **Severity**: BLUEPRINT CONFORMANCE / LOW
- **Problem Statement**: Minor naming deviations exist in file names, controller classes, and service classes that differ from strict Blueprint naming conventions.
- **Expected Behavior**: All file names, class names, DTOs, interfaces, and constraint names align strictly with Blueprint conventions or have documented, approved architecture exceptions tested by automated naming test suites.
- **Affected Bounded Contexts / Modules**: All applications and libraries.
- **Backward Compatibility Constraints**: Internal renaming must not change public REST API routes or RabbitMQ exchange/queue bindings.

#### Acceptance Criteria
1. The Architecture Naming Test shall verify that all controller classes use plural naming (`PatientsController`, `VisitsController`, `InvoicesController`, `MedicalRecordsController`).
2. The Architecture Naming Test shall verify that all event consumer controllers use singular naming with `-events` suffix (`visit-events.controller.ts`, `invoice-events.controller.ts`).
3. The Architecture Naming Test shall verify that all database constraints strictly follow `pk_`, `fk_`, `uq_`, `idx_`, `chk_` prefix patterns.

#### Required Automated Tests
- Comprehensive naming convention test suite (`naming-conventions.spec.ts`).

---

### Priority 6: CI & Documentation Conformance

---

### Requirement 14: Automated OpenAPI Contract Conformance Verification
- **Audit Finding ID**: R14 (HIS-030, HIS-031, BP-015)
- **Severity**: CI & DOCUMENTATION / LOW
- **Problem Statement**: OpenAPI specifications are generated at runtime but lack automated E2E validation against OpenAPI 3.0 schema rules, missing endpoint assertions, and security scheme verification.
- **Expected Behavior**: An automated E2E test boots all four microservices, fetches `/docs-json`, validates the schema against OpenAPI 3.0 standards, and asserts that all required routes, parameters, request bodies, and responses are fully documented.
- **Affected Bounded Contexts / Modules**: `apps/opd-bc/`, `apps/emr-bc/`, `apps/finance-bc/`, `apps/iam-bc/`, test suites.
- **Backward Compatibility Constraints**: Swagger UI remains accessible at `/docs` on all service ports (3000, 3001, 3002, 3003).

#### Acceptance Criteria
1. When each service boots, the Swagger Module shall expose valid OpenAPI 3.0.0 documentation at `/docs` (HTML) and `/docs-json` (JSON).
2. The OpenAPI Validation Test Suite shall load `/docs-json` from all services and assert valid schema structure, bearer auth security schemes, and accurate endpoint schemas.
3. If an endpoint is missing required OpenAPI response or parameter documentation, the OpenAPI Validation Test Suite shall fail.

#### Required Automated Tests
- **Test Domain 9**: Automated OpenAPI availability, schema validation, security schemes, and response contract verification across all 4 services.

---

### Requirement 15: Automated Newman / Postman E2E Test Suite in CI
- **Audit Finding ID**: R12 (HIS-031)
- **Severity**: CI & DOCUMENTATION / LOW
- **Problem Statement**: Postman collection in `docs/postman/` includes insecure public administrative role bootstrapping and is not executed automatically as a regression gate in CI.
- **Expected Behavior**: Postman collection is refactored to use standard test authentication fixtures without public admin registration, and Newman runs the collection against live stack in CI, failing on any assertion failure.
- **Affected Bounded Contexts / Modules**: `docs/postman/`, `package.json`, CI workflow.
- **Backward Compatibility Constraints**: Collection covers all standard assignment API flows without modifying base endpoint paths.

#### Acceptance Criteria
1. The Postman Collection shall execute the complete end-to-end HIS workflow (Patient Registration → Visit Creation → Treatment Completion → Invoice Payment → Visit Closure) using valid authentication tokens.
2. When executed via Newman CLI (`npm run test:postman`), the Test Runner shall execute all collection requests against running services and assert HTTP response codes and payload structures.
3. If any assertion in the Postman collection fails, the CI Pipeline shall fail the build and generate a test execution report.

#### Required Automated Tests
- **Test Domain 13**: Automated Newman execution of exported Postman collection in CI with zero assertion failures.

---

### Requirement 16: Automated CI Security Scanning, SAST & Verification Gates
- **Audit Finding ID**: R9 (HIS-033, SEC-005, SEC-006, SEC-007)
- **Severity**: CI & DOCUMENTATION / MEDIUM
- **Problem Statement**: CI workflow does not enforce mandatory branch protection status checks, lacks automated Static Application Security Testing (SAST), secret scanning, schema isolation validation, and dependency auditing.
- **Expected Behavior**: CI workflow runs automated security gates (dependency audit, secret detection, ESLint security rules, schema isolation checks, migration from empty DB tests) and records auditable run results for all pull requests and main branch commits.
- **Affected Bounded Contexts / Modules**: `.github/workflows/ci.yml`, repository scripts.
- **Backward Compatibility Constraints**: CI build time remains bounded and reliable.

#### Acceptance Criteria
1. When a pull request or commit is pushed, the CI Pipeline shall run linting, type-checking, unit tests, E2E tests, schema isolation tests, dependency audit, and Newman E2E tests.
2. If any test, security audit, or secret scan check fails, the CI Pipeline shall mark the build as failed and block merging.
3. The CI Pipeline shall execute with explicit test environment variables, ensuring no application secret falls back to unconfigured defaults.

#### Required Automated Tests
- **Test Domain 15**: CI security scanning, dependency audit, SAST, and schema verification gates.

---

### Requirement 17: Documentation Synchronization & Drift Prevention
- **Audit Finding ID**: R11 (HIS-029, HIS-030, HIS-031)
- **Severity**: CI & DOCUMENTATION / LOW
- **Problem Statement**: Root README and documentation contain outdated claims ("100% compliant", "strictly aligned"), stale RBAC permission tables that have drifted from controller implementation, inaccurate schema ownership descriptions, and duplicate documentation in `his-project/README.md`.
- **Expected Behavior**: Documentation is updated to accurately describe the architecture, verified compliance state, RBAC permission matrix, migration procedures, and known operational characteristics. Automated tests prevent documentation drift against controller metadata.
- **Affected Bounded Contexts / Modules**: `README.md`, `docs/`, test suites.
- **Backward Compatibility Constraints**: All documentation conforms to Markdown standards and provides clear developer onboarding.

#### Acceptance Criteria
1. The Project Documentation shall accurately state system capabilities, verified compliance status, supported environment variables, and migration instructions.
2. The Documentation Drift Test Suite shall verify that the documented RBAC permissions matrix matches the actual controller route decorators.
3. If a controller route adds, removes, or modifies permissions without updating the documentation, the Documentation Drift Test Suite shall fail.

#### Required Automated Tests
- **Test Domain 14**: README RBAC/route metadata drift test.
