# ADR-001: Monorepo with pnpm Workspaces

**Date:** 2026-01-01  
**Status:** Accepted

## Context

HireFlow has multiple apps (web, api, extension) and shared packages (schemas, config, prompts, utils). We needed to decide whether to use a monorepo or separate repositories.

## Decision

We use a **monorepo with pnpm workspaces** for JavaScript/TypeScript packages.

## Rationale

- Shared schemas (Zod types) can be imported by both the Next.js frontend and the Chrome extension
- Shared config and prompt templates avoid duplication
- A single PR can update schema + frontend + extension atomically
- pnpm workspaces provide efficient dependency deduplication

## Consequences

- All TypeScript packages share `tsconfig.base.json`
- Schema changes propagate immediately without publishing to npm
- The Python backend (FastAPI) is not part of pnpm workspaces but shares the monorepo

---

# ADR-002: FastAPI over NestJS

**Date:** 2026-01-01  
**Status:** Accepted

## Context

The problem statement allowed either FastAPI (Python) or NestJS (Node.js) for the backend.

## Decision

We use **FastAPI + Python 3.12**.

## Rationale

- Python's data science ecosystem is superior for AI/ML integrations
- OpenAI Python SDK, LangChain, and similar libraries are best-in-class in Python
- Alembic + SQLAlchemy provide excellent async ORM and migration support
- FastAPI's automatic OpenAPI generation is production-ready
- Pydantic v2 is extremely fast for validation

## Consequences

- Backend runs in a separate runtime from the frontend
- API contracts are defined via Pydantic schemas and shared as OpenAPI spec
- The `packages/schemas` package duplicates some validation in Zod (frontend) and Pydantic (backend)

---

# ADR-003: JWT Auth (no external provider)

**Date:** 2026-01-01  
**Status:** Accepted

## Context

We needed an authentication strategy that works for web, mobile (future), and the Chrome extension.

## Decision

We implement **JWT-based auth** with short-lived access tokens (60 min) and long-lived refresh tokens (30 days).

## Rationale

- Stateless — no server-side session storage required
- Works across web app, Chrome extension, and future mobile apps
- Access token short expiry limits blast radius of leaked tokens
- Refresh tokens can be revoked by invalidating (future: add token blacklist in Redis)

## Consequences

- No OAuth/social login in Phase 1 (can be added later)
- Refresh token rotation must be implemented for security
- Token storage in the extension uses `chrome.storage.local` (Chrome-profile encrypted)

---

# ADR-004: Application Status as Enum (not workflow engine)

**Date:** 2026-01-01  
**Status:** Accepted

## Context

Job applications have a lifecycle (saved → applied → screening → interview → offer/reject). We needed to decide between a simple status enum vs. a full workflow engine.

## Decision

We use a **status enum with a transition matrix** enforced at the API layer.

## Rationale

- Application lifecycles are linear and well-understood
- A full workflow engine (like Temporal) would be over-engineering for Phase 1
- The transition matrix (`VALID_TRANSITIONS` dict) is easy to test and modify
- Status changes are auditable through the audit log

## Consequences

- All status transitions are validated in `app/api/v1/endpoints/applications.py`
- Invalid transitions return HTTP 422
- Future: add events/webhooks on status changes

---

# ADR-005: Shared Zod Schemas Package

**Date:** 2026-01-01  
**Status:** Accepted

## Context

Both the Next.js frontend and the Chrome extension need to validate API request/response payloads. The FastAPI backend uses Pydantic for the same purpose.

## Decision

Create `packages/schemas` with **Zod schemas and TypeScript types** shared across frontend and extension.

## Rationale

- Single source of truth for all domain types
- Frontend forms use Zod for real-time validation (React Hook Form + zodResolver)
- Extension uses the same schemas to validate API responses
- Reduces type drift between frontend and backend

## Consequences

- Backend Pydantic schemas must stay in sync with Zod schemas
- Consider OpenAPI code generation in Phase 2 to automate this sync
