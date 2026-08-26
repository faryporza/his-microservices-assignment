# HIS Full Compliance Audit

**Audit date:** 2026-08-26 (Asia/Bangkok)  
**Branch:** `feat/iam-auth-integration`  
**Commit:** `e8c79828cff319436a6b188aa46f5bfd0819b6fe`  
**Scope:** Entire current branch and live local stack; not limited to a diff  
**Verdict:** **NOT READY**

## 1. Sources, grading, and scope

The requirements inventory was derived from:

- [Enterprise Backend Blueprint](https://iots1.github.io/enterprise-backend-blueprint/), including its naming, entity/DTO, API, code-review, testing, logging, and IAM guidance.
- [HIS Internship Assignment](https://gist.github.com/iots1/e5d1b5c19b39171a96b236af4a0a7f27), including the required services, schemas, APIs, event choreography, local infrastructure, validation, environment, README, Postman, and optional IAM scope.
- Repository steering under `.kiro/steering/`, used as project context but not accepted as implementation proof.

Status meanings:

- **VERIFIED** — concrete implementation, passing automated evidence, and relevant live-runtime evidence were all observed.
- **PARTIAL** — some implementation/evidence exists, but a requirement or proof layer is incomplete.
- **MISSING** — the required implementation was not found.
- **INCORRECT** — implementation exists but contradicts the requirement or creates a material defect.
- **N/A** — requirement is genuinely inapplicable. No requirement was classified N/A.

Static conventions were runtime-confirmed by a successful build and application boot where a more specific runtime check was not meaningful. Documentation and mocks were never treated as sufficient proof on their own.

## 2. Executive scorecard

| Domain | Verified | Partial | Missing | Incorrect | Total |
|---|---:|---:|---:|---:|---:|
| HIS assignment, runtime, delivery | 26 | 6 | 1 | 2 | 35 |
| Enterprise Backend Blueprint | 13 | 10 | 3 | 0 | 26 |
| IAM/RBAC/security | 9 | 1 | 3 | 2 | 15 |
| **Total** | **48** | **17** | **7** | **4** | **76** |

Only **63.2%** of the inventory is VERIFIED. The passing functional path is substantial, but the following release blockers make the repository **NOT READY**:

1. Anonymous registration accepts any privileged role, including `ADMIN` and `DOCTOR`.
2. `PATIENT` authorization is role-only; a patient can request another patient's records, visits, or invoice by supplying an arbitrary identifier.
3. Runtime schema ownership is broken: every one of the four logical databases currently contains every bounded context's tables.
4. Production dependencies contain two high-severity `js-yaml` advisory findings.
5. Secrets fail open to committed development values, and CI omits `JWT_REFRESH_SECRET` while the application silently supplies a fallback.

## 3. Fresh evidence record

All commands below were executed against the audited working tree during this audit.

| Check | Result |
|---|---|
| Branch and commit | `feat/iam-auth-integration` at `e8c79828cff319436a6b188aa46f5bfd0819b6fe` |
| Pre-existing worktree state | `.gitignore` was already modified; it was not touched by this audit |
| `npm run lint:check` | PASS, exit 0 |
| `npm run build` | PASS, all four Nest applications built |
| `npm test -- --runInBand` | PASS, 47 suites / 235 tests |
| `npm run test:e2e -- --runInBand` | PASS, 4 suites / 22 tests |
| `npm run test:cov -- --runInBand` | PASS; 91.67% statements, 78.18% branches, 88.94% functions, 91.33% lines; configured thresholds passed |
| `npm run test:flow` | PASS; visit `5ab133aa-8115-479a-8126-a7acc05da383` closed through all three events; record `aa7234a0-16c5-470b-ad5a-18a4d070da6a`; invoice `2482b8f4-4bb2-4221-90e1-a9aeebe9c681` |
| Service health | Ports 3000, 3001, 3002, and 3003 booted and responded |
| OpenAPI runtime | `/docs` and `/docs-json` returned HTTP 200 on all four services; OpenAPI 3.0.0; 6/5/4/7 paths respectively |
| Trace runtime | Supplied `audit-correlation` and `audit-trace` were preserved; a span ID was generated |
| RabbitMQ runtime | `his.events` is a durable topic exchange; `opd.events`, `emr.events`, and `finance.events` are durable, non-auto-delete queues with the expected bindings; all test messages acknowledged |
| IAM real-Redis runtime | Registration/login/`me`/refresh rotation/logout passed; revoked access returned 401; session removed; token blacklisted |
| Refresh-token reuse runtime | Replaying the rotated token returned 401 and revoked the user's sessions |
| Database runtime | All four databases contained `invoices`, `medical_records`, `outbox_events`, `patients`, `processed_events`, `users`, and `visits` — a schema isolation failure |
| `npm audit --omit=dev --audit-level=low` | FAIL; two high-severity findings: `@nestjs/swagger@11.4.6` resolves `js-yaml@5.2.1`, affected by GHSA-pm4m-ph32-ghv5 |
| Source boundary search | No production imports across OPD/EMR/Finance/IAM applications and no cross-database SQL were found; OPD-internal Patient/Visit imports were expected |

The services started for live verification were stopped after the checks. Existing infrastructure containers were left running and unchanged.

## 4. Complete requirement traceability matrix

Evidence abbreviations: **C** code/config, **T** passing automated test/build, **R** live runtime, **D** documentation only. Remediation identifiers refer to section 17.

### 4.1 HIS assignment and delivery requirements

| ID | Requirement | Status | Trace and evidence | Gap/remediation |
|---|---|---|---|---|
| HIS-001 | OPD bounded context on port 3000 | VERIFIED | C `apps/opd-bc/src/main.ts`; T build/E2E; R health/flow on 3000 | — |
| HIS-002 | EMR bounded context on port 3001 | VERIFIED | C `apps/emr-bc/src/main.ts`; T build/E2E; R health/flow on 3001 | — |
| HIS-003 | Finance bounded context on port 3002 | VERIFIED | C `apps/finance-bc/src/main.ts`; T build/E2E; R health/flow on 3002 | — |
| HIS-004 | Optional IAM bounded context on port 3003 | VERIFIED | C `apps/iam-bc/src/main.ts`; T IAM E2E; R real Redis auth on 3003 | — |
| HIS-005 | Independent logical databases for each bounded context | VERIFIED | C `docker/postgres/init.sql`, root modules select their database keys; T apps boot; R four databases exist | Schema ownership itself fails HIS-032 |
| HIS-006 | No cross-database joins/queries; communicate by UUID/event | PARTIAL | C search found no production cross-app query/import; scalar foreign identifiers are used | Runtime schemas are contaminated; R2 |
| HIS-007 | RabbitMQ topic/direct exchange for domain events | VERIFIED | C `libs/common/src/rmq/rabbitmq-options.service.ts`; T options tests; R durable topic `his.events` | — |
| HIS-008 | Durable service queues and correct bindings | VERIFIED | C `libs/contracts/src/rabbitmq.constants.ts`; T tests; R exact durable bindings | — |
| HIS-009 | OPD publishes `visit.created` exact core payload | VERIFIED | C contract and Visit service; T contract/service tests; R live flow delivery | — |
| HIS-010 | EMR consumes `visit.created` and creates WAITING record | VERIFIED | C `medical-record-events.controller.ts`; T consumer tests; R live flow | — |
| HIS-011 | EMR publishes `treatment.completed` with visit, record, cost | VERIFIED | C contract/Medical Record service; T tests; R live flow | — |
| HIS-012 | Finance consumes treatment and creates exact-cost PENDING invoice | VERIFIED | C `invoice-events.controller.ts`; T tests; R live flow exact invoice | — |
| HIS-013 | Finance publishes `invoice.paid` with PAID status | VERIFIED | C contract/Invoice service; T tests; R live flow | — |
| HIS-014 | OPD consumes `invoice.paid` and closes visit | VERIFIED | C `visit-events.controller.ts`; T tests; R final `CLOSED` status | — |
| HIS-015 | State and outgoing event use a transactional outbox | VERIFIED | C `outbox-events.service.ts`; T transaction/failure tests; R deferred-consumer flow retained and delivered events | — |
| HIS-016 | Background outbox relay publishes pending messages | VERIFIED | C startup + five-second relay; T publisher tests; R deferred flow delivery | — |
| HIS-017 | Consumers process duplicate events idempotently | PARTIAL | C `processed_events` unique ID and same transaction; T sequential duplicate tests; R ordinary delivery | Check-then-insert has a concurrent race; R3 |
| HIS-018 | Patient schema: UUID, unique HN, name, ID card | VERIFIED | C Patient entity with named uniqueness; T naming/service/E2E; R patient persisted | — |
| HIS-019 | Visit schema: patient FK, date, OPEN/CLOSED status | VERIFIED | C Visit entity and named FK; T tests; R OPEN→CLOSED | — |
| HIS-020 | Medical Record schema: visit scalar, diagnosis, note, doctor | VERIFIED | C MedicalRecord entity; T tests; R record completed | — |
| HIS-021 | Invoice schema: visit scalar, amount, PENDING/PAID | VERIFIED | C Invoice entity; T tests; R PENDING→PAID | — |
| HIS-022 | Required assignment HTTP endpoints | VERIFIED | C controllers; T E2E routes; R full API flow | — |
| HIS-023 | Docker Compose starts PostgreSQL and RabbitMQ | VERIFIED | C `docker-compose.yml`; R PostgreSQL/RabbitMQ/Redis running | Broader packaging is HIS-034 |
| HIS-024 | Request validation | VERIFIED | C DTO decorators + strict global pipe; T invalid request tests; R 400 envelope | — |
| HIS-025 | Error handling | VERIFIED | C exception filter/specific exceptions; T filter/E2E tests; R 401/400/409 paths | Blueprint-specific gaps tracked separately |
| HIS-026 | Environment configuration; no hard-coded connection strings/secrets | PARTIAL | C connection endpoints are environment-driven | JWT secrets, CI credentials, and flow credentials have fallbacks; R1/R8 |
| HIS-027 | README has accurate setup, run, architecture, API guidance | INCORRECT | D root README is extensive; test counts matched fresh run | Role matrix, schema-isolation, production-ready, strict/100% Blueprint claims are false; R11 |
| HIS-028 | Exported Postman collection covers required APIs | PARTIAL | C valid Collection 2.1 JSON, 50 requests, 50 test scripts, 17 variables | Not executed by project or CI; privileged public registration is embedded; R12 |
| HIS-029 | One PostgreSQL instance with logical BC databases | VERIFIED | C compose/init; R one server with four logical databases | — |
| HIS-030 | Durable messages survive delayed consumers | VERIFIED | C persistent delivery/durable queues/outbox; T publisher tests; R CI-style consumers-down flow passed | Broker-restart/poison handling remains R4 |
| HIS-031 | Required CRUD/business fundamentals are implemented | VERIFIED | C services/controllers; T unit/E2E; R create/read/update/payment flow | — |
| HIS-032 | Each database contains only its bounded context's schema | INCORRECT | R every database contains every domain table; C `autoLoadEntities: true` + `synchronize: true`; IAM E2E loads all four apps in one process | R2 |
| HIS-033 | CI gates lint, tests, coverage, build, E2E, live flow | PARTIAL | C `.github/workflows/ci.yml` contains all gates | Workflow run status was not independently observed; no dependency/Postman/security gate; missing refresh secret; R9/R12 |
| HIS-034 | Production Docker/environment hygiene | PARTIAL | C versioned infra images and volumes | No app Dockerfiles/services, local health checks, networks, secret injection, or non-default credentials; R8 |
| HIS-035 | Postman collection is run as an automated conformance gate | MISSING | No Newman dependency, script, or CI step | R12 |

### 4.2 Enterprise Backend Blueprint requirements

| ID | Requirement | Status | Trace and evidence | Gap/remediation |
|---|---|---|---|---|
| BP-001 | Modules use singular domain names | VERIFIED | C module names; T naming tests/build; R app boot | — |
| BP-002 | Controllers use plural/action-appropriate names | PARTIAL | Most resource controllers comply | `AuthController` and health naming differ from strict plural convention; R13 |
| BP-003 | Services use plural domain/action names | PARTIAL | Resource services comply; action services are coherent | Several singular services differ from strict baseline; R13 |
| BP-004 | Event controllers end in `EventsController` | VERIFIED | C three event controllers; T controller tests; R event flow | — |
| BP-005 | Entities are singular PascalCase with snake_case properties | VERIFIED | C entities; T naming tests; R schema creation | — |
| BP-006 | Boolean names use `is_`/`has_`/`can_` prefixes | VERIFIED | C `is_active`; T naming tests; R user persisted | — |
| BP-007 | Tables/constraints/indexes use explicit standard names | PARTIAL | Primary/unique/FK constraints are mostly named and tested | Schema contamination, limited indexing, and `synchronize` weaken deterministic ownership; R2/R6 |
| BP-008 | Success responses use the standard envelope | VERIFIED | C transform interceptor; T tests/E2E; R live APIs | — |
| BP-009 | Error responses use the standard error envelope | VERIFIED | C exception filter; T tests/E2E; R validation/auth errors | — |
| BP-010 | DTO validation decorators are present | VERIFIED | C DTOs; T DTO tests/E2E; R invalid requests | — |
| BP-011 | Global validation is strict/whitelisted | VERIFIED | C `StrictValidationPipe`; T tests; R unknown/invalid field rejection | — |
| BP-012 | Central exception handling avoids leaking 500 internals | VERIFIED | C all-exceptions filter; T tests; R error routes | — |
| BP-013 | Correlation/trace/span identifiers propagate | VERIFIED | C HTTP logging/trace contracts; T tests; R supplied headers preserved and span generated | — |
| BP-014 | Structured JSON logging carries required metadata | VERIFIED | C structured logger; T logging tests; R JSON service/event logs | Sensitive-field gap is BP-024 |
| BP-015 | Swagger UI and JSON exist for each service | PARTIAL | C Swagger bootstrap; R all eight URLs returned 200/OpenAPI 3 | No automated OpenAPI smoke/schema assertion; R14 |
| BP-016 | Clean architecture and aliases prevent cross-BC coupling | PARTIAL | C shared common/contracts libraries and aliases; no production cross-BC imports | Full domain/application/infrastructure separation is not implemented; R15 |
| BP-017 | Every entity explicitly sets the `database` option | MISSING | Entity decorators set table names but no `database:` property | R6 |
| BP-018 | Columns are documented; timestamps/nullability follow entity standard | PARTIAL | UUIDs and nullable columns are generally coherent | Column comments and `ITimestamp` are absent; several timestamp columns do not explicitly use `timestamptz`; R6 |
| BP-019 | Entities contain no Swagger; DTOs contain Swagger + validation | VERIFIED | C entity/DTO separation; T DTO tests/build; R Swagger generated | — |
| BP-020 | Responses use project JSON:API Swagger decorators, not generic `@ApiResponse` | MISSING | Generic Nest Swagger decorators are used | R7 |
| BP-021 | Every endpoint declares permission, status, and operation metadata | MISSING | `@ApiOperation` and role metadata are common | No `@RequirePermission`; not every endpoint has explicit `@HttpCode`; R5/R7 |
| BP-022 | REST paths are versioned/prefixed nouns; docs use prescribed paths | PARTIAL | Resources are mostly plural nouns; assignment-mandated `/pay` is accepted | No global API version/prefix; `/records/:id/complete` is verb-like; docs paths differ from current Blueprint convention; R7 |
| BP-023 | Avoid generic `throw new Error` for application/config errors | PARTIAL | Domain paths mostly use Nest exceptions | Generic errors remain in environment and Redis code; R10 |
| BP-024 | Logs and responses exclude secrets and PII | PARTIAL | Password hashes and JWT strings are not returned/logged | Auth logs include usernames and refresh-reuse logs include token JTIs; R10 |
| BP-025 | Unit/E2E isolation and coverage thresholds | VERIFIED | T 47/235 unit suites, 4/22 E2E, coverage thresholds passed | Real-resource gaps tracked under IAM-008 and missing tests |
| BP-026 | Current reference stack is used or divergence is justified | PARTIAL | NestJS 11 and CI Node 22 align | Local Node was 20.15 and PostgreSQL is 16 while the current Blueprint names Node 22 LTS/PostgreSQL 17+; rationale is not documented; R11 |

### 4.3 IAM, RBAC, and security requirements

| ID | Requirement | Status | Trace and evidence | Gap/remediation |
|---|---|---|---|---|
| IAM-001 | Registration uses bcrypt and assigns a role | VERIFIED | C PasswordHash/Auth/User services; T tests; R real registration | Role assignment is dangerously exposed; IAM-011 |
| IAM-002 | Login issues 15-minute access and 7-day refresh tokens | VERIFIED | C token issuance; T tests; R token pair and claims | Environment TTL settings are currently ignored; R8 |
| IAM-003 | Session is stored in Redis with user, role, refresh JTI, TTL | VERIFIED | C Redis/Auth services; T tests; R real Redis session observed | — |
| IAM-004 | Refresh rotates the JTI and invalidates the old token | VERIFIED | C Auth service; T tests; R real rotation | — |
| IAM-005 | Refresh reuse revokes all user sessions | VERIFIED | C reuse path; T tests; R replay returned 401 and sessions became zero | — |
| IAM-006 | Logout deletes session and blacklists access token | VERIFIED | C logout/blacklist; T tests; R session zero, blacklist one, subsequent 401 | — |
| IAM-007 | JWT guard verifies signature, blacklist, and live session | VERIFIED | C guard; T unit/E2E; R `/auth/me` before/after logout | — |
| IAM-008 | Redis failure is fail-closed | PARTIAL | C guard catches Redis failure and rejects; T mock unit test | No automated/live real-Redis outage or degraded-state integration test; R16 |
| IAM-009 | Role guard denies disallowed roles | VERIFIED | C role guard; T 401/403 E2E; R protected API flow | Coarse role checks are insufficient for ownership; IAM-012 |
| IAM-010 | `@Public()` is explicit and narrowly used | VERIFIED | C decorator/global guard; T public/protected tests; R login/health vs protected routes | Registration semantics fail IAM-011 |
| IAM-011 | Public registration cannot grant privileged roles; least privilege | INCORRECT | C public DTO accepts all `UserRole`; service persists it; T E2E explicitly proves anonymous DOCTOR creation | R1 |
| IAM-012 | Fine-grained permission/policy and patient ownership checks | MISSING | Resource endpoints use only `@Roles`; PATIENT can supply arbitrary IDs | R5 |
| IAM-013 | PHI/billing access has a durable, attributable audit trail | MISSING | HTTP logs exist but no append-only clinical access audit implementation | R5 |
| IAM-014 | Authentication and sensitive endpoints are rate limited | MISSING | No guard/interceptor/policy applies rate limits | R5 |
| IAM-015 | Production secrets are mandatory and fail closed | INCORRECT | JWT access/refresh secrets silently fall back; CI omits refresh secret; flow forges token with known key | R8 |

## 5. Architecture compliance

The repository has a credible four-bounded-context Nest monorepo with a deliberately small shared kernel (`libs/common`) and event contracts (`libs/contracts`). Production source search found no OPD/EMR/Finance/IAM cross-imports or cross-database queries. Cross-context references are scalar UUIDs and the end-to-end business flow is genuinely event-driven.

However, architecture compliance is not complete:

- The live schema contradicts the bounded-context ownership model: all domain tables exist in all four databases.
- `autoLoadEntities: true` plus `synchronize: true` allows test-process metadata leakage to mutate every schema. The IAM E2E suite imports all four application modules into one Jest process.
- The Blueprint's explicit entity `database:` metadata and fuller domain/application/infrastructure separation are absent.
- Runtime schema synchronization is being used instead of complete, reproducible per-service migrations.

**Architecture verdict: PARTIAL, release-blocking because of schema ownership failure.**

## 6. API compliance

The exact assignment endpoints are implemented, routed, validated, documented, and exercised. Response and error envelopes, resource typing, UUID parsing, and correlation headers work. Manual Swagger runtime checks passed for every service.

Blueprint-specific gaps remain: generic Swagger responses replace the prescribed JSON:API response decorators; there is no permission decorator; not every route explicitly sets an HTTP code; APIs are not globally prefixed/versioned; and the EMR completion path is action-shaped. The assignment explicitly requires `/invoices/:id/pay`, so that path is not penalized as a Blueprint defect.

**API verdict: READY WITH ISSUES in isolation.**

## 7. Database and schema compliance

Entity fields satisfy the assignment's core schema, OPD's Patient→Visit relationship is local, and cross-service references remain scalar UUIDs. Constraint naming is substantially implemented.

The live schema result is decisive:

```text
opd_db:     invoices medical_records migrations outbox_events patients processed_events users visits
emr_db:     invoices medical_records migrations outbox_events patients processed_events users visits
finance_db: invoices medical_records migrations outbox_events patients processed_events users visits
iam_db:     invoices medical_records migrations outbox_events patients processed_events users visits
```

Each database should own only its bounded-context domain tables plus its infrastructure tables. This contamination, combined with `synchronize: true`, means schema isolation and deterministic deployment are not compliant. Entities also lack explicit `database:` declarations and column comments required by the Blueprint.

**Database/schema verdict: NOT READY.**

## 8. RabbitMQ and event compliance

The topology and choreography are correct and runtime-proven:

- durable topic exchange `his.events`;
- durable, non-auto-delete queues `emr.events`, `finance.events`, `opd.events`;
- bindings `visit.created` → EMR, `treatment.completed` → Finance, `invoice.paid` → OPD;
- persistent event publication and manual acknowledgements;
- shared typed contracts containing the exact assignment payload fields plus trace metadata;
- deferred-consumer live flow passed.

Gaps: no declared dead-letter exchanges/queues, bounded retry/backoff, poison-message quarantine, or broker-restart recovery test. Permanent validation failures are negatively acknowledged without a configured place to inspect them.

**RabbitMQ/event verdict: READY WITH ISSUES.**

## 9. Reliability compliance

Strong features include local transactional outbox writes, a background relay, consumer transaction boundaries, durable/persistent RabbitMQ settings, processed-event records, refresh-token theft detection, and a CI live flow that stops consumers before producing events.

Material gaps:

- concurrent delivery can race between `exists` and insertion of the unique processed-event row;
- no DLQ, bounded retries, exponential backoff, poison-message policy, or operator replay flow;
- no crash-point test for publish-success/mark-failure duplicate delivery;
- no broker-restart durability test;
- `synchronize: true` risks destructive/uncontrolled schema drift;
- the live flow creates a known administrative Redis session and does not revoke it.

**Reliability verdict: PARTIAL.**

## 10. IAM and RBAC compliance

Stateful JWT behavior is unusually well implemented and was proven against real Redis: access/refresh issuance, session validation, JTI rotation, replay revocation, logout, and immediate blacklist enforcement all worked.

The authorization model is nevertheless unsafe:

- `/auth/register` is public and accepts every enum role. The E2E test intentionally registers `DOCTOR`, demonstrating privilege escalation by design.
- Role-only checks do not enforce resource ownership. PATIENT routes accept arbitrary patient, visit, record, or invoice identifiers.
- There is no permission/policy engine, explicit deny layer, department/context constraint, or durable PHI-access audit.
- There is no rate limiting on login, registration, refresh, or protected resources.

**IAM/RBAC verdict: NOT READY.**

## 11. Validation and error compliance

Strict validation, whitelist/forbid behavior, UUID parsing, specific 400001/400002 validation codes, structured error envelopes, and hidden 500 internals are implemented and tested. Remaining Blueprint deviations are generic `Error` throws and generic Swagger error decorators rather than the prescribed project response decorators.

**Validation/error verdict: VERIFIED for assignment scope; PARTIAL for full Blueprint scope.**

## 12. Logging and tracing compliance

Structured JSON logs include service/version/environment, timestamps, severity, trace/correlation/span IDs, HTTP details, and event context. Runtime header propagation passed.

Privacy and auditability gaps remain: authentication logs include usernames; refresh-reuse logs include attempted and expected JTIs; there is no durable append-only access audit for patient/clinical/billing reads; and no automated redaction regression test enumerates the Blueprint's sensitive-field list.

**Logging/tracing verdict: PARTIAL.**

## 13. Docker and environment compliance

The assignment's local infrastructure requirement is met: Compose provisions PostgreSQL, RabbitMQ, and Redis with persistent volumes and the database initialization script. Application configuration mostly comes from environment variables.

It is not production-grade packaging: Compose has no application services, Dockerfiles, local health checks, explicit networks, secrets mechanism, TLS, or non-default credentials. JWT code and the live-flow runner contain known default keys. JWT expiration variables are documented/configured but token issuance uses hard-coded seconds. CI does not set `JWT_REFRESH_SECRET`.

**Docker/environment verdict: PARTIAL.**

## 14. CI compliance

The workflow statically defines checkout, Node 22, deterministic `npm ci`, service health checks, four database creation, lint, coverage, build, E2E, and a delayed-consumer live-flow gate. This is strong coverage.

The audit did not observe a GitHub-hosted run for this commit, so runtime CI status is not VERIFIED. The workflow also omits dependency audit/SCA, SAST, secret scanning, Newman/Postman execution, schema ownership assertions, and `JWT_REFRESH_SECRET`.

**CI verdict: PARTIAL.**

## 15. README and Postman compliance

The root README is extensive and its reported unit/E2E counts matched the fresh run. It is not accurate enough to be compliant:

- It calls the repository “Production-ready,” “strictly aligned,” and “100%” Blueprint compliant despite this audit's contrary findings.
- It claims isolated database schemas while live PostgreSQL shows every schema in every database.
- Its RBAC table grants DOCTOR patient/visit mutation and patient deletion, while controllers allow ADMIN/NURSE for create/update, ADMIN only for delete, and ADMIN/NURSE for visit creation.
- The secondary `his-project/README.md` is stale and omits IAM and the full secured workflow.

The Postman collection is valid and comprehensive at a structural level: 50 requests, 50 scripts, and negative 400/401/403/409 coverage. It is not run in CI, and its bootstrap uses the insecure public endpoint to self-register privileged accounts.

**README verdict: INCORRECT. Postman verdict: PARTIAL.**

## 16. Security findings

| ID | Severity | Finding | Concrete evidence | Required disposition |
|---|---|---|---|---|
| SEC-001 | **CRITICAL** | Anonymous privilege escalation | Public register DTO accepts all roles; service persists supplied role; E2E creates DOCTOR | Remove role from public DTO and add protected provisioning; R1 |
| SEC-002 | **CRITICAL** | Broken object-level authorization exposes PHI/billing | PATIENT role can call ID-based patient/visit/record/invoice routes without ownership check | Add identity-to-patient mapping and policy/ownership checks; R5 |
| SEC-003 | **HIGH** | High-severity production dependency advisory | `npm audit --omit=dev`: two `js-yaml` GHSA-pm4m-ph32-ghv5 findings via Swagger | Upgrade/resolution and re-run all gates; R17 |
| SEC-004 | **HIGH** | Secrets fail open to known repository values | Auth service and flow runner have development key fallbacks; CI omits refresh key | Require secrets at boot and rotate; R8 |
| SEC-005 | **HIGH** | Live-flow test forges and leaves a known ADMIN session | `live-flow.e2e.mjs` writes fixed Redis admin session with one-day TTL and never revokes it | Authenticate normally or create/revoke an isolated fixture; R8 |
| SEC-006 | **HIGH** | Bounded-context schemas are contaminated | Every database contains all application tables | Explicit entities/migrations and isolation tests; R2 |
| SEC-007 | **MEDIUM** | Role-only RBAC lacks fine-grained policy/explicit deny | No permission/policy guard or ownership context | R5 |
| SEC-008 | **MEDIUM** | No auth/API rate limiting | No applied rate-limit guard/interceptor | R5 |
| SEC-009 | **MEDIUM** | Potential sensitive identifiers in logs | Usernames and token JTIs logged | Redaction policy/tests; R10 |
| SEC-010 | **MEDIUM** | Poison messages lack quarantine/replay | No DLX/DLQ or bounded retry policy | R4 |
| SEC-011 | **MEDIUM** | Runtime schema synchronization | `synchronize: true` in all service DB options | Full per-BC migrations; R2 |
| SEC-012 | **LOW** | Default local infrastructure credentials and broad port exposure | postgres/postgres, guest/guest, Redis without password | R8 |

## 17. Required remediation specifications

These changes are specifications only; no application code was modified by this audit.

### R1 — Close public role escalation

- Remove `role` from `RegisterUserDTO` and always create public users as `PATIENT`.
- Add a separate authenticated administrator endpoint/service operation for privileged role assignment, guarded by both admin role and an explicit permission.
- Required E2E assertions:

```ts
await request(iam).post('/auth/register').send({ ...validUser, role: 'ADMIN' }).expect(400);
const patient = await request(iam).post('/auth/register').send(validUser).expect(201);
expect(patient.body.data.attributes.role).toBe('PATIENT');
await request(iam).patch(`/users/${patientId}/role`).set(adminAuth).send({ role: 'DOCTOR' }).expect(200);
await request(iam).patch(`/users/${patientId}/role`).set(patientAuth).send({ role: 'DOCTOR' }).expect(403);
```

### R2 — Restore deterministic per-BC schema ownership

- Set `synchronize: false` outside disposable unit fixtures.
- Replace global `autoLoadEntities` behavior with an explicit entity list per connection, including only the bounded context plus `OutboxEvent`/`ProcessedEvent` as needed.
- Add complete schema migrations per bounded context; do not rely on constraint-renaming-only migrations.
- Run each service's E2E app in an isolated process/database or otherwise clear TypeORM metadata between application fixtures.
- Required integration assertion:

```sql
-- Example OPD allowlist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name NOT IN ('patients','visits','outbox_events','processed_events','migrations');
-- Must return zero rows; use equivalent allowlists for EMR, Finance, and IAM.
```

### R3 — Make idempotency concurrency-safe

- Claim the event first with `INSERT ... ON CONFLICT DO NOTHING` inside the consumer transaction, or catch the named unique conflict and treat it as an acknowledged duplicate before business mutation.
- Add a test that invokes the same event concurrently (for example, 20 promises) and asserts exactly one domain mutation and one processed-event row.

### R4 — Add poison-message and recovery policy

- Declare a DLX and per-service DLQ, bounded delivery attempts, exponential backoff, and an operator replay command/runbook.
- Add broker-restart, permanent-invalid-event, transient-failure, and publish-success/mark-failure tests.
- Assert invalid messages land in the DLQ with event ID and trace metadata, rather than disappearing.

### R5 — Implement permission, ownership, access audit, and rate limiting

- Introduce `@RequirePermission(...)` plus a policy guard using subject, role, resource, action, patient ownership, and clinical context.
- Link a PATIENT IAM identity to a scalar `patient_id`; deny requests whose route resource does not resolve to that patient.
- Emit a durable audit record for each PHI/billing read and mutation.
- Apply Redis-backed rate limits to register/login/refresh and sensitive APIs.
- Required E2E assertion pattern:

```ts
await request(opd).get(`/patients/${otherPatientId}`).set(patientAAuth).expect(403);
await request(emr).get(`/records/visit/${otherVisitId}`).set(patientAAuth).expect(403);
await request(finance).get(`/invoices/${otherVisitId}`).set(patientAAuth).expect(403);
await request(opd).get(`/patients/${patientAId}`).set(patientAAuth).expect(200);
expect(await accessAuditRepo.findBy({ actor_id: patientAUserId })).not.toHaveLength(0);
```

### R6 — Complete entity/schema standards

- Add explicit `database:` metadata to every `@Entity`, per the Blueprint.
- Add a non-sensitive `comment:` to every column.
- Implement the project timestamp interface, explicitly use `timestamptz`, and keep nullable TypeScript/DB/OpenAPI declarations consistent.
- Add deterministic indexes and checks where lookup/status invariants require them.
- Add metadata tests that enumerate all entities/columns and fail on missing database, comment, type, constraint, or index conventions.

### R7 — Complete API/Swagger standards

- Add API prefix/versioning according to the chosen Blueprint convention and document any assignment route exceptions.
- Replace generic response decorators with project JSON:API success/error decorators.
- Require `@RequirePermission`, explicit `@HttpCode`, `@ApiOperation`, and resource type metadata on every non-health endpoint.
- Add a metadata test that walks every controller route and fails on missing decorators.

### R8 — Fail closed on secrets and clean up integration identity

- Use `getOrThrow` for both JWT secrets and validate minimum entropy at boot; never use repository fallbacks outside an explicitly isolated test module.
- Honor and validate `JWT_ACCESS_EXPIRES_IN`/`JWT_REFRESH_EXPIRES_IN` instead of hard-coded seconds.
- Set separate random access/refresh secrets in CI secret/environment configuration.
- Make the live flow obtain a real short-lived admin credential from a protected test bootstrap and revoke it in `finally`; never leave a fixed Redis session.
- Add negative boot tests proving each service refuses missing/weak secrets.

### R9 — Make CI independently auditable

- Require the workflow for protected branches and expose/record the commit's run URL.
- Add dependency audit/SCA, SAST, secret scanning, schema-ownership verification, and migration-from-empty checks.
- Do not allow an application fallback to hide a missing CI environment variable.

### R10 — Tighten exceptions and log redaction

- Replace generic application/config errors with typed configuration or service-unavailable exceptions.
- Remove/hash usernames and token JTIs from routine logs; retain only approved non-sensitive identifiers.
- Add parameterized redaction tests for password, access/refresh token, Authorization, cookie/session, API key, ID card, email, username, and JTI fields.

### R11 — Correct documentation

- Remove “production-ready,” “strictly aligned,” and “100%” claims until all blockers are verified.
- Generate the RBAC table from controller/policy metadata or correct every row manually.
- Document schema ownership accurately, the second JWT secret, migration procedure, supported stack versions, event/DLQ policy, real bootstrap path, and known limitations.
- Consolidate or clearly scope the stale `his-project/README.md`.

### R12 — Make Postman a tested artifact

- Remove public privileged-role bootstrap; use an approved test fixture.
- Add pinned Newman dependencies/scripts and run the collection against the CI live stack.
- Fail on any collection assertion and publish the Newman report as a CI artifact.

### R13 — Resolve naming deviations

- Either rename strict deviations to the chosen Blueprint convention or record explicit architecture exceptions for action/health components.
- Expand naming tests to enumerate all modules, controllers, services, events controllers, entities, files, properties, tables, constraints, and indexes.

### R14 — Automate OpenAPI verification

- Boot all four real apps in E2E, assert `/docs` and `/docs-json` return 200, validate the OpenAPI document, and assert every required path, security scheme, envelope schema, response, and error type.

### R15 — Complete clean-architecture boundaries

- Separate domain policy, application use cases, HTTP/Rabbit adapters, and persistence infrastructure where business logic currently couples to Nest/TypeORM.
- Add dependency-boundary lint rules forbidding inward-layer violations and all cross-bounded-context imports except `libs/contracts`.

### R16 — Prove real Redis fail-closed behavior

- Add an isolated integration test using a disposable Redis instance: obtain a valid token/session, stop or block Redis, call a protected endpoint, assert 401/503 according to policy, and assert the request never reaches the handler.

### R17 — Remediate the dependency advisory

- Update `@nestjs/swagger`/lockfile (or apply a safe supported resolution) so production `js-yaml` is outside the GHSA-pm4m-ph32-ghv5 affected range.
- Re-run `npm audit --omit=dev`, install, lint, build, unit, E2E, OpenAPI, and live-flow gates; require zero high/critical production findings.

## 18. Missing automated tests

The following tests are required before a READY verdict:

1. Anonymous privileged-role registration rejection and protected role provisioning.
2. Cross-patient BOLA/ownership denial for every patient-visible OPD, EMR, and Finance route.
3. Per-database table/constraint allowlist after migrations and after the full E2E suite.
4. Migration from empty database with `synchronize: false` for each bounded context.
5. Real Redis lifecycle and real Redis fail-closed integration in the automated suite.
6. Concurrent duplicate-event delivery and unique-conflict handling.
7. DLQ, bounded retry/backoff, poison event, broker restart, and operator replay.
8. Outbox crash after publish but before `published_at` update.
9. Automated OpenAPI availability/schema/security/response-contract verification.
10. Trace propagation from HTTP through every RabbitMQ hop and downstream logs.
11. Logging redaction and durable PHI access-audit verification.
12. Rate-limit enforcement and reset behavior.
13. Newman execution of the exported Postman collection in CI.
14. README RBAC/route metadata drift test or generated documentation.
15. Production dependency audit and secret/SAST gates.

## 19. Missing or incorrect implementation

- Safe privileged-user provisioning.
- Resource ownership/permission policy and explicit deny behavior.
- Durable PHI/billing access audit.
- Rate limiting.
- Isolated, migration-owned schemas with runtime synchronization disabled.
- Explicit entity database metadata, column comments, and complete timestamp conventions.
- DLQ/retry/backoff/replay operations.
- Blueprint JSON:API Swagger decorators and endpoint metadata gate.
- Mandatory, strong access/refresh JWT secrets and correct TTL configuration use.
- Safe live-flow authentication/session cleanup.
- Automated Postman/OpenAPI/security conformance gates.
- Accurate README claims and permission matrix.
- Patched production dependency graph.

## 20. Final verification gate

```text
CLAIM: The current repository is compliant and release-ready.
CLAIM_TYPE: FEATURE_GO
STATUS: NOT_VERIFIED

PASSING EVIDENCE:
- lint, build, unit, E2E, coverage, live event flow
- runtime ports, Swagger, trace headers, RabbitMQ topology
- real-Redis login, refresh rotation, replay detection, logout/revocation

BLOCKING EVIDENCE:
- public privileged-role assignment
- missing patient resource ownership/permission policy
- cross-bounded-context table contamination in every live database
- two high-severity production dependency findings
- fail-open/default secret configuration and unsafe live-flow admin fixture

REQUIRED NEXT EVIDENCE:
- R1 through R17 completed as applicable
- all missing tests in section 18 passing
- fresh full audit with no CRITICAL/HIGH security finding and no INCORRECT requirement
```

**Final verdict: NOT READY.**
