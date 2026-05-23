# Swarm Check-in Viewer — Design Spec
**Date:** 2026-05-23  
**Status:** Approved

---

## Overview

A lightweight Tauri desktop app that connects to a user's Foursquare Swarm account and provides a better way to explore check-in history. Check-ins are plotted on an interactive Google Maps canvas with a synchronized timeline panel, real-time search and filtering, and a stats dashboard. Distributed as a GitHub Releases binary (.dmg / .exe).

---

## Decisions Summary

| Concern | Decision |
|---|---|
| Framework | Tauri (Rust + React) |
| Default layout | Split view — map (left, ~60%) + timeline (right, ~40%) |
| Map provider | Google Maps JS API |
| State management | Zustand |
| Local cache | SQLite via tauri-plugin-sql |
| App theme | System auto (follows OS light/dark preference) |
| First launch | Load full history with progress indicator |
| Distribution | GitHub Releases (.dmg for macOS, .exe for Windows) |

---

## Architecture

The app is divided into two layers separated by Tauri's command boundary.

### Rust Backend

Handles everything that touches the OS or network:

- **OAuth flow** — opens system browser, listens on local redirect URI (`http://127.0.0.1:7878/callback`), exchanges code for token
- **Keychain** — stores/retrieves access token via the `keyring` crate (macOS Keychain, Windows Credential Manager)
- **SQLite** — all reads and writes via `tauri-plugin-sql`
- **Swarm API** — paginated fetches with exponential backoff on rate limits
- **Incremental sync** — tracks `last_sync_at`; fetches only new check-ins on subsequent opens
- **Tauri events** — emits progress and sync completion events to the frontend

### React Frontend

Handles all display and user interaction:

- Calls Rust via `invoke()` — never touches the network or SQLite directly
- **Zustand store** holds all check-ins in memory after initial load; filtering and search operate in-memory (no DB round-trips)
- **Google Maps** via `@googlemaps/js-api-loader`; pin clustering via `@googlemaps/markerclusterer`
- **Charts** via Recharts (stats view)
- **Virtualized timeline** via react-window (handles thousands of entries)

### Data Flow

```
[App open — logged out]
  → show connect screen
  → user clicks "Connect to Swarm"
  → Rust opens OAuth URL in system browser
  → Foursquare redirects to local listener with auth code
  → Rust exchanges code for token, stores in keychain
  → emits auth-success event to frontend
  → proceed to bulk historical load

[App open — logged in]
  → Rust reads token from keychain
  → loads all check-ins from SQLite → emits to frontend
  → frontend renders map + timeline + stats
  → Rust fetches new check-ins since last_sync_at from Swarm API
  → merges into SQLite → emits updated check-ins to frontend

[Search / filter input]
  → Zustand selector filters in-memory check-in list
  → map re-renders filtered pins, timeline re-renders filtered list

[Bulk historical load (first launch)]
  → fetch pages of 250 check-ins from Swarm API
  → write each page to SQLite before fetching the next
  → emit progress event: { loaded: N, total: M }
  → frontend shows "Loading N of M check-ins..."
  → on completion, set last_sync_at to most recent check-in timestamp, set bulk_load_complete = 1
```

---

## Data Model

### SQLite Schema

```sql
CREATE TABLE checkins (
  id TEXT PRIMARY KEY,
  venue_id TEXT,
  venue_name TEXT NOT NULL,
  venue_address TEXT,
  venue_city TEXT,
  venue_country TEXT,
  venue_category TEXT,
  lat REAL,
  lng REAL,
  checked_in_at INTEGER NOT NULL,
  note TEXT,
  swarm_url TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_checkins_time ON checkins (checked_in_at);
CREATE INDEX idx_checkins_city ON checkins (venue_city);

CREATE VIRTUAL TABLE checkins_fts USING fts5(
  id UNINDEXED,
  venue_name,
  venue_city,
  note,
  content='checkins',
  content_rowid='rowid'
);

CREATE TABLE sync_state (
  id INTEGER PRIMARY KEY DEFAULT 1,
  last_sync_at INTEGER,
  total_fetched INTEGER DEFAULT 0,
  bulk_load_complete INTEGER DEFAULT 0  -- 0 until first full history load finishes
);

CREATE TABLE preferences (
  id INTEGER PRIMARY KEY DEFAULT 1,
  show_categories INTEGER DEFAULT 1,
  show_notes INTEGER DEFAULT 1,
  map_lat REAL DEFAULT 0,
  map_lng REAL DEFAULT 0,
  map_zoom INTEGER DEFAULT 3
);
```

### Zustand Store Shape

```ts
interface AppStore {
  // Data
  checkins: Checkin[]
  filteredCheckins: Checkin[]   // derived from checkins + active filters + search

  // UI state
  selectedCheckinId: string | null
  activeView: 'map' | 'stats'   // timeline always visible in split; stats replaces it
  searchQuery: string
  filters: {
    dateRange: { start: number | null; end: number | null }
    city: string | null
  }

  // Sync state
  syncStatus: 'idle' | 'loading' | 'syncing' | 'error'
  syncProgress: { loaded: number; total: number } | null
  lastSyncAt: number | null

  // Preferences
  prefs: { showCategories: boolean; showNotes: boolean }
}
```

