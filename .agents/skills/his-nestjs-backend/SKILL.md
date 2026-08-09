---
name: his-nestjs-backend
description: Build or modify HIS NestJS backend modules, entities, DTOs, controllers, services, and TypeORM configuration. Use for work in opd-bc, emr-bc, finance-bc, or shared NestJS libraries in the HIS monorepo.
---

# HIS NestJS Backend

## Build modules consistently

- Put HTTP routes in a controller, request validation in DTOs, and business rules in a service.
- Write for the next reader: prefer descriptive names, small focused functions, shallow control flow, and comments that explain why.
- Register entities with `TypeOrmModule.forFeature` in the bounded-context module.
- Import providers into the feature module that consumes them; do not rely on a sibling or parent module's imports.
- Use `ConfigModule` and the service-specific database environment variable; never hardcode credentials.
- Return `NotFoundException` for a missing resource and `ConflictException` for a violated uniqueness rule.

## Follow the naming source of truth

- Follow the [Enterprise Backend Blueprint naming conventions](https://iots1.github.io/enterprise-backend-blueprint/guides/naming-conventions/) and the repository `AGENTS.md` summary.
- Name feature module directories with singular `kebab-case`. Use singular module, entity, DTO, and enum names; use plural controller and service names.
- Name files with `kebab-case` and their NestJS type suffix: singular modules and entities, plural controllers and services, and singular-resource DTOs.
- Use `snake_case` for Entity and DTO properties. Use `camelCase` for other TypeScript variables and functions.
- Prefix boolean and status properties with `is`, `has`, `can`, or `should`, using `snake_case` in Entities and DTOs.
- Use plural `snake_case` table names and `snake_case` column names.
- Name database constraints `pk_<table>`, `fk_<table>_<referenced_table>`, `idx_<table>_<columns>`, `uq_<table>_<columns>`, or `chk_<table>_<condition>`.
- Use path aliases for imports across module boundaries; keep relative imports inside one module.
- Name NestJS event handlers as singular-resource events controllers, such as `visit-events.controller.ts` and `VisitEventsController`.

## Apply HIS domain rules

- OPD owns Patient and Visit. A new visit requires an existing patient and starts as `OPEN`.
- EMR owns MedicalRecord. Treat `visit_id` and `patient_id` as scalar references, never relations to OPD entities.
- Finance owns Invoice. Create it internally from treatment completion, default it to `PENDING`, and reject duplicate payment.
- Store financial database values in `decimal` columns and avoid arithmetic with JavaScript floating-point values.

## Finish safely

1. Add focused tests for new business rules and error paths.
2. Run the affected tests and `npm run build` from `his-project/`.
3. Update README, environment examples, API documentation, and Postman artifacts when behavior changes.
4. Keep the implementation commit separate from unrelated refactoring.
