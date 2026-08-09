---
name: his-assignment
description: Audit, plan, or complete the HIS microservices assignment against its mandatory phases and the Enterprise Backend Blueprint engineering principles. Use for whole-repository reviews, gap analyses, delivery checklists, documentation updates, or work spanning OPD, EMR, Finance, PostgreSQL, RabbitMQ, tests, and Postman.
---

# HIS Assignment

## Load the project contract

Read these references before judging repository completeness or planning multi-service work:

- [Assignment requirements](references/assignment-requirements.md) for mandatory scope, services, data ownership, APIs, events, and deliverables.
- [Engineering principles](references/engineering-principles.md) for collaboration, readability, design, and documentation expectations.

Treat Phase 1–3 as required. Treat Phase 4 IAM as optional unless the user explicitly includes it. Do not turn examples or optional suggestions into mandatory acceptance criteria.

## Resolve instructions consistently

1. Follow the repository `AGENTS.md` for local operating rules.
2. Use the assignment Gist for concrete HIS scope and acceptance requirements.
3. Use the Enterprise Backend Blueprint naming conventions as the naming source of truth.
4. Use the Blueprint introduction for engineering principles.
5. Preserve an existing public contract unless the task explicitly authorizes a contract change.

When sources appear inconsistent, state the conflict and choose the narrowest interpretation that preserves required behavior and service boundaries.

## Route work to focused skills

- Use `$his-architecture` before schema or behavior changes that cross bounded contexts.
- Use `$his-nestjs-backend` for NestJS modules, entities, DTOs, controllers, services, and TypeORM work.
- Use `$his-rabbitmq` for event contracts, publishers, consumers, durability, acknowledgement, and idempotency.
- Use `$his-testing` after implementation changes and before claiming completion.

For significant changes, write a short design note, ADR, Mermaid diagram, or structured plan before implementation. Keep the decision visible in the repository or shared task context.

## Audit with evidence

1. Map every Phase 1–3 requirement to a file, executable check, or observed runtime result.
2. Distinguish `passed`, `missing`, `failing`, and `optional`; do not infer success from file names alone.
3. Run checks proportionate to the claim. Use unit tests and build at minimum; use e2e and live infrastructure checks for HTTP, database, or messaging claims.
4. Verify that the exported Postman collection is repeatable and covers the required business flow.
5. Update README, environment examples, API/event documentation, and Postman artifacts whenever documented behavior changes.
6. Report exact remaining gaps and label enhancements beyond the assignment separately.

Prefer a small, focused change over unrelated cleanup. Write for the next reader: descriptive names, focused functions, shallow control flow, and comments that explain why.
