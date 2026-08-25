# Project Roadmap & Discovery

## Overview

The Hospital Information System (HIS) is an event-driven microservices monorepo built with NestJS 11, PostgreSQL 16, and RabbitMQ 3. The core business flow spanning Outpatient Department (`opd-bc`), Electronic Medical Records (`emr-bc`), and Billing & Payments (`finance-bc`) is fully implemented with transactional outbox, consumer idempotency, structured JSON logging, distributed tracing, and strict naming conventions (Weeks 1–3).

The remaining scope focuses on Phase 4 (Security, Stateful JWT Authentication with Redis, and Identity & Access Management - IAM).

## Implementation Status Summary

| Area / Bounded Context | Status | Description |
| :--- | :---: | :--- |
| **Infrastructure** | ✅ DONE | Docker Compose with PostgreSQL (3 logical DBs) and RabbitMQ with Management UI |
| **OPD Bounded Context** (`opd-bc`) | ✅ DONE | Patient & Visit CRUD, `visit.created` producer, `invoice.paid` consumer |
| **EMR Bounded Context** (`emr-bc`) | ✅ DONE | Medical record auto-provisioning, treatment completion, `treatment.completed` producer |
| **Finance Bounded Context** (`finance-bc`) | ✅ DONE | Invoice generation from treatment, payment handling, `invoice.paid` producer |
| **Shared Common (`libs/common`)** | ✅ DONE | Outbox service, idempotency service, structured logger, exception filter, strict validation pipe |
| **Shared Contracts (`libs/contracts`)** | ✅ DONE | Strongly-typed event payloads, event name constants, and runtime schema validators |
| **Testing & Quality Gates** | ✅ DONE | 142/142 unit & naming tests passing, E2E suites, live flow script |
| **IAM & Stateful JWT Auth (Phase 4)** | ⏳ MISSING | Stateful JWT with Redis session/revocation store and RBAC/IAM guards across services |

---

## Approach Decision for Phase 4 (IAM & Security)

- **Chosen**: Dedicated IAM Bounded Context (`iam-bc`) with Redis Session Management & Common Auth Guard
- **Why**: Keeps authentication/authorization credentials isolated in `iam_db`, prevents coupling domain DBs with user tables, and provides reusable JWT verification guards via `@app/common`.
- **Rejected Alternatives**:
  - *Monolithic embedded auth in OPD*: Violates single responsibility and mixes administrative/staff credentials with outpatient health records.
  - *Stateless JWT only*: Rejected because healthcare systems require immediate session revocation (logout, permission revocation, compromised token invalidation) via Redis.

## Scope

- **In**:
  - Redis integration in Docker Compose.
  - IAM Microservice (`iam-bc` or shared auth module) with user registration, login, token refresh, and logout.
  - Stateful JWT token management in Redis (token blacklisting & session tracking).
  - RBAC roles (`ADMIN`, `DOCTOR`, `NURSE`, `FINANCE_STAFF`, `PATIENT`) and permission decorators.
  - Integration of Auth Guards across OPD, EMR, and Finance HTTP endpoints with standard `401`/`403` error envelopes.
- **Out**:
  - Rebuilding or refactoring existing Week 1–3 business logic, outbox patterns, or event contracts.
  - External OAuth2 / SSO identity providers (Google/Azure AD) unless requested.

## Constraints

- Preserve zero cross-DB joins and existing database schemas (`opd_db`, `emr_db`, `finance_db`).
- Maintain strict naming conventions and JSON:API / Blueprint standard error formatting.
- Ensure all existing 142 unit tests and E2E suites continue to pass without regressions.

---

## Boundary Strategy

- **`iam-auth`**: Dedicated spec for Authentication, Redis stateful session store, User entity, and RBAC guards.
- **Shared Seams**: Guard integration in `apps/opd-bc`, `apps/emr-bc`, and `apps/finance-bc` without altering their internal domain event choreography.

## Specs (dependency order)

- [ ] iam-auth -- Stateful JWT authentication with Redis and RBAC/IAM authorization guards across HIS microservices. Dependencies: none
