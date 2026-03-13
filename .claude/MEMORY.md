# Park & Go V2 — Project Memory
> Full-stack building guide. Read this before writing any code.

---

## 🗂 What This Project Is

**Park & Go V2** is a cross-platform parking recommendation app for University of Minnesota students. It helps them find the best parking spot near their classes based on cost, distance, preferences, major, and spot verification status.

- **Backend:** FastAPI (async) — migrated from Flask
- **Frontend:** React + TypeScript — migrated from vanilla JS
- **Mobile:** PWA + Android APK via Capacitor
- **Target users:** UMN students parking near East Bank, West Bank, St. Paul campuses

---

## 🏗 Project Structure

```
parkandgo-v2/
├── backend/app/
│   ├── main.py                  # FastAPI entrypoint
│   ├── core/
│   │   ├── config.py            # Pydantic settings (env vars)
│   │   ├── database.py          # Async SQLAlchemy engine + session
│   │   ├── security.py          # JWT create/decode (HS256, 24hr expiry)
│   │   └── exceptions.py        # Custom exceptions
│   ├── models/                  # SQLAlchemy ORM models
│   │   ├── base.py              # TimestampMixin (created_at, updated_at)
│   │   ├── user.py              # User model
│   │   └── parking_spot.py      # ParkingSpot model
│   ├── schemas/                 # Pydantic request/response schemas
│   │   ├── user.py              # UserResponse, UserProfileUpdate
│   │   └── parking_spot.py      # ParkingSpotResponse, Create, Update
│   ├── repositories/            # Data access layer
│   │   ├── base.py              # BaseRepository (get_by_id, get_all, create)
│   │   └── parking_repository.py# search(), filter_spots()
│   ├── services/
│   │   ├── auth_service.py      # Google OAuth login flow
│   │   └── recommendation_engine.py  # Core scoring algorithm
│   └── api/
│       ├── deps.py              # get_current_user, get_optional_user
│       ├── auth.py              # /api/auth/google, /api/auth/me
│       ├── parking.py           # /api/parking/ CRUD + search + filter
│       ├── recommendations.py   # /api/recommendations/
│       └── users.py             # /api/users/me (PATCH)
└── frontend/src/
    ├── features/auth/           # Login, Register, ProtectedRoute
    ├── features/map/            # MapView, MarkerCluster, RouteLayer
    ├── features/search/         # SearchBar, Filters, Results
    ├── features/recommendations/# Cards, ScoreBreakdown, Skeletons
    ├── features/navigation/     # RouteDisplay, TurnByTurn, ETA
    ├── features/profile/        # UserProfile, Preferences, History
    ├── components/ui/           # Button, Card, Spinner, Toast, Skeleton
    └── components/layout/       # Sidebar, Header, MobileNav
```

---

## ⚙️ Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Framework | FastAPI (async) |
| Database | PostgreSQL + PostGIS |
| ORM | SQLAlchemy 2.0 (async) |
| Migrations | Alembic |
| Caching | Redis |
| Auth | Google OAuth2 + JWT (HS256) |
| Validation | Pydantic v2 |
| Task Queue | Celery / RQ |
| Monitoring | Prometheus + Grafana |
| Testing | Pytest + pytest-asyncio |

### Frontend
| Layer | Technology |
|---|---|
| Core | React 18, TypeScript |
| Build | Vite |
| Styling | Tailwind CSS + clsx |
| Server State | TanStack Query (React Query) |
| Forms | React Hook Form + Zod |
| Global State | Zustand |
| Maps | Leaflet or Mapbox GL |
| PWA | Vite PWA plugin |
| Mobile | Capacitor (APK) |
| Testing | Vitest, React Testing Library, Playwright |

---

## 🔐 Auth Flow

1. Frontend gets a Google `access_token` via Google Sign-In SDK
2. Sends it to `POST /api/auth/google` with `{ access_token: "..." }`
3. Backend calls Google's userinfo endpoint to verify the token
4. Creates or fetches the `User` record by `google_id`
5. Returns `{ access_token, token_type: "bearer", user }`
6. Frontend stores the JWT and sends it as `Authorization: Bearer <token>` on all subsequent requests
7. `get_current_user` dependency in `deps.py` decodes the JWT and fetches the user on every protected route

**JWT config:** 24-hour expiry, HS256, `user_id` in payload, secret from `settings.secret_key`

---

## 🗄 Database Models

### User (`users` table)
```
user_id         PK, int, autoincrement
google_id       str(255), unique
email           str(255), unique
profile_pic     str(500)
first_name      str(100), NOT NULL
last_name       str(100), NOT NULL
prefered_name   str(100), NOT NULL   ← note: intentional typo in DB
preferred_parking_types  str(250)    ← comma-separated, e.g. "Parking Garage,Street"
major           str(100)
major_category  str(100)             ← "STEM", "Business", "Liberal Arts", etc.
grade_level     str(100)
graduation_year int
housing_type    str(50)
created_at      timestamp (server default)
updated_at      timestamp (auto-update)
```

