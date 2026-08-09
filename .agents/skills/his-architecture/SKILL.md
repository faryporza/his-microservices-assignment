---
name: his-architecture
description: Review or design HIS service boundaries, database ownership, API contracts, and event-driven communication. Use before cross-service changes, schema changes, or implementation plans that affect multiple OPD, EMR, or Finance bounded contexts.
---

# HIS Architecture

## Respect bounded contexts

| Service | Owns | Database |
| --- | --- | --- |
| OPD | Patient, Visit | `opd_db` |
| EMR | MedicalRecord | `emr_db` |
| Finance | Invoice, payment | `finance_db` |

- Keep foreign keys and ORM relations inside a service database only.
- Represent another service's identifier as a scalar UUID/string; do not import its entity.
- Do not query, join, or transact across service databases.

## Use asynchronous business flow

- Let OPD emit `visit.created` after opening a visit.
- Let EMR emit `treatment.completed` after recording treatment.
- Let Finance create the invoice from that event and emit `invoice.paid` after payment.
- Let OPD close the visit from `invoice.paid`.

## Review before implementation

1. Identify the owning service and database for every new field and invariant.
2. Decide whether the change is local HTTP behavior or a cross-service event.
3. Keep event payloads minimal and backward compatible.
4. Apply the repository naming rules to tables, columns, primary keys, foreign keys, indexes, unique constraints, and check constraints.
5. Identify duplicate-delivery behavior and persistence constraints before writing the event handler.
6. Record significant decisions in a concise ADR, Mermaid diagram, structured comment, or shared implementation plan before coding.

Keep architecture discussions visible. Explain alternatives and tradeoffs, ask when intent is unclear, and update architecture or event documentation in the same change as documented behavior.
