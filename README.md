# Park & Go

> Smart parking finder for the University of Minnesota campus. Recommends spots based on your destination, event schedule, travel mode, and personal preferences.

> Shout out to Claude
---

## What It Does

Park & Go removes the guesswork from campus parking. Instead of driving around looking for a spot, you get a ranked list of recommended lots based on:

- **Cost** — cheapest spots score highest; anything ≥ $5.00 is ranked last
- **Travel time** — estimated drive/walk time to your destination
- **Your major** — prioritizes lots on your side of campus (East Bank vs. West Bank)
- **Parking type preference** — ramps, surface lots, or street parking
- **Live event awareness** — spots near active events get flagged
- **Verified data** — verified lots rank higher than unverified submissions

Guests can browse the map and see recommendations without signing in. Authenticated users get personalized scores and can save favorite spots.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (Python 3.11+), SQLAlchemy (async), PostgreSQL |
| Frontend | React 18 + TypeScript, Vite, TanStack Query, Zustand |
| Auth | Google OAuth 2.0 + JWT |
| Maps | MapLibre GL / OpenStreetMap |
| Routing | OSRM (open-source routing engine) |
| Mobile | Capacitor (iOS/Android wrapper) |
| Scheduling | APScheduler (event sync, background tasks) |
| Infra | Docker Compose |

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 15+
- Docker (optional, for full-stack)

### Backend

```bash
cd Backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements/dev.txt
cp .env.example .env            # fill in your values
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend

```bash
cd Frontend
npm install
cp .env.example .env            # fill in your values
npm run dev                     # runs on localhost:3000
```

### Full Stack (Docker)

```bash
docker-compose up
```

---

## Project Structure

```
parkandgo-v2/
├── Backend/
│   ├── app/
│   │   ├── api/                # Route handlers (auth, parking, events, recommendations, admin)
│   │   ├── core/               # Config, DB engine, security, caching, rate limiter
│   │   ├── models/             # SQLAlchemy models (User, ParkingSpot, CampusEvent, SavedSpot)
│   │   ├── repositories/       # All DB query logic (never in routes)
│   │   ├── schemas/            # Pydantic request/response schemas
│   │   ├── services/           # Business logic (auth, recommendation engine, event sync)
│   │   ├── task/               # APScheduler background tasks
│   │   └── utils/              # Geo math, iCal feed parsing, metrics
│   ├── requirements/
│   │   ├── base.txt
│   │   ├── dev.txt
│   │   ├── prod.txt
│   │   └── test.txt
│   └── tests/
│
├── Frontend/
│   └── src/
│       ├── features/
│       │   ├── auth/           # Google OAuth login
│       │   ├── map/            # MapLibre map view + route layer
│       │   ├── navigation/     # Turn-by-turn, ETA, route display
│       │   ├── parking/        # Parking spot cards, suggest-a-spot modal
│       │   ├── recommendation/ # Score cards, breakdown view
│       │   ├── search/         # Search bar, filters, debounced results
│       │   ├── profile/        # Saved spots, preferences, settings
│       │   ├── events/         # Event list synced from UMN iCal feeds
│       │   └── admin/          # Admin dashboard
│       ├── store/              # Zustand global state (nav, UI)
│       ├── lib/api/            # Axios client + endpoint constants
│       └── types/              # Shared TypeScript types
│
└── infrastructure/
    └── monitoring/
```

---

## API Reference

All routes are prefixed with `/api`. Protected routes require `Authorization: Bearer <jwt_token>`.

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/google` | — | Exchange Google OAuth token for JWT |
| GET | `/api/auth/me` | Bearer | Get current user profile |
| GET | `/api/parking/` | — | List all parking spots |
| GET | `/api/parking/search` | — | Full-text search spots |
| GET | `/api/parking/filter` | — | Filter by type, price, campus |
| GET | `/api/recommendations/` | Optional | Personalized spot recommendations |
| POST | `/api/recommendations/suggest` | Bearer | Submit a user-suggested spot |
| GET | `/api/events/` | — | List upcoming campus events |
| PATCH | `/api/users/me` | Bearer | Update preferences |
| GET | `/api/admin/` | Admin | Admin dashboard data |

---

## Recommendation Engine

The scoring engine lives in `Backend/app/services/recommendation_engine.py`. Every spot is scored out of **75 base points** (+ up to 15 event bonus):

| Factor | Points | Logic |
|---|---|---|
| Cost | 40 pts | Inverse of hourly rate. Free = max. ≥$5.00 = 0 pts |
| Travel time | 15 pts | OSRM estimated drive/walk time to destination |
| Preferences | 10 pts | Matches your saved parking type preference |
| Major/campus | 5 pts | Spot is on the same campus as your major |
| Verified | 5 pts | Verified spots score above unverified |
| Event proximity | +15 pts | Bonus if spot is near an active campus event |

