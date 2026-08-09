# Enterprise Backend Blueprint principles

Source: [Enterprise Backend Blueprint — Introduction](https://iots1.github.io/enterprise-backend-blueprint/guides/introduction/), reviewed 2026-08-07.

Apply these principles while designing, implementing, reviewing, and documenting the HIS project.

## Shared ownership

- Treat the repository as team-owned code; avoid “my code” and “your code” boundaries.
- Keep technical and architectural decisions visible in shared spaces.
- Raise disagreements early instead of silently implementing an alternative.

## Constructive review

- Give specific, kind feedback about code and observable behavior, not the author.
- Ask questions when intent is unclear and assume good intent.
- Explain tradeoffs and propose an actionable improvement.

## Reader-first code

- Prefer clarity and consistency over cleverness.
- Use descriptive names, small focused functions, and shallow control flow.
- Follow established project patterns unless there is a documented reason to change them.
- Write comments to explain why a decision exists, not to narrate what the code already says.
- Understand the reason behind a pattern before working around it.

## Design before build

For significant or cross-service work, record the proposal before coding. A concise ADR, Mermaid diagram, structured comment, or implementation plan is sufficient when it captures:

- ownership and affected boundaries;
- API or event contract changes;
- persistence and failure behavior;
- alternatives and important tradeoffs;
- rollout, compatibility, and verification.

## Documentation as code

- Keep documentation versioned with the implementation.
- Update README, configuration examples, API/event documentation, and runnable artifacts when behavior changes.
- Do not merge a documented behavior change while knowingly leaving its documentation stale.