### ParkingSpot (`parking_spots` table)
```
spot_id         PK, int, autoincrement
spot_name       str(100), NOT NULL
campus_location str(100), NOT NULL   ← "East Bank", "West Bank", "St. Paul"
parking_type    str(100), NOT NULL   ← "Parking Garage", "Surface Lot", "Street Parking"
cost            float, NOT NULL      ← hourly cost in USD
walk_time       str(100)             ← e.g. "5 min walk"
near_buildings  Text                 ← comma-separated building names
address         str(255), NOT NULL
latitude        float
longitude       float
is_verified     bool, default=False
created_at      timestamp
updated_at      timestamp
```

---

## 🧠 Recommendation Engine

**File:** `backend/app/services/recommendation_engine.py`

Scores every parking spot 0–100 and returns the top N ranked results.

### Scoring Weights
| Factor | Max Points | Logic |
|---|---|---|
| Cost | 40 | `(5.0 - cost) / 5.0 * 40` — $0 = 40pts, $5+ = 0pts |
| Distance | 25 | Haversine distance. ≤0.1mi = 25pts, ≥2mi = 0pts. No location = 12.5pts |
| Preferences | 15 | Full 15 if spot type matches user's `preferred_parking_types` |
| Major | 10 | Full 10 if spot's campus matches user's major category campus |
| Verified | 10 | Full 10 if `is_verified = True` |

### Major → Campus Map
```python
MAJOR_CAMPUS_MAP = {
    "STEM": "East Bank",
    "Business": "East Bank",
    "Liberal Arts": "East Bank",
    "Social Science": "West Bank",
    "Arts": "West Bank",
}
```

### API
`GET /api/recommendations/?user_lat=44.97&user_lon=-93.23&limit=3`
Returns: `[{ spot, score, score_breakdown }]`

---

## 🌐 API Endpoints

### Auth
```
POST /api/auth/google     → { access_token, token_type, user }
GET  /api/auth/me         → UserResponse  (requires Bearer token)
```

### Parking
```
GET  /api/parking/                          → list[ParkingSpotResponse]
GET  /api/parking/search?q=oak              → list[ParkingSpotResponse]
GET  /api/parking/filter?campus=East+Bank&parking_type=Ramp&max_cost=2.50
POST /api/parking/                          → ParkingSpotResponse (201)
```

### Recommendations
```
GET  /api/recommendations/?user_lat=&user_lon=&limit=3  → list[RecommendationResponse]
     (requires Bearer token)
```

### Users
```
PATCH /api/users/me   body: UserProfileUpdate  → UserResponse
      (requires Bearer token)
```

---

## 🎨 UI Design System

**Color tokens (CSS variables):**
```css
--maroon: #7A0019        /* Primary — UMN Maroon */
--maroon-h: #91253b      /* Hover state */
--maroon-lt: rgba(122,0,25,0.08)   /* Light bg tint */
--gold: #FFCC33          /* Secondary — UMN Gold */
--gold-dk: #c9a200       /* Dark gold for text */
--green: #34c759         /* Available / free */
--amber: #ff9500         /* Mid-price warning */
--red: #ff3b30           /* Expensive / danger */
--blue: #007aff          /* Navigation / directions */
```

**Typography:** Inter font family, system-ui fallback

**Border radius:** `--r: 16px` (cards), `--rs: 10px` (small), `--rp: 100px` (pills/chips)