Note: Distance is calculated and shown in the score breakdown UI, but travel time is what actually drives the ranking.

---

## Data Sources

| Source | What It Feeds | Status |
|---|---|---|
| UMN Parking & Transportation | Official lots, rates, types | Manual entry (8 lots) |
| UMN iCal feeds | Campus events (5 categories) | Live, synced daily |
| User submissions | Community-added spots | Active (unverified flag) |
| OpenStreetMap (Overpass) | Street parking, lot outlines | Planned |
| Minneapolis Open Data | Meters, permit zones | Planned |
| OpenWeatherMap | Weather impact on recommendations | Planned (V2.5) |

### Current Campus Lots (8 verified)

| Lot | Coordinates |
|---|---|
| Oak Street Ramp | 44.9739, -93.2312 |
| 19th Ave Meters | 44.9785, -93.2345 |
| Church Street Garage | 44.9763, -93.2343 |
| 4th St Ramp | 44.9806, -93.2355 |
| East River Road Garage | 44.9732, -93.2392 |
| Washington Ave Bridge Lot | 44.9729, -93.2435 |
| 21st Ave Ramp | 44.9708, -93.2421 |
| 19th Ave Ramp (West Bank) | 44.9719, -93.2443 |

---

## Design System

- **Primary:** `#7A0019` (UMN Maroon)
- **Secondary:** `#FFCC33` (UMN Gold)
- **Mobile layout:** Google Maps-style — map background, floating search bar, bottom sheet
- **Desktop layout:** Apple Maps-style — frosted glass sidebar (340px), map fills the rest
- **Touch targets:** 44×44px minimum on all interactive elements
- All colors are CSS variables in `Frontend/src/styles/variables.css`. Never hardcode hex values.

---

## Event Categories

Campus events are synced daily from UMN iCal feeds and mapped to these categories:

| Category | iCal Sources |
|---|---|
| Sports | Athletics, Sports, Recreation |
| Student Life | Student Life, Campus Affairs |
| Academics | Academics/Research, Professional Development |
| STEM | Science/Engineering, AI events |
| Arts | Arts/Culture, Exhibition |

Events affect recommendation scoring — spots near a large active event receive a proximity bonus.

---

## Development Rules

A few non-negotiables enforced across the codebase:

**Backend**
- All DB calls are `async/await` — no sync sessions
- Repositories handle all queries — nothing in route handlers
- `session.flush()` only inside repositories — `commit()` happens in `get_db()`
- New POST routes return `201`, not `200`

**Frontend**
- No `any` types — use `unknown` and narrow, or define a type
- All API calls go through TanStack Query hooks
- Every data-fetching component has loading and error states
- Forms use React Hook Form + Zod

**Known quirk:** The `prefered_name` field has one `r` — this is intentional (matches the DB column). Never "fix" this spelling.

---

## Running Tests

```bash
# Backend
cd Backend
pytest

# Frontend
cd Frontend
npx vitest run
```

---

## Roadmap
### V2 — Current (Stable)
Core parking finder. Heuristic recommendation engine, Google OAuth, MapLibre map with 2D/Satellite/3D modes, OSRM turn-by-turn navigation, campus events from UMN iCal feeds, search and filters, saved spots, community spot submissions, and admin dashboard.

### V2.1 — Quality of Life + Data Foundation
Bug fixes for the recommendation engine preference scoring, suggest-a-spot submission flow, and 3D map mode. Adds TTS turn-by-turn navigation, community safety ratings and spot notes, iCal event geocoding so the map button actually works, user parking history with an explicit data consent prompt, and offline/degraded state handling so the app stays usable without a connection.

### V2.2 — Navigation Polish + Campus Buildings Mode
OSRM route caching so repeat routes load instantly. Re-routing detection when the user goes off course. Campus buildings mode lets users switch from parking directions to walking directions to a specific UMN building once they are parked. UI and marker pin polish pass.

### V2.5 — ML-Powered Recommendations
Replaces the hand-tuned scoring weights with weights learned from real user behavior collected in V2.1. Weather impact scoring via OpenWeatherMap adjusts recommendations based on current conditions.

### V2.6 — AI Parking Assistant
Natural language chat interface. Describe what you need and get a direct recommendation with map integration. Resolves UMN venue names to coordinates, calls the existing recommendation engine under the hood, and falls back to the standard results list if confidence is low.

---

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Follow the checklist in `.claude/CLAUDE.md` for new features
4. Open a PR against `main`

---
