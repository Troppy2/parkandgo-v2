# CLAUDE.md — Park & Go V2
> Operational instructions for Claude. Read this before every task.
> For deep project reference, see `.claude/MEMORY.md`
> For slash commands, see `.claude/COMMANDS.md`

---

## 🚀 How to Run the Project

```bash
# Backend (FastAPI)
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend (React + TS)
cd frontend
npm run dev        # runs on localhost:3000

# Full stack
docker-compose up
```

---

## ⚡ Non-Negotiable Rules

### Python / Backend
- **Always use `async`/`await`** — no sync DB calls, ever
- **Never call `session.commit()`** in repositories — use `flush()` only. `commit()` happens in `get_db()`
- **Never write DB queries in route handlers** — all queries go through a repository
- **Always use `Depends()`** for DB sessions and auth — never instantiate manually in routes
- **Protected routes require `user: User = Depends(get_current_user)`** — don't skip this
- **New POST routes must return status 201**, not the default 200

### TypeScript / Frontend
- **No `any` types** — ever. Use `unknown` and narrow it, or define a proper type
- **All API calls go through TanStack Query** — no raw `fetch`/`axios` in components
- **Loading and error states are required** on every data-fetching component
- **Forms use React Hook Form + Zod** — no uncontrolled inputs, no manual validation

### General
- **Never hardcode secrets, URLs, or config values** — use `settings` (backend) or `env.ts` (frontend)
- **Never modify `.env`** — only `.env.example` gets updated

---

## 🧠 Critical Gotchas (Read These Carefully)

| Gotcha | Detail |
|---|---|
| `prefered_name` | One `r` — intentional DB typo. **Never "fix" this.** It's in the DB column, model, and all schemas |
| `spot_id` | ParkingSpot PK is `spot_id`, not `id`. `ParkingRepository.get_by_id()` already handles this |
| Async session | Import `AsyncSession` from `sqlalchemy.ext.asyncio`, never `Session` from `sqlalchemy.orm` |
| Comma-separated prefs | `preferred_parking_types` is a `str`, not a list. Split with `.split(",")` and `.strip()` each item |
| Cost scoring cap | Anything ≥ $5.00 scores 0 pts on cost. This is intentional, don't change the cap |
| CORS | `allow_origins` in `main.py` only allows `localhost:3000` — update before any deploy |

---

## 📁 Where Things Live

| What | Where |
|---|---|
| App settings / env vars | `backend/app/core/config.py` → `settings` object |
| JWT logic | `backend/app/core/security.py` |
| Auth flow (Google OAuth) | `backend/app/services/auth_service.py` |
| Recommendation scoring | `backend/app/services/recommendation_engine.py` |
| DB session + engine | `backend/app/core/database.py` |
| Route dependencies | `backend/app/api/deps.py` |
| API routers registered | `backend/app/main.py` |
| API base URL constant | `frontend/src/lib/api/endpoints.ts` |
| Global state | `frontend/src/store/` (Zustand) |
| Server state / fetching | TanStack Query hooks in each `features/*/hooks/` |
| Design tokens (CSS vars) | `frontend/src/styles/variables.css` |

---

## 🎨 Design Rules

- **Primary color:** `#7A0019` (UMN Maroon)
- **Secondary color:** `#FFCC33` (UMN Gold)
- **Never introduce new colors** without adding them as CSS variables in `variables.css`
- **Mobile pattern:** Google Maps style — bottom sheet, floating search bar, map background
- **Desktop pattern:** Apple Maps style — frosted glass sidebar (340px), map fills rest
- **Min touch target size:** 44×44px on all interactive elements
- Use `clsx` for conditional Tailwind classes, never string concatenation

---

## 🔌 API Conventions

```
Base prefix:   /api
Auth:          POST /api/auth/google   GET /api/auth/me
Parking:       GET/POST /api/parking/  GET /api/parking/search  GET /api/parking/filter
Recs:          GET /api/recommendations/  (requires Bearer token)
Users:         PATCH /api/users/me     (requires Bearer token)
```

All protected routes expect: `Authorization: Bearer <jwt_token>`

---

## ✅ Checklist — Adding Any New Feature

- [ ] SQLAlchemy model in `models/` + Alembic migration
- [ ] Pydantic schemas (Request + Response) in `schemas/`
- [ ] Repository methods in `repositories/`
- [ ] Business logic in `services/`
- [ ] API router in `api/` + registered in `main.py`
- [ ] React feature folder: `features/<name>/components/`, `hooks/`, `services/`
- [ ] TanStack Query hook for data fetching
- [ ] Loading skeleton + error state in UI
- [ ] Zod schema for any form inputs
- [ ] Types added to `frontend/src/types/`

---

## 🐛 Bug Fix Command

Type `/bug-fix` to run a full project audit.
Claude will scan every file, fix what's safe to fix automatically, and return a structured report of what was broken and what was clean.
Full spec in `.claude/COMMANDS.md`.