**Design philosophy:**
- Mobile: Google Maps style — bottom sheet with pull-up, sticky map, floating search bar
- Desktop: Apple Maps style — frosted glass sidebar, map fills remaining space, floating detail card
- Both: UMN Maroon (#7A0019) + Gold (#FFCC33) brand colors throughout

---

## 📱 Mobile UX Patterns

- **Bottom sheet** with drag handle for spot list and events
- **Tabbed sheet:** "🅿️ Suggested Spots" | "🎉 Local Events" (V2.5 feature)
- **Collapsible filters** row (See filters / Hide filters toggle)
- **Horizontal scroll** card list for spot recommendations
- **Full-screen settings** as a pull-up modal over blurred map
- **Active navigation view** with maroon header bar, turn-by-turn, stats grid
- Touch targets minimum 44×44px
- Pull-to-refresh on mobile views

---

## 🖥 Desktop UX Patterns

- **Sidebar (340px):** frosted glass, user row with gear icon, filter pills, cost slider, tabbed list
- **Map area:** fills remaining width, floating control buttons, map pill filters in top bar
- **Detail card:** floats at bottom of map on spot selection, "see details" expands score breakdown
- **Settings modal:** centered overlay with blur backdrop, saved spots inline list with edit/delete

---

## 🔧 Configuration & Environment

**Required `.env` variables:**
```
DATABASE_URL=postgresql+asyncpg://user:pass@localhost/parkandgo
SECRET_KEY=your-secret-key-here
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-secret
REDIS_URL=redis://localhost:6379
ENVIRONMENT=development
DEBUG=true
```

**`config.py`** uses `pydantic_settings.BaseSettings` — reads from `.env` automatically.
Properties: `is_development`, `is_production`, `is_testing`

---

## 🚀 Running the App

```bash
# Backend
cd backend
pip install -r requirements/dev.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Frontend
cd frontend
npm install
npm run dev        # Vite dev server on :3000

# Full stack (Docker)
docker-compose up
```

**CORS:** Backend allows `http://localhost:3000` in development.

---

## 📦 Dependency Injection Pattern

Every route that needs DB or auth uses FastAPI `Depends()`:

```python
# Get DB session
db: AsyncSession = Depends(get_db)

# Get current authenticated user (raises 401 if invalid)
user: User = Depends(get_current_user)

# Get user if logged in, None if not (no error)
user: User | None = Depends(get_optional_user)
```

`get_db()` auto-commits on success, auto-rollbacks on exception.

---

## 🗺 Repository Pattern

All DB queries go through repositories, never directly in routes.

```python
# Example usage in a route
repo = ParkingRepository(db)
spots = await repo.get_all()
spot = await repo.get_by_id(1)
results = await repo.search("oak")
filtered = await repo.filter_spots(campus="East Bank", max_cost=2.00)
new_spot = await repo.create(spot_data.model_dump())
```

`BaseRepository` provides `get_by_id`, `get_all`, `create`.
`ParkingRepository` adds `search` (ilike across 4 fields) and `filter_spots`.

---

## 📋 V2 Roadmap

| Quarter | Goal |
|---|---|
| Q1 2026 | Backend: FastAPI migration, PostGIS schema, Redis, auth + parking APIs |
| Q2 2026 | Frontend: React/TS rebuild, Tailwind UI, map integration, recommendation v1 |
| Q3 2026 | Loading states, responsive design, PWA config, internal APK builds |
| Q4 2026 | Perf optimization, load testing (3k+ users), friend group testing, polish |
| V2.5 | Security hardening, data encryption, Events on Campus tab |

---

## ⚠️ Known Quirks / Watch Out For

1. **`prefered_name`** — intentional typo in the DB column (single 'r'). Match it exactly in all schemas and models.
2. **`spot_id` vs `id`** — ParkingSpot PK is `spot_id`, not `id`. `ParkingRepository` overrides `get_by_id` to use `spot_id`.
3. **Async everywhere** — all DB calls must be `await`ed. Use `AsyncSession`, never sync `Session`.
4. **`session.flush()` not `commit()`** in repositories — commit happens in `get_db()` context manager.
5. **`preferred_parking_types`** is a comma-separated string, not a JSON array. Split with `.split(",")` and `.strip()`.
6. **Cost scoring clamp** — anything ≥ $5.00 scores 0 on cost. This is intentional.
7. **Distance fallback** — if no user coordinates provided, distance score defaults to 12.5 (half credit).
8. **CORS** — currently only allows `localhost:3000`. Update `allow_origins` in `main.py` before deploying.

---

## 🧩 Adding New Features — Checklist

When adding a new feature:
- [ ] Add SQLAlchemy model in `models/`
- [ ] Add Alembic migration (`alembic revision --autogenerate`)
- [ ] Add Pydantic schemas in `schemas/`
- [ ] Add repository methods in `repositories/`
- [ ] Add service logic in `services/`
- [ ] Add API router in `api/` and register in `main.py`
- [ ] Add React feature folder in `frontend/src/features/`
- [ ] Add TanStack Query hook for data fetching
- [ ] Add loading skeleton component for async states
- [ ] Add Zod schema for form validation

# Complete Phase Roadmap — Park & Go V2

---

# BACKEND PHASES

## Phase 1 — Core Backend Hardening ✅ COMPLETE

**Phase 1.a.1** — `app/api/parking.py`
Add auth dependency to POST route

**Phase 1.a.2** — `app/models/parking_spot.py` + `app/api/parking.py`
Add submitted_by column, force is_verified=False server-side

**Phase 1.a.3** — `app/utils/__init__.py` + `app/utils/geo.py`
Coordinate bounding box validator for UMN East Bank, West Bank, St. Paul campuses

**Phase 1.a.4** — `app/models/user.py` + `app/api/deps.py` + `app/api/admin.py` + `app/main.py`
Add is_admin to User model, build get_admin_user dependency, create verify spot route, register router

---

## Phase 2 — Database Migrations ✅ COMPLETE

**Phase 2.a** — `backend/requirements/base.txt` + terminal
Add alembic and psycopg2-binary to requirements, install dependencies

**Phase 2.b** — `alembic/env.py`
Import all models and Base, set sync database URL, point target_metadata at Base.metadata

**Phase 2.c** — `alembic/env.py`
Handle async driver swap from asyncpg to psycopg2 for migration runs

**Phase 2.d** — terminal
Generate first migration capturing all current models including is_admin and submitted_by

**Phase 2.e** — terminal
Apply migration with upgrade head, verify tables in Neon DB

---

## Phase 3 — Saved Spots Feature ✅ COMPLETE

**Phase 3.a** — `app/models/saved_spot.py`
Build SavedSpot model with user_id, spot_id, custom_name, UniqueConstraint on user+spot combination

**Phase 3.b** — `app/repositories/saved_spot_repository.py`
Build repository with get_by_user, get_by_user_and_spot, rename, delete methods

**Phase 3.c** — `app/schemas/saved_spot.py`
SavedSpotCreate, SavedSpotRename, SavedSpotResponse schemas with nested ParkingSpotResponse

**Phase 3.d** — `app/api/users.py`
Add GET, POST, DELETE, PATCH routes under /users/me/saved with 409 on duplicate save

**Phase 3.e** — `alembic/env.py` + terminal
Import saved_spot model in env.py, generate and apply migration for saved_spots table

---

## Phase 4 — Campus Events Feature

**Phase 4.a** — `app/models/app_config.py`
Build AppConfig model as a key-value settings table. Stores event_sync_enabled, event_sync_last_run, event_sync_interval_days. This is what the admin dashboard will read and write later to control the sync without touching code

**Phase 4.b** — `app/models/campus_event.py`
Build CampusEvent model with event_id, title, location_name, latitude, longitude, starts_at, ends_at, category, source_url, external_id. Add index on starts_at for fast cleanup queries

**Phase 4.c** — `app/repositories/app_config_repository.py`
Build repository with get_value, set_value, get_all methods. Used by the scheduler to check if sync is enabled before running

**Phase 4.d** — `app/repositories/event_repository.py`
Build repository with get_upcoming, get_by_category, delete_older_than methods. delete_older_than is what the cleanup job calls

**Phase 4.e** — `app/schemas/campus_event.py`
CampusEventResponse schema with all fields. No create schema needed since events only come from the iCal fetcher not from user input

**Phase 4.f** — `backend/requirements/base.txt` + terminal
Add icalendar and apscheduler to requirements.txt and install

**Phase 4.g** — `app/services/event_sync_service.py`
Build the iCal fetcher service. Define your UMN iCal URLs mapped to your 5 categories. Fetch each feed, parse events with the icalendar library, map to your category names, return a list of cleaned event dicts ready to insert

Your category to iCal URL mapping:
- Sports → Athletics, Sports, and Recreation feed
- Student Life → Student Life feed + Campus Affairs feed
- Academics → Academics, Research, and Education feed + Professional Development feed
- STEM → Science, Engineering, and Technology feed + Artificial Intelligence feed
- Arts → Arts, Culture, Architecture, and Design feed + Exhibition feed

**Phase 4.h** — `app/services/event_sync_service.py`
Add the cleanup function inside the same service file. Query all events where starts_at is older than 24 hours and delete them. This runs as part of every sync job

**Phase 4.i** — `app/tasks/scheduler.py`
Build the APScheduler setup. Create a scheduler instance, register two jobs — the weekly event sync and the daily cleanup. Before the sync job runs it checks app_config for event_sync_enabled. If false it logs that sync is paused and returns early without fetching anything

**Phase 4.j** — `app/main.py`
Start the scheduler when FastAPI starts using a lifespan event handler. Shutdown the scheduler cleanly when FastAPI stops. This keeps the scheduler tied to your Render service lifecycle

**Phase 4.k** — `app/api/events.py`
Build GET /events route with optional category filter query param. Build GET /events/{event_id} for single event detail. No POST needed since events come from iCal only

**Phase 4.l** — `app/main.py`
Register events router

**Phase 4.m** — `alembic/env.py` + terminal
Import campus_event and app_config models in env.py, generate migration, apply with upgrade head

---

## Phase 5 — Redis Caching + Cache Invalidation

**Phase 5.a** — `backend/requirements/base.txt` + terminal
Add redis to requirements.txt and install

**Phase 5.b** — `app/core/caching.py`
Build async Redis client using redis.asyncio. Connection helper function that initializes once and reuses the connection. Uses redis_url from your settings which already exists in config.py

**Phase 5.c** — `app/core/config.py`
Verify redis_url is in Settings. Already there from Phase 1 setup but confirm it reads from your .env file

**Phase 5.d** — `app/api/recommendations.py`
Add cache check at the top of the recommendations route before hitting the database. Build cache key from user_id, lat, lon. If cache hit return immediately. If cache miss run the engine then store result with 5 minute TTL. 5 minutes matches how often parking data realistically changes

**Phase 5.e** — `app/api/recommendations.py`
Add cache invalidation helper function. Takes a Redis client and a pattern string. Finds all matching keys and deletes them

**Phase 5.f** — `app/api/admin.py`
Call cache invalidation after a spot gets verified. Verified status affects recommendation scores so cached results are now stale

**Phase 5.g** — `app/api/parking.py`
Call cache invalidation after a new spot is submitted. New spots should appear in recommendations immediately not after the cache expires

---

## Phase 6 — Recommendation Engine Improvements

**Phase 6.a** — `app/services/recommendation_engine.py`
Add walk time scoring as a tiebreaker. Parse the walk_time string field into minutes and use it to slightly adjust the distance score when two spots are otherwise equal

**Phase 6.b** — `app/services/recommendation_engine.py`
Add event-aware scoring. If an event_id is passed in, fetch that event's coordinates and boost spots that are geographically close to the event location. A spot near a hockey game venue should score higher when the user is attending that game

**Phase 6.c** — `app/api/recommendations.py`
Accept optional event_id query param. If provided fetch the event from the database and pass its coordinates into the engine as a scoring factor

---

## Phase 7 — Security Hardening

**Phase 7.a** — `app/core/security.py`
Add refresh token creation function alongside the existing access token function. Refresh tokens have a longer expiry, 7 days vs 24 hours

**Phase 7.b** — `app/schemas/user.py`
Add refresh token fields to TokenResponse schema

**Phase 7.c** — `app/api/auth.py`
Add POST /auth/refresh endpoint. Accepts a refresh token, validates it, returns a new access token. This keeps users logged in without re-authenticating with Google every 24 hours

**Phase 7.d** — `app/main.py`
Add slowapi rate limiting middleware. Limit POST /parking to 5 requests per minute per user to prevent spam spot submissions. Limit POST /auth/google to 10 requests per minute per IP to prevent auth abuse

**Phase 7.e** — `backend/requirements/base.txt` + terminal
Add slowapi to requirements.txt and install

---

---

# FRONTEND PHASES

## Phase 8 — Project Scaffold

**Phase 8.a** — terminal
Run npm create vite@latest frontend -- --template react-ts. Install all dependencies: @tanstack/react-query, zustand, react-hook-form, zod, axios, maplibre-gl, react-map-gl

**Phase 8.b** — `frontend/tailwind.config.ts` + `frontend/src/styles/index.css` + `frontend/src/styles/variables.css`
Set up Tailwind. Translate every CSS variable from your HTML prototype into Tailwind theme tokens. maroon, gold, text colors, border colors, shadow tokens all become first class Tailwind classes

**Phase 8.c** — `frontend/src/` folder structure
Create all feature folders manually: auth, map, search, recommendations, navigation, profile, events. Create components/ui and components/layout folders. Create lib/api, lib/map, lib/utils folders. Create hooks, store, types, services folders

---

## Phase 9 — API Client + Types

**Phase 9.a** — `frontend/src/lib/api/client.ts`
Axios instance with base URL from env variable. Request interceptor reads token from localStorage and attaches as Bearer header automatically on every request

**Phase 9.b** — `frontend/src/lib/api/endpoints.ts`
All API endpoint constants as a typed const object. Every FastAPI route has a matching constant here so you never hardcode URL strings in components

**Phase 9.c** — `frontend/src/types/user.types.ts`
TypeScript interfaces for User and UserProfileUpdate matching your backend schemas exactly

**Phase 9.d** — `frontend/src/types/parking.types.ts`
TypeScript interfaces for ParkingSpot, ParkingSpotCreate, filters

**Phase 9.e** — `frontend/src/types/recommendation.types.ts`
TypeScript interfaces for RecommendationResponse and ScoreBreakdown

**Phase 9.f** — `frontend/src/types/campus_event.types.ts`
TypeScript interfaces for CampusEvent with your 5 category types as a union type

**Phase 9.g** — `frontend/src/types/saved_spot.types.ts`
TypeScript interfaces for SavedSpot and SavedSpotRename

**Phase 9.h** — `frontend/src/types/common.types.ts`
Shared types like ApiError, PaginatedResponse, LoadingState

---

## Phase 10 — Auth

**Phase 10.a** — `frontend/src/store/authStore.ts`
Zustand store with user, token, setAuth, clearAuth, isAuthenticated. setAuth writes token to localStorage. clearAuth removes it. Store initializes token from localStorage on load so refresh doesn't log user out

**Phase 10.b** — `frontend/src/features/auth/services/authApi.ts`
loginWithGoogle function posting google access token to /auth/google. getMe function fetching current user from /auth/me. refreshToken function for the refresh flow

**Phase 10.c** — `frontend/src/features/auth/components/LoginForm.tsx`
Google login button component. On click opens Google OAuth popup, receives access token, calls loginWithGoogle, stores result in authStore, redirects to main app

**Phase 10.d** — `frontend/src/features/auth/components/ProtectedRoute.tsx`
Wrapper component that reads isAuthenticated from authStore. If false redirects to login page. Wraps all routes that require auth

**Phase 10.e** — `frontend/src/app/routes.tsx`
All route definitions using react-router-dom. Public routes: login. Protected routes: everything else wrapped in ProtectedRoute

**Phase 10.f** — `frontend/src/app/providers.tsx`
Wrap the app in QueryClientProvider for TanStack Query. Add any other global providers here

---

## Phase 11 — Atomic UI Components

**Phase 11.a** — `frontend/src/components/ui/Button.tsx`
Primary, secondary, ghost variants. Size sm, md, lg. Loading state swaps children for Spinner. Disabled state. Uses your maroon and gold Tailwind tokens

**Phase 11.b** — `frontend/src/components/ui/Spinner.tsx`
Animated loading spinner in three sizes. Used inside Button and anywhere async work is happening

**Phase 11.c** — `frontend/src/components/ui/Skeleton.tsx`
Animated gray placeholder block. Accepts width, height, borderRadius props. Used to build loading states that match the shape of real content

**Phase 11.d** — `frontend/src/components/ui/Card.tsx`
Base card wrapper with consistent border, shadow, border-radius from your prototype. Accepts className for overrides. Everything card-shaped in the app uses this as its base

**Phase 11.e** — `frontend/src/components/ui/Input.tsx`
Text input with label, placeholder, error message, consistent focus ring in maroon

**Phase 11.f** — `frontend/src/components/ui/Toast.tsx`
Success and error notification that slides in from the bottom and auto-dismisses after 3 seconds. Toast state lives in uiStore

**Phase 11.g** — `frontend/src/components/ui/Modal.tsx`
Generic modal overlay with backdrop blur matching your prototype's settings sheet style. Accepts title, children, onClose props

**Phase 11.h** — `frontend/src/components/ui/Badge.tsx`
Small colored label for categories, verified status, price. Matches the chip and badge styles throughout your prototype

---

## Phase 12 — Layout Components

**Phase 12.a** — `frontend/src/components/layout/Header.tsx`
Top search bar with gear icon, search input, user avatar. Matches the gm-bar style from your mobile prototype. On desktop becomes part of the sidebar instead

**Phase 12.b** — `frontend/src/components/layout/MobileNav.tsx`
Bottom sheet with drag handle, Spots and Events tab switcher. Contains the scrollable spot cards and filter section. The main mobile UI shell

**Phase 12.c** — `frontend/src/components/layout/Sidebar.tsx`
Desktop sidebar with frosted glass background. Contains search bar, user row with settings gear, filter pills, cost slider, tab switcher, results list, suggest a spot button at bottom

**Phase 12.d** — `frontend/src/components/layout/ResponsiveContainer.tsx`
Uses useMediaQuery hook to detect screen size. Renders MobileNav layout below 768px and Sidebar layout above. This is the single component that controls which layout the user sees

**Phase 12.e** — `frontend/src/hooks/useMediaQuery.ts`
Custom hook that takes a media query string and returns a boolean. Used by ResponsiveContainer and anywhere else layout decisions are made

---

## Phase 13 — Recommendations Feature

**Phase 13.a** — `frontend/src/services/queryClient.ts`
TanStack Query client configured with 5 minute stale time to match your Redis TTL on the backend. Retry twice on failure

**Phase 13.b** — `frontend/src/features/recommendations/services/recommendationApi.ts`
getRecommendations function accepting optional lat, lon, limit params. Calls your /recommendations endpoint and returns typed RecommendationResponse array

**Phase 13.c** — `frontend/src/features/recommendations/hooks/useRecommendations.ts`
TanStack Query hook wrapping getRecommendations. Query key includes lat and lon so it refetches automatically when location changes. Returns data, isLoading, error

**Phase 13.d** — `frontend/src/features/recommendations/components/ScoreBreakdown.tsx`
Bar chart rows for cost, distance, preferences, major, verified. Each bar fills proportionally based on score vs max weight. Matches the breakdown bars in your prototype exactly

**Phase 13.e** — `frontend/src/features/recommendations/components/RecommendationCard.tsx`
Full card showing spot name, campus, type, price badge, distance, total score. Collapsible ScoreBreakdown section toggled by see details button. Top ranked card gets special maroon border treatment

**Phase 13.f** — `frontend/src/features/recommendations/components/LoadingSkeleton.tsx`
Three skeleton cards matching the exact dimensions of RecommendationCard. Shown while useRecommendations isLoading is true

**Phase 13.g** — `frontend/src/features/recommendations/components/RecommendationList.tsx`
Maps over recommendations data rendering RecommendationCard for each. Renders LoadingSkeleton while loading. Renders error message if fetch failed. Renders empty state if no spots found

---

## Phase 14 — Map Feature

**Phase 14.a** — `frontend/src/features/map/components/MapView.tsx` + `frontend/src/store/uiStore.ts`
Install maplibre-gl. Build base MapView component centered on UMN coordinates. Add 2D/3D toggle button that reads from uiStore. 2D is standard flat view. 3D enables pitch and building extrusions. Toggle state persists in Zustand so it survives re-renders

**Phase 14.b** — `frontend/src/features/map/components/MapView.tsx`
Add parking spot markers from recommendations data. Each marker positioned at spot latitude and longitude

**Phase 14.c** — `frontend/src/lib/map/markerManager.ts`
Custom price pin markers as HTML elements styled to match your prototype gpin class. Green dot for cheap, amber for mid, red for expensive. Selected spot gets maroon background treatment

**Phase 14.d** — `frontend/src/features/map/components/MapControls.tsx`
Zoom in, zoom out, and locate me buttons overlaid on the map. Locate me button triggers browser geolocation and flies the map to user position

**Phase 14.e** — `frontend/src/lib/map/boundsHelper.ts`
Helper functions for fitting the map viewport to show all markers. Used when results load to auto-zoom to the right area of campus

---

## Phase 15 — Navigation Feature

**Phase 15.a** — `frontend/src/features/map/components/RouteLayer.tsx`
Draw a route line on the MapLibre map from user location to selected spot coordinates. Line styled in maroon matching your prototype nav route

**Phase 15.b** — `frontend/src/features/navigation/components/RouteDisplay.tsx`
Bottom sheet showing distance remaining, ETA in minutes, arrival time. Matches your active navigation prototype screen exactly with the three stat boxes

**Phase 15.c** — `frontend/src/features/navigation/components/TurnByTurn.tsx`
Direction instruction bar fixed to top of screen during navigation. Shows turn direction icon, street name, distance to turn. Maroon background matching prototype

**Phase 15.d** — `frontend/src/features/navigation/components/ETAIndicator.tsx`
Live updating ETA box. Recalculates as user location updates via browser geolocation watch

**Phase 15 (enhanced)** — Real turn-by-turn directions via OSRM public API. routingApi.ts fetches routed polyline + step-by-step maneuvers. navStore holds current step index. ETAIndicator auto-advances steps within 80ft of each turn. TurnByTurn bar reads live step data.
---

## Phase 16 — Search + Filters

**Phase 16.a** — `frontend/src/hooks/useDebounce.ts`
Custom hook that delays a value update by N milliseconds. Prevents search from firing on every keystroke

**Phase 16.b** — `frontend/src/features/search/components/SearchBar.tsx`
Search input using useDebounce. Calls /parking/search endpoint after user stops typing for 300ms

**Phase 16.c** — `frontend/src/features/search/hooks/useSearch.ts`
TanStack Query hook for the search endpoint. Disabled when query is empty so it doesn't fire on mount

**Phase 16.d** — `frontend/src/features/search/components/SearchFilters.tsx`
Parking type chip row, campus chip row, cost slider. Each filter updates a local filter state object. Matches the filter expand panel from your prototype

**Phase 16.e** — `frontend/src/features/search/hooks/useDebouncedSearch.ts`
Combines search term and filter state into one query. Calls /parking/filter when filters are active, /parking/search when text query is active

**Phase 16.f** — `frontend/src/features/search/components/SearchResults.tsx`
Results list below search bar. Reuses RecommendationCard component. Shows result count badge matching prototype gbs-badge style

---

## Phase 17 — Profile + Saved Spots

**Phase 17.a** — `frontend/src/features/profile/services/profileApi.ts`
API functions for updateProfile, getSavedSpots, saveSpot, unsaveSpot, renameSpot. All call your /users/me routes

**Phase 17.b** — `frontend/src/features/profile/components/UserProfile.tsx`
Editable form for preferred name, major, grade level, graduation year, housing type, preferred parking types. Uses react-hook-form with zod validation. On submit calls updateProfile

**Phase 17.c** — `frontend/src/features/profile/components/Preferences.tsx`
Toggle switches for notifications, location access, verified spots only, dark mode. Toggle states live in uiStore

**Phase 17.d** — `frontend/src/features/profile/components/SavedSpotsList.tsx`
List of saved spots with custom name display, edit rename button, delete button. Matches the saved spots section inside your prototype settings sheet

---

## Phase 18 — Events Frontend

**Phase 18.a** — `frontend/src/features/events/services/eventsApi.ts`
getEvents function with optional category filter param. getEventById function for single event detail

**Phase 18.b** — `frontend/src/features/events/hooks/useEvents.ts`
TanStack Query hook for events list. Query key includes category filter so it refetches when category changes

**Phase 18.c** — `frontend/src/features/events/components/EventCard.tsx`
Card with date block, event title, location, time, category badge, Map button and Reminder button. Pinned events get maroon border. Matches your prototype ev-item style exactly

**Phase 18.d** — `frontend/src/features/events/components/EventList.tsx`
Category filter chips at top. Scrollable list of EventCards below. Empty state when no events match filter

**Phase 18.e** — `frontend/src/features/map/components/MapView.tsx`
Add event pin markers when Events tab is active. Event pins styled differently from parking pins. Gold for academic, blue for sports, matching your prototype event pin colors

---

## Phase 19 — Settings UI

**Phase 19.a** — `frontend/src/store/uiStore.ts`
Zustand store for dark mode toggle, settings modal open/closed state, active tab state for Spots vs Events, 2D vs 3D map toggle

**Phase 19.b** — `frontend/src/features/profile/components/SettingsModal.tsx`
Full settings sheet with account section, saved spots list, preferences toggles, sign out button. On mobile renders as bottom sheet. On desktop renders as centered modal overlay. Matches both your mobile and desktop prototype settings screens

---

## Phase 20 — PWA + Mobile Build

**Phase 20.a** — `frontend/vite.config.ts` + `backend/requirements/base.txt`
Install vite-plugin-pwa. Configure manifest with Park and Go name, maroon theme color, standalone display mode

**Phase 20.b** — `frontend/public/manifest.json` + `frontend/public/icons/`
PWA manifest file and app icons in 192x192 and 512x512 sizes. Icons should use your maroon and gold color scheme

**Phase 20.c** — terminal + `frontend/capacitor.config.ts`
Install Capacitor and Capacitor Android. Initialize Android project. Configure app ID and app name

**Phase 20.d** — terminal
Build frontend with npm run build. Sync to Capacitor with npx cap sync. Open Android Studio with npx cap open android. Generate APK for internal distribution to friend group

---

## Phase 21 — Testing

**Phase 21.a** — `backend/tests/conftest.py`
Pytest fixtures for async test client, test database session, test user factory, test parking spot factory

**Phase 21.b** — `backend/tests/test_api/test_parking.py`
Test unauthenticated POST returns 401. Test out of bounds coordinates return 400. Test valid submission saves with is_verified=False. Test submitted_by is set to current user id

**Phase 21.c** — `backend/tests/test_api/test_recommendations.py`
Test recommendations require auth. Test response includes score and score_breakdown. Test limit param is respected. Test higher scored spots appear first

**Phase 21.d** — `backend/tests/test_services/test_recommendation_engine.py`
Unit test each scoring function in isolation. Test _score_cost with zero cost, mid cost, max cost. Test _score_verified with true and false. Test _score_preferences with matching and non-matching types

**Phase 21.e** — `backend/tests/test_api/test_saved_spots.py`
Test save spot returns 201. Test duplicate save returns 409. Test unsave returns 204. Test rename updates custom_name

**Phase 21.f** — `frontend/tests/unit/components/`
Vitest unit tests for Button loading state, ScoreBreakdown bar widths, RecommendationCard renders correct price

**Phase 21.g** — `frontend/tests/integration/recommendation-flow.test.tsx`
Mock the API, render RecommendationList, assert skeleton shows during load, assert cards render after data loads

---

## Phase 22 — Observability

**Phase 22.a** — `app/utils/metrics.py`
Prometheus metrics tracking recommendation endpoint latency, spot submission count per day, cache hit vs miss ratio

**Phase 22.b** — `app/main.py`
Mount Prometheus metrics endpoint at /metrics. Render can expose this for monitoring

**Phase 22.c** — `infrastructure/monitoring/prometheus.yml`
Prometheus scrape config pointing at your Render backend URL

**Phase 22.d** — `infrastructure/monitoring/grafana-dashboards/parking.json`
Grafana dashboard showing recommendation latency over time, daily spot submissions, cache hit rate, active users

---

## Phase 23 — Admin Dashboard (Capstone)

**Phase 23.a** — Backend: `app/api/admin.py`
Expand admin routes to cover everything the dashboard needs. GET /admin/spots/unverified returns all unverified spots. PATCH /admin/spots/{id}/verify verifies a spot. DELETE /admin/spots/{id} removes a bad submission. GET /admin/config returns all app_config key value pairs. PATCH /admin/config updates a config value including event_sync_enabled toggle

**Phase 23.b** — Backend: `app/api/admin.py`
GET /admin/events/sync triggers a manual event sync immediately regardless of schedule. GET /admin/stats returns submission counts, verified counts, active user count, cache hit rate for the dashboard overview panel

**Phase 23.c** — Frontend scaffold
Create a completely separate admin app or a protected /admin route in your existing frontend. Admin routes check is_admin on the current user and redirect if false

**Phase 23.d** — Frontend: admin spot management
Table of unverified spots showing submitted_by user, coordinates, campus, date submitted. Verify button and reject button per row. Map preview showing the submitted coordinates so you can visually confirm the spot is real before verifying

**Phase 23.e** — Frontend: event sync control panel
Toggle switch for event_sync_enabled that writes to app_config via the API. Shows event_sync_last_run timestamp. Manual sync now button. Table of current events in database with category and expiry time

**Phase 23.f** — Frontend: app config panel
Editable fields for all app_config values. event_sync_interval_days, any future config keys. Save button calls PATCH /admin/config

**Phase 23.g** — Frontend: stats overview
Cards showing total spots, verified spots, unverified spots, spots submitted today. Active users count. Cache hit rate percentage. Recommendation requests today. All pulling from GET /admin/stats

---

## Complete Phase Order

```
Phase 1  → Core backend hardening 
Phase 2  → Alembic migrations 
Phase 3  → Saved spots 
Phase 4  → Campus events + APScheduler + app config
Phase 5  → Redis caching + invalidation
Phase 6  → Recommendation engine improvements
Phase 7  → Security hardening
Phase 8  → Frontend scaffold + Tailwind
Phase 9  → API client + TypeScript types
Phase 10 → Auth + protected routes
Phase 11 → Atomic UI components
Phase 12 → Layout components
Phase 13 → Recommendations feature
Phase 14 → MapLibre map + 2D/3D toggle
Phase 15 → Navigation feature
Phase 16 → Search + filters
Phase 17 → Profile + saved spots UI
Phase 18 → Events frontend
Phase 19 → Settings UI
Phase 20 → PWA + Capacitor APK
Phase 21 → Testing
Phase 22 → Observability + Prometheus
Phase 23 → Admin dashboard (capstone)
```