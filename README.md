# HireFlow — AI-Powered Job Application Copilot

> **Status:** Phase 1 Foundation — actively developed

HireFlow is a production-grade SaaS platform that helps job seekers:
- Create structured professional profiles
- Generate ATS-ready and visually designed resumes
- Tailor resumes and cover letters for specific jobs
- Autofill job application forms via a Chrome extension
- Track applications and optimize their job search

---

## Monorepo Structure

```
/apps
  /web         → Next.js 14 frontend (TypeScript, Tailwind, React Query)
  /api         → FastAPI backend (Python 3.12, SQLAlchemy, Alembic)
  /extension   → Chrome Extension MV3 (TypeScript)
/packages
  /schemas     → Shared Zod schemas and TypeScript types
  /config      → Shared constants and configuration
  /prompts     → AI prompt templates and orchestration registry
  /utils       → Shared utility functions
/infrastructure
  /docker      → Docker configuration
/docs
  /adr         → Architecture Decision Records
  /api         → API documentation
  /architecture → System architecture docs
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, React Query, React Hook Form, Zod |
| Backend | FastAPI, Python 3.12, SQLAlchemy 2, Alembic |
| Database | PostgreSQL 16 |
| Cache/Queue | Redis 7, Celery |
| Storage | S3-compatible (MinIO for local dev) |
| AI | OpenAI API (gpt-4o / gpt-4o-mini) |
| Extension | Chrome MV3, TypeScript |
| Auth | JWT (access + refresh tokens, bcrypt passwords) |

---

## Quick Start (Local Development)

### Prerequisites
- Docker & Docker Compose
- Node.js ≥ 20 + pnpm ≥ 9
- Python ≥ 3.12

### 1. Clone and setup

```bash
git clone https://github.com/varunrout/hireflow
cd hireflow
cp .env.example .env
```

### 2. Start infrastructure

```bash
docker-compose up postgres redis minio -d
```

### 3. Run database migrations

```bash
cd apps/api
cp .env.example .env
pip install -e ".[dev]"
alembic upgrade head
```

### 4. Start the API

```bash
uvicorn app.main:app --reload
# API docs at http://localhost:8000/docs
```

### 5. Start the frontend

```bash
cd ../..
pnpm install
pnpm --filter @hireflow/web dev
# Frontend at http://localhost:3000
```

### 6. Full stack with Docker Compose

```bash
docker-compose up --build
```

---

## Environment Variables

See `apps/api/.env.example` for backend configuration.

---

## Development Phases

### ✅ Phase 1: Foundation (current)
- Monorepo structure with pnpm workspaces
- Authentication (register, login, JWT tokens)
- Candidate profile CRUD (experience, education, skills, projects, certifications)
- PostgreSQL schema + Alembic migrations (all 20+ core entities)
- Full REST API (auth, profiles, jobs, applications, resumes, analytics)
- Next.js frontend skeleton (auth pages, dashboard, sidebar navigation)
- Chrome extension skeleton (MV3, background worker, content script, autofill)
- Shared schema package (Zod validation shared across frontend/backend)
- AI prompt registry (resume tailoring, cover letters, job parsing, answer generation)
- Docker Compose for local development

### 🔄 Phase 2: Document Generation
- Resume builder data model
- ATS/designed resume templates
- PDF/DOCX export pipeline

### ⏳ Phase 3: Matching & Content Generation
- Job matching engine (rule-based + semantic scoring)
- Tailored resume generation
- Cover letter + answer generation

### ⏳ Phase 4: Extension & Application Workflows
- Chrome extension autofill with review-before-submit
- Application status state machine

### ⏳ Phase 5: Analytics & Quality
- Funnel metrics, outcome dashboards
- Prompt versioning + audit trails

---

## API Documentation

When running locally:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

## Testing

```bash
# Backend unit tests
cd apps/api && pytest tests/ -v

# Shared schema tests
pnpm --filter @hireflow/schemas test
```

---

## License

MIT
