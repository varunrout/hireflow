# HireFlow

End-to-end job search automation platform for matching, resume generation, cover letters, autofill support, and application analytics.

## Repository structure

```
hireflow/
├── apps/
│   ├── api/          # FastAPI backend (Python)
│   ├── web/          # Next.js 14 frontend
│   └── extension/    # Chrome extension (Manifest V3)
├── packages/
│   ├── schemas/      # Shared Zod schemas
│   ├── config/       # Shared configuration
│   ├── prompts/      # LLM prompt templates
│   └── utils/        # Shared utilities
├── package.json
└── pnpm-workspace.yaml
```

## Prerequisites

| Tool | Minimum version | Install guide |
|------|-----------------|---------------|
| [Node.js](https://nodejs.org/) | 18 | <https://nodejs.org/en/download> |
| [pnpm](https://pnpm.io/) | 8 | `npm install -g pnpm` |
| [Python](https://www.python.org/) | 3.11 | <https://www.python.org/downloads/> |
| [PostgreSQL](https://www.postgresql.org/) | 15 | <https://www.postgresql.org/download/> |

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/varunrout/hireflow.git
cd hireflow
```

### 2. Install JavaScript / TypeScript dependencies

```bash
pnpm install
```

### 3. Install Python dependencies

```bash
cd apps/api
pip install -r requirements.txt
cd ../..
```

## Environment variables

Copy the example environment files and fill in your values.

```bash
# Backend
cp apps/api/.env.example apps/api/.env

# Frontend
cp apps/web/.env.example apps/web/.env.local
```

Key variables to set:

| Variable | Where | Description |
|----------|-------|-------------|
| `DATABASE_URL` | `apps/api/.env` | PostgreSQL connection string |
| `SECRET_KEY` | `apps/api/.env` | JWT signing secret |
| `OPENAI_API_KEY` | `apps/api/.env` | OpenAI API key for AI features |
| `NEXT_PUBLIC_API_URL` | `apps/web/.env.local` | URL of the running API (e.g. `http://localhost:8000`) |

## Starting the app

### Start the API (FastAPI)

```bash
cd apps/api
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at <http://localhost:8000>.  
Interactive docs (Swagger UI) are at <http://localhost:8000/docs>.

### Start the web app (Next.js)

Open a new terminal:

```bash
cd apps/web
pnpm dev
```

The web app will be available at <http://localhost:3000>.

### Start everything at once (from the repo root)

```bash
pnpm dev
```

This runs all `dev` scripts in the workspace in parallel.

## Loading the Chrome extension

1. Build the extension:
   ```bash
   cd apps/extension
   pnpm build
   ```
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the `apps/extension/dist` folder.

The HireFlow extension icon will appear in your Chrome toolbar.

## Running tests

### Backend tests

```bash
cd apps/api
python -m pytest tests/ -v
```

### Frontend tests

```bash
cd apps/web
pnpm test
```

### All tests (from the repo root)

```bash
pnpm test
```

## Useful scripts (repo root)

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in development mode |
| `pnpm build` | Build all packages and apps |
| `pnpm test` | Run all test suites |
| `pnpm lint` | Lint all packages and apps |

## Contributing

1. Fork the repository and create a feature branch.
2. Make your changes, add tests, and ensure `pnpm lint` and `pnpm test` pass.
3. Open a pull request against `main`.
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
