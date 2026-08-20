# Park & Go Privacy Policy

Last updated: August 19, 2026

Park & Go is an independent, open source parking and campus navigation app built
for University of Minnesota students. It is not affiliated with, endorsed by, or
operated by the University of Minnesota.

This policy describes what the app collects, why, who it is shared with, and how
to get rid of it. It is written against the actual code in this repository.
Where a claim below is enforced by a specific module, that module is named.

## Quick summary

- Your location is used while the app is open, to rank nearby parking and draw routes.
- Signing in is optional and uses Google. Guests can browse without an account.
- Analytics are off unless you turn them on, and the decision is enforced by the server.
- Analytics events record ids, settings, and counts. They never record your coordinates.
- Recommendations come from a published point based rubric, not a machine learning model.
- You can delete your account and its data from inside the app, at any time.
- We do not sell your personal information, and there is no advertising or ad tracking in the app.

## What the app collects

### Location

When you allow location access, the app watches your position while it is open
so it can rank nearby parking, estimate travel and walk times, draw routes, and
show nearby campus buildings.

Your coordinates are used in the request that asks for recommendations or a
route, and are held in memory on your device for the duration of the session.
The app does not write a history of where you have been. The one exception is
data you create on purpose: a private spot you save, which stores the
coordinates you chose along with the name and any note you add.

Before your position is used as a cache key for recommendations it is rounded to
about four decimal places, roughly 11 meters. Campus building lookups round to
about three decimal places. The precise value is still used to compute
distances. The rounding limits how precisely a position is repeated in request
keys and analytics triggers.

### Account information

Signing in is optional. If you sign in with Google, Park & Go receives and
stores your Google account id, email address, name, and profile photo URL.

You can also add profile details yourself: preferred name, major and major
category, grade level, graduation year, housing type, and preferred parking
types. These are optional. Major category and preferred parking types are used
by the recommendation rubric described below.

### Things you create in the app

- Saved parking spots and saved campus buildings
- Private spots you record, including their coordinates, name, and notes
- Parking history entries, meaning which spot and when
- Ratings and written reviews you leave on a spot
- Parking spots you submit, which become shared community content
- App preferences: map style, dark mode, verified only, directions only, campus routing, text to speech settings, and which mode the app opens in

### Analytics, only with consent

Analytics collection is off by default and stays off until you turn on the data
consent setting. Guests cannot be opted in at all, because there is no account
on which to record the decision.

This is enforced on the server, in `Backend/app/services/consent_service.py`.
The server reads your stored consent from the database and ignores any consent
value sent by the app, so a client cannot opt itself in. When consent is absent
the analytics endpoint accepts the request and stores nothing.

Every change to the setting is written to an append only audit trail
(`consent_events`), which records whether consent was granted or revoked, what
triggered the change, and a coarse platform label. That table exists to answer
the question "was consent in place at the time this data was collected".

**Analytics events do not contain your location.** Each event is an action name
plus a small set of ids, flags, and counts. The complete set of events the app
sends today:

| Event | What it records |
|---|---|
| `recommendation_view` | number of results, whether verified only was on, whether a location was available as a true or false flag |
| `navigation_start` | spot id, travel mode, campus routing setting, what started it |
| `navigation_route_loaded` | spot id, which routing source answered, travel mode, campus routing setting |
| `navigation_cancelled` | spot id, reason |
| `campus_building_navigate_click` | building id, where the tap came from |
| `remember_parking_spot_saved` | spot id, saved private spot id, source |

Your parking history is stored whether or not consent is on, because it is a
feature you use rather than analytics. Each row carries a `consent_flag` stamped
by the server that records whether that row may also be used for analytics.

## How recommendations work

Park & Go does not use a machine learning model to recommend parking. There is
no trained model, no profile inferred about you, and nothing about you is used
to train anything. Recommendations come from a fixed, human written scoring
rubric in `Backend/app/services/recommendation_engine.py`, applied identically
for everyone.

Each candidate spot is scored out of 75 points, plus up to 15 bonus points when
you are heading to an event:

| Factor | Max points | Basis |
|---|---|---|
| Cost | 40 | Cheaper scores higher. Free earns full points, $5 or more earns none. |
| Travel time | 15 | Estimated from straight line distance and your travel mode. |
| Preferred parking type | 10 | Full points when the spot matches a type you chose. |
| Major and campus | 5 | Full points when the spot is on the campus associated with your major category. |
| Verified | 5 | Full points for spots confirmed by an admin. |
| Event proximity | up to 15 bonus | Only when you are navigating to an event. |

Two pieces of your profile affect scoring: preferred parking types, and major
category, which maps to a campus. Leaving them blank simply scores those factors
at zero. Distance is also calculated and shown to you, but does not contribute
to the total. Travel time replaced it.

Because the rubric is fixed and published, the app can show you the score
breakdown for each recommendation, and the same inputs always produce the same
result. No automated decision here produces a legal or similarly significant
effect: the output is a ranked list of parking suggestions you are free to
ignore.