---

## Authentication

### Foursquare OAuth 2.0 Flow

1. User clicks "Connect to Swarm"
2. Rust registers a local HTTP listener on `http://127.0.0.1:7878/callback`
3. Rust opens `https://foursquare.com/oauth2/authenticate?client_id=CLIENT_ID&redirect_uri=http://127.0.0.1:7878/callback&response_type=code` in the system browser
4. User approves in browser → Foursquare redirects to local listener with `?code=...`
5. Rust exchanges code for access token via POST to `https://foursquare.com/oauth2/access_token`
6. Token stored in OS keychain under key `swarm-viewer/access-token`
7. Rust emits `auth-success` Tauri event → frontend proceeds to bulk load

**Sign-out:** Deletes token from keychain, drops all SQLite data, resets frontend to connect screen.

### Required Setup (user must do before building)

1. **Foursquare Developer Account**
   - Go to [foursquare.com/developers](https://foursquare.com/developers) → Create a project
   - Register a new OAuth consumer
   - Set redirect URI to `http://127.0.0.1:7878/callback`
   - Copy Client ID and Client Secret

2. **Google Maps API Key**
   - Go to [console.cloud.google.com](https://console.cloud.google.com)
   - Create a project → Enable "Maps JavaScript API"
   - Create an API key → Restrict to "Maps JavaScript API"
   - Copy the key

Both values are set as build-time environment variables:
```
FOURSQUARE_CLIENT_ID=...
FOURSQUARE_CLIENT_SECRET=...
VITE_GOOGLE_MAPS_API_KEY=...
```

---

## UI Components

### App Shell

- **Toolbar** (top): Swarm logo, search bar (always visible), filter chips when active, refresh button, Stats tab toggle, settings gear
- **Split view** (below toolbar): map panel always left (~60%), right panel (~40%) shows timeline by default or stats when Stats tab is active
- Theme: System auto — light shell + standard Google Maps in light OS mode; dark shell + dark-styled Google Maps (via `styles` override) in dark OS mode

### Map Panel

- Google Maps canvas fills the panel
- Custom orange pins (`#F4845F`) matching Swarm's brand color
- `@googlemaps/markerclusterer` for pin clustering when zoomed out
- Clicking a pin opens an inline detail card anchored to the pin:
  - Venue name, address, date
  - Category (if `showCategories` preference enabled)
  - Note (if `showNotes` preference enabled)
  - "Open in Google Maps" link
  - "View on Swarm" link
- Active pin (selected via timeline or search) pulses
- Map position and zoom persist in `preferences` table between sessions

### Timeline Panel

- Virtualized list via react-window
- Each row: venue name (bold), city + date (muted), optional category chip, optional note snippet
- Sticky month/year section headers while scrolling
- Clicking a row: flies the map to the pin, opens its detail card, highlights the row in orange
- Active entry mirrors the selected map pin

### Stats Panel (right panel when Stats tab active; map remains visible on the left)

- Total check-ins count, displayed prominently
- Bar chart: check-ins per month or year (toggle), Recharts `<BarChart>`
- Longest streak: most consecutive days with ≥1 check-in, with start/end dates
- Top cities leaderboard: top 10 by check-in count
- New venues per month bar chart (first visit to that venue)
- All stats respect active date range filter

### Settings (gear → dropdown)

- Show categories toggle
- Show notes toggle
- Sign out button

---

## Error Handling

| Scenario | Behavior |
|---|---|
| 401 Unauthorized | Banner: "Session expired — please reconnect." Reconnect button re-runs OAuth. |
| 429 Rate limited | Exponential backoff: 2s → 4s → 8s → 16s → 32s. Toast after 5 failed retries. |
| Network offline | Load from SQLite cache silently. Toolbar shows "Last synced [time]" instead of syncing. |
| Bulk load interrupted | `bulk_load_complete` stays 0. On next open, re-fetch from the beginning — `INSERT OR REPLACE` handles duplicates, no data lost. Render what's cached immediately while re-fetching. |
| No check-ins yet | Full-screen progress view during initial load. |
| Search returns nothing | "No check-ins match your search" in timeline; no pins on map; "Clear search" link. |
| Filter returns nothing | Same empty state with "Clear filters" link. |
| Google Maps key missing | Map panel shows: "Google Maps API key not configured — see setup instructions." |

---

## Out of Scope (v1)

- Writing any data back to Swarm
- Syncing to Notion or external databases
- Mobile app
- Sharing or exporting check-in views
- Foursquare City Guide (non-Swarm) check-ins

---

## Future Considerations

- CSV / GeoJSON export
- Expanded stats (most visited venues, time of day, countries)
- Notion sync as optional add-on
- Web app version with hosted auth
