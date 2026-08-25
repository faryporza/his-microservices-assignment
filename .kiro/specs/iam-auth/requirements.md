# Requirements Document: Identity & Access Management (iam-auth)

## Introduction

This specification defines the functional and non-functional requirements for Identity & Access Management (IAM), User Management, Stateful JWT Authentication with Redis session storage, and Role-Based Access Control (RBAC) across the Hospital Information System (HIS) platform. 

The requirements establish authentication and authorization protocols to secure the existing Outpatient Department (`opd-bc`), Electronic Medical Records (`emr-bc`), and Finance (`finance-bc`) endpoints in full alignment with the Enterprise Backend Blueprint and the assignment specification (Phase 4), while preserving existing event-driven choreographies.

## Boundary Context

- **In Scope**:
  - User registration, credential storage, and password security policies.
  - User authentication, short-lived Access Token generation, and long-lived Refresh Token generation.
  - Stateful session tracking and immediate token revocation (blacklisting) backed by Redis.
  - Role-Based Access Control (RBAC) supporting healthcare roles (`ADMIN`, `DOCTOR`, `NURSE`, `FINANCE_STAFF`, `PATIENT`).
  - Enforcement of standard HTTP security responses: `401 Unauthorized` (missing/invalid/revoked credentials) vs `403 Forbidden` (insufficient privileges).
  - Protection of domain HTTP endpoints across OPD, EMR, and Finance services.
  - Security audit logging and distributed tracing context integration.
  - Idempotent logout and resilient session failure handling.

- **Out of Scope**:
  - Modifications to existing domain entities (`Patient`, `Visit`, `MedicalRecord`, `Invoice`) or their PostgreSQL schemas.
  - Modifications to internal asynchronous RabbitMQ event flows (`visit.created`, `treatment.completed`, `invoice.paid`).
  - External Third-Party Identity Providers (OAuth2, OIDC, SAML, Social Logins).
  - Multi-Factor Authentication (MFA / TOTP) and biometric verification.

- **Adjacent Expectations**:
  - Existing microservices and shared libraries (`@app/common`) provide structured JSON logging and Blueprint error filter envelopes.
  - Redis cache service is accessible for stateful session persistence and token blacklist lookups.

---

## Requirements

### Requirement 1: User Registration & Identity Provisioning [Assignment Mandatory - Phase 4]
**Objective:** As a System Administrator or prospective user, I want to register and manage user accounts with defined roles, so that authorized healthcare actors can securely access the HIS platform.

#### Acceptance Criteria
1. When a registration request is received with valid attributes (`username`, `password`, `email`, `first_name`, `last_name`, `role`), the IAM System shall create the user account, hash the password, and return the newly created user profile without sensitive credentials.
2. If a registration request contains an existing `username` or `email`, the IAM System shall reject the request and return a `409 Conflict` error in the standard Blueprint error format.
3. If a registration request contains invalid or missing required fields, or an unsupported role, the IAM System shall reject the request and return a `400 Bad Request` validation error identifying invalid field pointers.
4. The IAM System shall default newly registered accounts to an active status and assign one of the recognized system roles (`ADMIN`, `DOCTOR`, `NURSE`, `FINANCE_STAFF`, `PATIENT`).

---

### Requirement 2: Authentication & Token Issuance [Assignment Mandatory - Phase 4]
**Objective:** As a Registered User, I want to authenticate with my credentials to obtain access and refresh tokens, so that I can perform authorized actions across HIS microservices.

#### Acceptance Criteria
1. When valid login credentials (`username`/`email` and `password`) are submitted, the IAM System shall verify the credentials, generate a short-lived Access Token and a long-lived Refresh Token, register the active session in the stateful session store, and return the token pair.
2. If invalid credentials or non-existent user identifiers are submitted, the IAM System shall reject the request and return a `401 Unauthorized` response with a generic error message that does not disclose whether the user exists.
3. If a disabled or inactive user account attempts to authenticate, the IAM System shall reject the request and return a `401 Unauthorized` response.
4. When an authenticated user requests their own identity profile via `GET /auth/me`, the IAM System shall return the authenticated user's ID, username, email, full name, assigned role, and current session metadata.

---

### Requirement 3: Stateful Session Management & Token Revocation [Assignment Mandatory - Phase 4]
**Objective:** As a Security Operator or User, I want active sessions to be statefully tracked and immediately revocable upon logout or refresh, so that compromised or retired tokens cannot be used to access sensitive medical data.

#### Acceptance Criteria
1. While an Access Token is within its validity period, when an API request is received, the Security Guard shall verify the token signature and verify with the stateful session store that the session and token identifier are active and not revoked.
2. When a valid Refresh Token is presented at the token refresh endpoint, the IAM System shall verify that the session is active in the session store, revoke the old Refresh Token, issue a new Access Token and Refresh Token pair, and update the session store.
3. When a logout request is received from an authenticated user, the IAM System shall immediately record the token and session identifier as revoked in the stateful session store and terminate the active session.
4. If an API request is made using an Access Token whose token identifier or session has been revoked in the session store, the Security Guard shall reject the request and return a `401 Unauthorized` error response.
5. If a previously consumed or revoked Refresh Token is reused in a refresh attempt, the IAM System shall treat the event as potential token theft, reject the request with `401 Unauthorized`, and revoke all active sessions associated with that user.

