# Gap Analysis: Identity & Access Management (iam-auth)

## Executive Summary

This gap analysis evaluates the existing Hospital Information System (HIS) codebase against the approved Phase 4 requirements for Identity & Access Management (IAM), Stateful JWT Authentication with Redis, and Role-Based Access Control (RBAC).

Currently, the HIS platform operates three bounded contexts (`opd-bc`, `emr-bc`, `finance-bc`) with logical PostgreSQL databases and RabbitMQ event choreography. While Weeks 1–3 (CRUD APIs, event-driven flows, outbox pattern, consumer idempotency, structured logging, and strict DTO validation) are **100% complete and tested (142/142 tests passing)**, the platform currently lacks authentication, session state management, and authorization guards.

---

## 1. Current State vs. Requirements Mapping

| Requirement Area | Status | Existing Assets | Identified Gaps | Technical Constraints |
| :--- | :---: | :--- | :--- | :--- |
| **Req 1: User Registration & Identity** | 🔴 Missing | `StrictValidationPipe`, `AllExceptionsFilter` | No `User` entity, no password hashing, no user repository, no registration endpoint | Must follow PostgreSQL constraint naming (`pk_users`, `uq_users_username`, `uq_users_email`) |
| **Req 2: Authentication & Token Issuance** | 🔴 Missing | None | No JWT library (`@nestjs/jwt`), no login endpoint (`POST /auth/login`), no profile endpoint (`GET /auth/me`) | Token payload must contain `user_id`, `username`, `role`, `session_id` |
| **Req 3: Stateful Session Management (Redis)** | 🔴 Missing | None | No Redis container in `docker-compose.yml`, no Redis client module (`ioredis`), no token revocation/blacklist service | Must support instant token revocation on logout & token theft detection on reuse |
| **Req 4: Role-Based Access Control (RBAC)** | 🔴 Missing | None | No `UserRole` enum, no `@Roles()` decorator, no `RolesGuard` checking domain permissions | Healthcare roles: `ADMIN`, `DOCTOR`, `NURSE`, `FINANCE_STAFF`, `PATIENT` |
| **Req 5: API Security (401 vs 403 & Whitelist)** | 🔴 Missing | `AllExceptionsFilter` handles HTTP exceptions | No `JwtAuthGuard` enforcing 401 on missing/expired/revoked tokens and 403 on role mismatch; no `@Public()` route decorator | Endpoints in `opd-bc`, `emr-bc`, and `finance-bc` must be protected; health `/` and docs `/docs` remain public |
| **Req 6: Password Policy & Security** | 🔴 Missing | `class-validator` in `StrictValidationPipe` | No password complexity validation decorator, no rate limiting for brute-force prevention | Salted one-way hashing (`argon2` or `bcrypt`), minimum 8 chars with mixed case, digit, and symbol |
| **Req 7: Security Audit Logging & Tracing** | 🟡 Partial | `StructuredLogger` formats single-line JSON with `x-trace-id`, `x-correlation-id` | Need security action taxonomy (`AUTH_LOGIN_SUCCESS`, `AUTH_FORBIDDEN`, etc.) and attaching `user_id`/`role` to request logger | Never log plaintext passwords, refresh tokens, or secret keys |
| **Req 8: Resilient & Idempotent Operations** | 🟡 Partial | `IdempotencyService` available in `@app/common` | Need idempotent logout handling and Redis fail-closed fallback returning `503 Service Unavailable` | Graceful reconnection when Redis restarts without restarting microservices |

---

## 2. Implementation Approach Options

### Option A: Shared Library Embedded Auth Module
- **How it works**: Embed `User` entities and auth controllers directly into existing services (e.g. inside `opd-bc` or shared as a modular provider in `@app/common`).
- **Pros**:
  - Requires no new application root in `nest-cli.json` or additional microservice port.
- **Cons**:
  - Violates Database-per-Service boundary by co-locating user credentials with clinical or OPD records.
  - Couples user management directly into domain services.

### Option B: Dedicated IAM Microservice (`iam-bc`) with Shared Guards in `@app/common` *(Recommended)*
- **How it works**:
  1. Add a dedicated `iam-bc` application (Port `3003`, logical database `iam_db`) for user registration, credential management, password hashing, and login/refresh/logout token issuance.
  2. Implement reusable security building blocks in `libs/common`: `JwtAuthGuard`, `RolesGuard`, `@Roles()`, `@Public()`, and Redis session verification client.
  3. Annotate domain controllers in `opd-bc`, `emr-bc`, and `finance-bc` with `@Roles()` and apply the global `JwtAuthGuard`.
- **Pros**:
  - Strict Bounded Context separation: credentials reside solely in `iam_db`.
  - Zero coupling between domain microservices and user credential storage.
  - Standardized microservice pattern consistent with `opd-bc`, `emr-bc`, and `finance-bc`.
- **Cons**:
  - Adds a 4th microservice and port (`3003`) to `docker-compose.yml` and `package.json` scripts.

### Option C: Standalone Token Provider Module with Remote Token Introspection
- **How it works**: Domain services make HTTP or RPC calls to `iam-bc` on every request to validate tokens.
- **Pros**:
  - Centralized authorization decisions.
- **Cons**:
  - Introduces high network overhead and latency on every HTTP request.
  - Stateful JWT with local Redis verification in `@app/common` is vastly more performant.

---

## 3. Implementation Complexity & Risk

- **Effort Estimate**: **M (Medium / 3–5 Days)**
  - Greenfield implementation for IAM module, Redis integration, and guards.
  - Well-established NestJS ecosystem patterns (`@nestjs/jwt`, `ioredis`, `class-validator`, `passport-jwt` or custom NestJS guard).
- **Risk Assessment**: **Low-to-Medium**
  - **Risk**: Adding global `JwtAuthGuard` across existing services could break existing unit/E2E test suites if not handled properly.
  - **Mitigation**: Introduce test helper utilities in `libs/common/src/testing/testing.helpers.ts` to generate mock JWT authorization headers or provide a mock auth context during testing.

---

## 4. Key Decisions & Research Items for Design Phase

1. **Redis Client Selection**:
   - Research compatibility of `ioredis` with NestJS 11 and TypeScript 5.7+ for connection pooling and auto-reconnect.
2. **Password Hashing Library**:
   - Compare `argon2` vs `bcrypt` regarding native binding compatibility across Alpine Docker containers and macOS dev environments.
3. **Session & Blacklist Key Schema in Redis**:
   - Active session schema: `auth:session:<user_id>:<session_id>` (TTL: Refresh token expiry e.g. 7 days).
   - Revoked token blacklist: `auth:blacklist:<jti>` (TTL: Access token remaining duration e.g. 15 minutes).
4. **Test Fixtures & Backwards Compatibility**:
   - Ensure all 34 existing test suites continue to pass seamlessly with test authentication headers.
