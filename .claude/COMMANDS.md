# Park & Go V2 — Claude Commands

## Available Commands
---

## /cleanup

---

**What it does:**  
Runs a full audit of the entire **Park & Go V2** project (/backend + /frontend).  
it cleans up code that claude left during the scaffold

**How to trigger:**  
Type `/cleanup` in the chat.

---
What to look through: 
1. Look through the planning guide for the folder structure to see where each file is located
2. Clean up comments that look like they are giving me a task, keep all the comments that actually describe the program and what it is meant to do.
 - Example: "Your Task"


---

## /bug-fix

---
**What it does:**  
Runs a full audit of the entire **Park & Go V2** project (backend + frontend).  
Finds bugs, fixes them directly in the code, and returns a structured bug report.

**How to trigger:**  
Type `/bug-fix` in the chat.

---

# Workflow

1. Perform a full audit of the project implementation.
2. Read every file in the provided directories.
3. Compare the current implementation against expected architecture and best practices.
4. Identify all bugs including runtime errors, logic flaws, configuration mistakes, and schema mismatches.
5. Fix all issues **directly in place**.

### Rules

- Do **not** provide partial fixes.
- Do **not** suggest experiments such as “try this”.
- Do **not** leave broken logic unresolved.
- Always return **corrected implementations where needed**.
- Only leave items unfixed if they require **human architectural decisions**.

---

# What the agent checks

## Backend (`/backend/app/`)

- [ ] Import errors and missing modules
- [ ] Incorrect `await` usage (sync calls inside async functions)
- [ ] Missing `Depends()` on protected routes
- [ ] Schema mismatches between Pydantic models and SQLAlchemy models
- [ ] Incorrect column names (`prefered_name` vs `preferred_name`)
- [ ] Missing `model_config = {"from_attributes": True}` on response schemas
- [ ] Routes returning wrong types (model instance vs schema)
- [ ] `get_db()` session not properly yielded in all paths
- [ ] JWT decode errors not caught
- [ ] CORS origin misconfigurations
- [ ] `flush()` vs `commit()` misuse in repositories
- [ ] Missing `nullable=False` on required DB columns
- [ ] Repository methods using wrong primary key column name
- [ ] Hardcoded values that should come from `settings`
- [ ] Unhandled exceptions in auth service (Google token validation)
- [ ] Missing HTTP status codes on POST routes (should be `201`)
- [ ] Type annotation mismatches (`str` vs `Optional[str]`)
- [ ] Incorrect dependency injection patterns
- [ ] Missing transaction safety or rollback protection

---

## Frontend (`/frontend/src/`)

- [ ] Missing TypeScript types or excessive `any`
- [ ] TanStack Query keys not unique or mismatched
- [ ] Missing error states in data fetching hooks
- [ ] Missing loading states / skeleton screens
- [ ] Zod schema mismatches with API response shapes
- [ ] Zustand store actions not matching state shape
- [ ] React Hook Form fields not registered properly
- [ ] Broken imports (path aliases or incorrect filenames)
- [ ] `useEffect` missing dependency arrays
- [ ] Event handlers missing proper typing
- [ ] Map components not cleaning up on unmount
- [ ] PWA manifest missing required fields
- [ ] Capacitor config problems affecting APK builds
- [ ] Components returning inconsistent state shapes

---

## General / Project Infrastructure

- [ ] `.env.example` missing required keys
- [ ] `docker-compose.yml` service dependency ordering issues
- [ ] Alembic migration chain broken
- [ ] `requirements/*.txt` missing imported packages
- [ ] Environment configuration mismatches
- [ ] Build scripts referencing missing files
- [ ] Dependency version conflicts

---

# Fix Report Format

After all fixes are applied, return a structured report using the following format.

---


### Bug Report Format

When `/bug-fix` completes, Claude returns a report in this format:

```
═══════════════════════════════════════
  PARK & GO V2 — BUG FIX REPORT
═══════════════════════════════════════

✅ FIXED (N bugs)
───────────────
[BUG-001] FILE: backend/app/api/deps.py
  PROBLEM: JWT decode exception not caught — would crash on malformed tokens
  FIX:     Wrapped decode_access_token() in try/except, raises 401

[BUG-002] FILE: backend/app/schemas/user.py
  PROBLEM: Missing model_config on UserResponse — ORM objects can't serialize
  FIX:     Added model_config = {"from_attributes": True}

... (all fixed bugs listed)

⚠️ FOUND BUT NOT AUTO-FIXED (N issues)
───────────────────────────────────────
These require human decisions before fixing:

[WARN-001] FILE: backend/app/main.py
  ISSUE:  CORS allows all origins (*) — needs specific domain before prod deploy
  ACTION: Update allow_origins with your production domain

... (warnings listed)

✔️ CLEAN — No issues found in:
  backend/app/core/config.py
  backend/app/models/base.py
  backend/app/services/recommendation_engine.py
  ... (clean files listed)

═══════════════════════════════════════
  SUMMARY
  Fixed:    N bugs
  Warnings: N items needing review  
  Clean:    N files
═══════════════════════════════════════
```

---

---

## /bug-fix-frontend

---
**What it does:**
Runs a bug audit of **frontend only** (`frontend/src/`). Does not touch the backend.
Finds bugs, fixes them directly in the code, and returns a structured bug report.

**How to trigger:**
Type `/bug-fix-frontend` in the chat.

### What to check (frontend only)

- [ ] Missing TypeScript types or excessive `any`
- [ ] TanStack Query keys not unique or mismatched
- [ ] Missing error states in data fetching hooks
- [ ] Missing loading states / skeleton screens
- [ ] Zod schema mismatches with API response shapes
- [ ] Zustand store actions not matching state shape
- [ ] React Hook Form fields not registered properly
- [ ] Broken imports (path aliases or incorrect filenames)
- [ ] `useEffect` missing dependency arrays
- [ ] Event handlers missing proper typing
- [ ] Map components not cleaning up on unmount
- [ ] Components returning inconsistent state shapes

### Rules
- Do **not** touch any file in `backend/`
- Same fix rules as `/bug-fix` — no partial fixes, no suggestions, direct edits only
- Return the same structured bug report format

---

## Other Planned Commands

| Command | Description | Status |
|---|---|---|
| `/bug-fix` | Full project bug audit + auto-fix (backend + frontend) | ✅ Active |
| `/bug-fix-frontend` | Frontend-only bug audit + auto-fix | ✅ Active |
| `/add-endpoint <name>` | Scaffold new FastAPI route + schema + repo method | 🔜 Planned |
| `/add-feature <name>` | Scaffold new React feature folder with hooks + components | 🔜 Planned |
| `/score-test <spot_data>` | Run recommendation engine against a sample spot and show score breakdown | 🔜 Planned |
| `/migration` | Generate and apply Alembic migration for pending model changes | 🔜 Planned |
| `/seed` | Seed the database with sample UMN parking spots | 🔜 Planned |

---

## Notes for Claude

When `/bug-fix` is triggered:

1. Read `MEMORY.md` first to understand the project conventions
2. Scan every file in `backend/app/` and `frontend/src/`
3. Cross-reference models ↔ schemas ↔ repositories ↔ routes for consistency
4. Pay special attention to the known quirks listed in `MEMORY.md`:
   - `prefered_name` (single r) typo must be preserved
   - `spot_id` is the PK for ParkingSpot (not `id`)
   - All DB ops must be async
   - `flush()` in repos, not `commit()`
5. Fix what can be safely auto-fixed
6. Flag anything that requires a human decision (e.g. config values, breaking schema changes)
7. Return the full structured bug report