---

### Requirement 4: Role-Based Access Control (RBAC) [Assignment Mandatory - Phase 4]
**Objective:** As a Compliance Officer, I want fine-grained role-based permissions enforced across all bounded contexts, so that users can only perform operations permitted for their specific healthcare role.

#### Acceptance Criteria
1. When an authenticated user attempts to access an endpoint, the Authorization Guard shall inspect the user's role against the endpoint's required role permissions before granting execution.
2. The Authorization Guard shall permit Patient Registration and Visit Creation (`POST /patients`, `POST /visits`) only to users with the `ADMIN`, `DOCTOR`, or `NURSE` role.
3. The Authorization Guard shall permit recording and completing clinical medical records (`POST /records`, `PATCH /records/:id`, `PATCH /records/:id/complete`) only to users with the `DOCTOR` role.
4. The Authorization Guard shall permit viewing medical records (`GET /records`, `GET /records/:id`, `GET /records/visit/:visitId`) to users with `DOCTOR`, `NURSE`, or `ADMIN` roles, or to a `PATIENT` whose patient identity matches the record.
5. The Authorization Guard shall permit invoice payment processing (`PATCH /invoices/:id/pay`) only to users with the `FINANCE_STAFF` or `ADMIN` role.
6. The Authorization Guard shall permit invoice viewing (`GET /invoices`, `GET /invoices/:visitId`) to users with `FINANCE_STAFF` or `ADMIN` roles, or to a `PATIENT` whose visit identity matches the invoice.

---

### Requirement 5: API Security Enforcement & Error Protocol (`401` vs `403`) [Assignment Mandatory - Phase 4]
**Objective:** As an API Consumer or Frontend Client, I want standard, predictable HTTP status codes and error structures for security failures, so that unauthenticated and unauthorized requests are handled accurately.

#### Acceptance Criteria
1. If a request to a protected endpoint lacks an authentication token, contains an expired token, or contains a malformed/tampered token, the Security Guard shall reject the request and return a `401 Unauthorized` response.
2. If an authenticated user attempts to perform an operation for which their assigned role lacks permission, the Authorization Guard shall reject the request and return a `403 Forbidden` response.
3. All `401 Unauthorized` and `403 Forbidden` responses shall be formatted in the standard Enterprise Backend Blueprint JSON:API error envelope containing `status.code`, `status.message`, and `errors` array.
4. Where an endpoint is explicitly marked as public (such as health check endpoints `/`, Swagger documentation `/docs`, `/auth/login`, and `/auth/register`), the Security Guard shall allow unauthenticated requests without requiring a token.

---

### Requirement 6: Password Policy & Credential Security [Enterprise Enhancement]
**Objective:** As a Security Engineer, I want strong password policies and modern cryptographic hashing enforced, so that user credentials are protected against brute-force and dictionary attacks.

#### Acceptance Criteria
1. When a user registers or changes a password, the IAM System shall validate that the password meets the minimum complexity policy (minimum 8 characters, at least one uppercase letter, one lowercase letter, one numeric digit, and one special symbol).
2. If a submitted password fails the complexity policy, the IAM System shall reject the request and return a `400 Bad Request` error detailing the specific policy violation.
3. The IAM System shall hash all user passwords using a modern, cryptographically secure one-way salted hashing algorithm (Argon2id or bcrypt) prior to persistence, ensuring plaintext passwords are never stored or logged.
4. If repeated consecutive failed authentication attempts occur for a specific account within a designated time window, the IAM System shall apply rate-limiting / temporary backoff and return a `429 Too Many Requests` response.

---

### Requirement 7: Security Audit Logging & Tracing Context [Enterprise Enhancement]
**Objective:** As a Security Auditor, I want all security-relevant lifecycle events logged in a structured format with correlation metadata, so that security events and access violations can be audited and traced end-to-end.

#### Acceptance Criteria
1. When authentication succeeds, authentication fails, tokens are revoked, or an authorization violation occurs (`401` or `403`), the IAM System shall emit a structured single-line JSON audit log.
2. The Security Audit Logger shall include `timestamp`, `service`, `action`, `user_id` (if identified), `role`, `client_ip`, `resource`, `x-trace-id`, and `x-correlation-id` in every security audit entry.
3. The IAM System and Security Guards shall never write passwords, plaintext credentials, refresh tokens, or raw authorization secrets into any log output.
4. When an authenticated request is processed across any protected service, the Security Guard shall attach the verified user context (`user_id`, `role`, `username`) to the request context for downstream auditing.

---

### Requirement 8: Resilient & Idempotent Security Operations [Enterprise Enhancement]
**Objective:** As a System Operator, I want authentication and logout mechanisms to behave idempotently and fail securely during infrastructure degradation, so that system stability and security are maintained.

#### Acceptance Criteria
1. When a logout request is received for an already revoked or non-existent active session, the IAM System shall process the request idempotently and return a `200 OK` or `204 No Content` response without error.
2. If the stateful session store becomes temporarily unreachable, the Security Guard shall fail closed, reject protected API requests with a `503 Service Unavailable` error, and log an operational alert without exposing stack traces to the client.
3. When the stateful session store recovers connectivity, the Security Guard and IAM System shall resume normal session verification and token lifecycle operations without requiring a service restart.
