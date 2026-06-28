# TutorMina

**Learning Management System** — Empowering students, tutors, and coaches with collaborative tools and AI-powered insights.

## Architecture

```
tutormina/
├── frontend/          # React + TypeScript + Vite → Deploys to Netlify
├── ai-api/            # FastAPI + Python → Deploys to HuggingFace Spaces
├── supabase/          # Database migrations & config → Supabase (hosted prod / local dev)
├── dev-start.ps1      # One-command local dev startup
└── .gitignore
```

## Branch Strategy

| Branch | Purpose | Deploys To |
|--------|---------|------------|
| `main` | Production-ready code | Netlify (frontend), HuggingFace (AI API) |
| `develop` | Active development & testing | Local only |

> **Rule:** Only merge `develop` → `main` when features are tested and ready for production. This keeps `main` clean and avoids pushing dev artifacts (venv, node_modules, Docker volumes) to hosted platforms.

## Local Development Setup

### Prerequisites
- **Docker Desktop** (for local Supabase)
- **Node.js** 18+ and npm
- **Python** 3.11+

### Quick Start

```powershell
# 1. Clone & enter the project
cd c:\Users\kmthu\projects\tutormina

# 2. Switch to develop branch
git checkout develop

# 3. Install frontend dependencies (first time only)
cd frontend && npm install && cd ..

# 4. Create Python venv (first time only)
cd ai-api && python -m venv venv && .\venv\Scripts\pip.exe install -r requirements.txt && cd ..

# 5. Start everything
.\dev-start.ps1
```

### Services (Local)

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | React app (Vite dev server) |
| AI API | http://127.0.0.1:8000 | FastAPI with AI endpoints |
| Supabase API | http://127.0.0.1:55321 | Local Postgres + Auth + Storage |
| Supabase Studio | http://127.0.0.1:55323 | DB admin UI (like phpMyAdmin) |
| InBucket | http://127.0.0.1:55324 | Local email testing (catches auth emails) |

### Starting Services Individually

```powershell
# Supabase (local DB)
npx supabase start

# AI API
cd ai-api
.\venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Frontend
cd frontend
npm run dev
```

### Stopping Services

```powershell
# Stop Supabase
npx supabase stop

# Frontend & AI API: just Ctrl+C in their terminals
```

## Environment Files

| File | Purpose | Committed? |
|------|---------|------------|
| `frontend/.env.local` | Local dev (local Supabase) | ❌ No |
| `frontend/.env.production` | Prod template (hosted Supabase) | ❌ No |
| `ai-api/.env` | Local dev (local Supabase + HF token) | ❌ No |

> **Production secrets** are configured directly in Netlify/HuggingFace dashboards, not in files.

## Database Migrations

Migrations live in `supabase/migrations/` and are automatically applied when you run `npx supabase start`.

To create a new migration:
```powershell
npx supabase migration new my_migration_name
```

To apply migrations to the hosted (production) Supabase:
```powershell
npx supabase db push --linked
```

## Deployment

### Frontend → Netlify
- Branch: `main`
- Build command: `cd frontend && npm run build`
- Publish directory: `frontend/dist`
- Environment variables: Set in Netlify dashboard

### AI API → HuggingFace Spaces
- Branch: `main` (ai-api directory only)
- The `ai-api/` folder is deployed as a standalone HuggingFace Space
- Keep the venv out of git — HuggingFace installs from `requirements.txt`
