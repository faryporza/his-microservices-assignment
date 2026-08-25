# Brief: iam-auth

## Problem
Hospital Information System (HIS) endpoints for OPD, EMR, and Finance are currently unprotected by authentication or role-based access control. Healthcare standards strictly mandate authenticated identity, session management with instant revocation capabilities, and fine-grained authorization (e.g. only doctors can complete medical records, only finance staff can process payments, patients can only see their own records).

## Current State
- Weeks 1–3 are fully implemented: Monorepo with `opd-bc`, `emr-bc`, `finance-bc`, RabbitMQ event choreography, transactional outbox, idempotency, structured JSON logging, and validation.
- All endpoints are currently public.
- No Redis instance or JWT strategy is configured.

## Desired Outcome
- Redis service configured for stateful JWT management and session revocation.
- Dedicated authentication and user management (`iam-bc` service or centralized module) with user registration, login, token refresh, and logout.
- Stateful JWT validation guard in `@app/common` with Redis blacklist / session verification.
- Role-Based Access Control (`ADMIN`, `DOCTOR`, `NURSE`, `FINANCE_STAFF`, `PATIENT`) applied to endpoints across `opd-bc`, `emr-bc`, and `finance-bc`.
- Standardized `401 Unauthorized` and `403 Forbidden` error envelopes adhering to the Enterprise Backend Blueprint.

## Approach
- **Service Architecture**: Introduce `iam-bc` (Port `3003`, DB `iam_db`) or modular auth with Redis token store.
- **Stateful JWT**: Access tokens (short-lived) + Refresh tokens (persisted in Redis). Logout / revocation invalidates the token in Redis.
- **Authorization**: Custom NestJS decorators (`@Roles()`, `@RequirePermissions()`) and guards (`JwtAuthGuard`, `RolesGuard`) in `@app/common`.

## Scope
- **In**:
  - Redis container in `docker-compose.yml`.
  - User model & migrations for credentials, password hashing (bcrypt/argon2).
  - Auth endpoints: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`.
  - Reusable guards, strategies, and decorators in `@app/common`.
  - Securing existing endpoints in `opd-bc`, `emr-bc`, and `finance-bc`.
- **Out**:
  - Changes to existing domain entities (`Patient`, `Visit`, `MedicalRecord`, `Invoice`).
  - Changes to RabbitMQ event choreography (`visit.created`, `treatment.completed`, `invoice.paid`).

## Boundary Candidates
- `IAM Service / Module`: Owns credentials, user profiles, role assignments, password verification, and token issuance.
- `Auth Guards in Common`: Decodes JWT, validates session active in Redis, attaches user context to Request object.
- `Domain Controllers`: Annotated with role/permission decorators without changing domain business logic.

## Out of Boundary
- Third-party social logins (OAuth2, SAML, LDAP).
- Billing payment gateway integrations.

## Upstream / Downstream
- **Upstream**: Depends on existing `@app/common` logging, exceptions, and response transformation filters.
- **Downstream**: Consumed by all HTTP controllers across `opd-bc`, `emr-bc`, and `finance-bc`.

## Existing Spec Touchpoints
- **Extends**: None (new spec).
- **Adjacent**: `opd-bc`, `emr-bc`, `finance-bc` controllers.

## Constraints
- Must preserve 100% pass rate of all existing unit, integration, and E2E tests.
- Response formats for `401` and `403` must match Blueprint JSON:API schema.
- Password hashes must use strong, modern hashing algorithms.
