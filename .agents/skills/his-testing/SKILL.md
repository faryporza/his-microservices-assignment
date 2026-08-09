---
name: his-testing
description: Test HIS NestJS services, PostgreSQL persistence, HTTP APIs, dependency injection, and RabbitMQ event flows. Use after backend changes, before commits, or when diagnosing incorrect business behavior in the HIS monorepo.
---

# HIS Testing

## Choose the smallest sufficient test

- Use unit tests for service rules, repository outcomes, and exception paths.
- Use application bootstrap tests to catch missing NestJS module providers and dependency-injection errors.
- Use e2e tests for HTTP routes, DTO validation, and the service's own database connection.
- Use integration tests for RabbitMQ publishing, consuming, ACK/NACK behavior, and persistence across service boundaries.
- After naming changes, verify snake_case DTO payloads, Entity property references, path aliases, and explicit database constraint names before running the affected tests.

## Cover outcomes, not only status codes

- Assert persisted status and fields: `OPEN`, `COMPLETED`, `PENDING`, `PAID`, and `CLOSED`.
- Cover duplicate HN and ID card, missing patient/record/invoice, negative amounts, and repeat payment.
- For events, assert both the outgoing contract and the receiving service's persisted result.
- Test duplicate events and an unavailable consumer before calling a messaging flow complete.

## Required checks

Run from `his-project/`:

```bash
npm test -- --runInBand
npm run test:e2e
npm run build
```

Start each application at least once when dependency-injection wiring changes. When testing a full event flow, verify this sequence: Patient → Visit `OPEN` → Record `COMPLETED` → Invoice `PENDING` → Invoice `PAID` → Visit `CLOSED`.

## Audit assignment delivery

- Map every mandatory Phase 1–3 requirement to a file, command result, or observed runtime outcome.
- Classify evidence as passed, missing, failing, or optional; do not infer success from the presence of a file.
- Run the exported Postman collection repeatedly. Generate unique patient identifiers, wait or retry for eventual consistency, and assert every required state transition.
- Keep enhancements beyond the Gist separate from mandatory defects. IAM is optional unless explicitly requested.