## Third party services

Park & Go is built on services that other organizations run. When the app
contacts them, they receive the information listed here and handle it under
their own privacy policies, which we do not control.

### Contacted by the app on your device

| Service | Purpose | What it receives |
|---|---|---|
| Google Sign In (`accounts.google.com`, and Google Sign In on Android) | Optional sign in | Your interaction with Google's sign in flow, under your Google account |
| OpenFreeMap (`tiles.openfreemap.org`) | Standard and 3D map tiles | Tile requests, which reveal the map area you are viewing, plus your IP address |
| Esri ArcGIS World Imagery (`services.arcgisonline.com`) | Satellite map tiles, when you pick satellite style | Same as above, only while that style is selected |
| Project OSRM (`router.project-osrm.org`) | Driving routes | Your start coordinates and your destination coordinates |
| OpenStreetMap routing (`routing.openstreetmap.de`) | Walking and cycling routes | Your start coordinates and your destination coordinates |
| Nominatim (`nominatim.openstreetmap.org`) | Turning a typed address into coordinates, when submitting or editing a spot | The address text you typed |
| jsDelivr (`cdn.jsdelivr.net`) | Icon font stylesheet | A request for a static asset, plus your IP address |

Routing is the one place where precise coordinates leave your device to a party
other than Park & Go's own server. It happens when you select a destination and
when you press Start, so that a route can be drawn.

### Contacted by the Park & Go server

| Service | Purpose | What it handles |
|---|---|---|
| Google (`googleapis.com`, `oauth2.googleapis.com`) | Verifying your sign in token and reading basic profile info | Your Google token, and in return your id, email, name, and photo URL |
| Neon | Managed PostgreSQL database | Everything stored, as described above |
| Render | Backend application hosting | Requests to the API, including standard server logs |
| Vercel | Frontend web hosting | Requests for the web app, including standard server logs |
| UMN public event calendars (`events.tc.umn.edu`) | Syncing campus events | Nothing about you. The server fetches public calendar feeds on its own schedule. |

Campus building data comes from OpenStreetMap and is stored in the app's own
database, so browsing buildings does not contact OpenStreetMap.

Text to speech for turn by turn directions uses the speech capability built into
your own device or browser. Audio is not sent to Park & Go.

## Where data is stored

Account data, saved spots, private spots, parking history, reviews, preferences,
consent records, and analytics events live in a managed PostgreSQL database
hosted by Neon in the United States.

On your own device, the app stores sign in tokens and some cached preferences in
browser local storage, plus a pending parking reminder if you set one. Signing
out clears the tokens.

## Sharing

We do not sell your personal information. We do not share it with advertisers,
and the app contains no advertising or ad tracking.

Information reaches the third parties listed above only for the purposes
described there. Beyond that, information may be disclosed if the law requires
it.

Two things you create are visible to other people by design: parking spots you
submit, and ratings and reviews you leave. Do not put anything private in a spot
name, a review, or a note.

## Your choices and controls

- **Location.** Optional, and controlled by your device or browser permissions. Denying it leaves the app working, with buildings listed alphabetically and recommendations scoring distance and travel time at half credit.
- **Signing in.** Optional. Guests can browse parking and buildings.
- **Analytics.** Off by default. Turn the data consent setting on or off at any time in Settings. Turning it off stops further collection immediately.
- **Deleting your account.** Available in Settings, at any time, without contacting anyone.

### What deleting your account does

Deletion is immediate and permanent. It is implemented in
`Backend/app/services/account_deletion_service.py`, and it either succeeds
completely or changes nothing.

Deleted outright:

- Your user record, including your Google id, email, name, and photo URL
- Saved spots and saved buildings
- Private spots, including their coordinates and notes
- Parking history
- Your ratings and reviews
- Your preferences and your consent audit trail

Kept, with the link to you removed:

- **Parking spots you submitted.** These are shared community content that other
  people's saved spots and recommendations point at, so the spot survives while
  the record of who submitted it is erased.
- **Analytics events**, if you had consent turned on. The user id is erased. What
  is left is an action name and a payload of ids, flags, and counts, which by
  design contains nothing that identifies you.

If you would rather have everything removed including the two categories above,
email the address below and ask.

## Data retention

Data is kept while your account exists, and removed as described above when you
delete it. Analytics events are retained after deletion in the anonymized form
described above. Public spot submissions persist for as long as the spot does.

## Children

Park & Go is intended for university students and is not directed at children
under 13. We do not knowingly collect information from children under 13.

## Accuracy and safety

Parking information, pricing, availability, routes, walk times, and event
details may be incomplete, wrong, or out of date. Always follow posted signs,
campus rules, local laws, and payment requirements, and use your own judgment.
Do not interact with the app while driving.

## Changes to this policy

If this policy changes materially, the updated version will appear in the app
and the date at the top will change. Continuing to use Park & Go after that
means the updated policy applies.

## Contact

Questions, requests, or concerns: **jamesinah34@gmail.com**
