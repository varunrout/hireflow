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
