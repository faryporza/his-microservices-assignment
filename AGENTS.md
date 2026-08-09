# HIS Microservices Project Rules

This repository is a NestJS monorepo for a Hospital Information System. Run NestJS commands from `his-project/` unless a command explicitly targets repository-level infrastructure.

## Scope and ownership

- Keep `opd-bc`, `emr-bc`, and `finance-bc` as separate bounded contexts.
- Let each service access only its own database: `opd_db`, `emr_db`, or `finance_db`.
- Do not add cross-database joins, foreign keys, transactions, or direct repository access.
- Use RabbitMQ events for cross-service communication. Do not replace an event with a synchronous HTTP call between services.

## API and data rules

- Preserve existing API contracts unless the task explicitly changes them.
- Validate request DTOs with `class-validator`; keep controllers thin and place business rules in services.
- Use UUIDs as scalar references across bounded contexts.
- Store monetary values as PostgreSQL `decimal`; avoid floating-point arithmetic.
- Do not expose public invoice creation. Finance creates invoices from `treatment.completed`.

## Naming conventions

- Treat the [Enterprise Backend Blueprint naming conventions](https://iots1.github.io/enterprise-backend-blueprint/guides/naming-conventions/) as the naming source of truth. If a local instruction conflicts with it, follow the blueprint and update the stale local instruction in the same change.
- Name feature module directories with singular `kebab-case`. Use singular module, entity, DTO, and enum names; use plural controller and service names. Keep filenames in `kebab-case` with their NestJS type suffix.
- Use `snake_case` for Entity and DTO properties so they map directly to PostgreSQL columns. Use `camelCase` for other TypeScript variables and functions.
- Prefix boolean and status flags with `is`, `has`, `can`, or `should`, using the casing required by their context, such as `is_active` in an Entity or DTO and `isActive` in ordinary TypeScript.
- Use plural `snake_case` table names and `snake_case` column names. Name constraints `pk_<table>`, `fk_<table>_<referenced_table>`, `idx_<table>_<columns>`, `uq_<table>_<columns>`, or `chk_<table>_<condition>`.
- Use path aliases for imports that cross module boundaries. Relative imports are acceptable only within the same module.
- Name NestJS event-handler files with the singular resource plus `-events.controller.ts`, for example `visit-events.controller.ts`.

## Event flow

`visit.created` → EMR, `treatment.completed` → Finance, `invoice.paid` → OPD.

- Put shared event names and payload contracts in `his-project/libs/contracts`.
- Make queues and exchanges durable; acknowledge only after successful business logic and database persistence.
- Design consumers to be idempotent. One visit has one primary invoice, and a closed visit remains closed on duplicate payment events.

## Quality and Git

- Keep every commit focused and independently testable.
- Run the relevant unit tests and build before committing; run e2e tests when a service boundary changes.
- Use feature branches from `develop`; merge completed work back into `develop`.
- Keep `.env` out of Git and update `.env.example` when configuration changes.
