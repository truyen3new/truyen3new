# Clean Architecture Standard

## Principles

- Dependencies point inward only.
- Domain code contains business rules, not infrastructure calls.
- Application code orchestrates use cases and DTOs.
- Infrastructure code adapts external systems behind interfaces.
- Presentation code handles transport, validation entry points, and response shaping only.

## Rules

- Do not import Supabase, fetch, storage, or database clients from domain entities or use cases.
- Do not place business logic inside route handlers, React components, or repositories.
- Keep shared abstractions in `src/shared/core`.
- Use `DomainError` subclasses for known failures and `GlobalExceptionHandler` for transport-level error mapping.
- Validate inputs before domain execution.
- Prefer DTOs for I/O and entities for business state.
- Repositories implement data access only; they must not contain orchestration.
- Services extend `BaseService` when they coordinate multiple operations.

## Layer Flow

Presentation -> Application -> Domain
Infrastructure -> Application -> Domain

No layer may depend on a sibling or outer layer directly.

## Error Handling

- Always return standardized error responses.
- Include a request trace id in every error response.
- Log known domain errors with limited details.
- Log unexpected errors with stack/context internally only.

## Validation

- Validate request DTOs before mapping to domain objects.
- Reject invalid payloads at the boundary.
- Keep validation rules declarative and reusable.

## Team Rules

- New features must start as a use case.
- Repositories must be injectable behind interfaces.
- No direct database access in use cases or UI code.
- Avoid duplication; extract common behavior into shared core only when it is used by at least two call sites.
