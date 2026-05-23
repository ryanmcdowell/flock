# Swarm Check-in Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Tauri 2 desktop app that fetches a user's Foursquare Swarm check-in history, plots it on Google Maps, and provides timeline, search, filter, and stats views.

**Architecture:** Rust backend manages all SQLite, keychain, and Swarm API operations via Tauri commands; React/Zustand frontend handles display and syncs via `invoke()` and Tauri events. All filtering and search run in-memory against a Zustand-held check-in list loaded from SQLite at startup. The map is always visible on the left; the right panel switches between Timeline and Stats.

**Tech Stack:** Tauri 2, Rust (sqlx/SQLite, reqwest, keyring, tiny_http, chrono), React 18, TypeScript, Zustand 5, @googlemaps/js-api-loader, @googlemaps/markerclusterer, react-window, Recharts, Vitest, @testing-library/react

---

## File Structure

### Rust (`src-tauri/src/`)
| File | Responsibility |
|---|---|
| `lib.rs` | Tauri builder, plugin registration, command registration, shared DB state |
| `main.rs` | Thin entry point |
| `db.rs` | SQLite pool init, schema migrations |
| `models.rs` | Serde structs: `CheckIn`, `Prefs`, `SyncState`, `SyncProgress` |
| `keychain.rs` | Wrapper around `keyring` crate |
| `swarm.rs` | Foursquare API client: pagination, check-in parsing |
| `stats.rs` | Pure functions: streak, top cities, checkins per period, new venues per month |
| `commands/mod.rs` | Re-exports command modules |
| `commands/auth.rs` | `check_auth_status`, `start_oauth`, `sign_out` |
| `commands/checkins.rs` | `get_checkins`, `save_checkins`, `clear_checkins` |
| `commands/prefs.rs` | `get_prefs`, `save_prefs`, `get_sync_state`, `update_sync_state` |
| `commands/sync.rs` | `start_sync` — bulk load + incremental, emits progress events |

### React (`src/`)
| File | Responsibility |
|---|---|
| `types/index.ts` | TypeScript interfaces mirroring Rust models |
| `store/index.ts` | Zustand store: check-ins, filters, search, UI state, prefs |
| `hooks/useTauriEvents.ts` | Subscribe to Tauri events, update store |
| `hooks/useFilteredCheckins.ts` | Memoized in-memory filter + search selector |
| `App.tsx` | Root: routes between ConnectScreen / LoadingScreen / Shell |
| `components/ConnectScreen.tsx` | Welcome + "Connect to Swarm" button |
| `components/LoadingScreen.tsx` | Progress bar during bulk load |
| `components/Shell.tsx` | Split-pane layout wrapper |
| `components/Toolbar.tsx` | Search bar, filter chips, Stats tab, refresh, settings gear |
| `components/MapPanel.tsx` | Google Maps canvas, markers, clustering |
| `components/DetailCard.tsx` | Inline pin popup |
| `components/TimelinePanel.tsx` | react-window virtualized list |
| `components/TimelineRow.tsx` | Single timeline entry |
| `components/StatsPanel.tsx` | Recharts charts + metrics |
| `components/FilterChips.tsx` | Dismissible active-filter pills |
| `components/SettingsMenu.tsx` | Toggles + sign-out dropdown |
| `test-setup.ts` | Vitest global mocks for @tauri-apps/api |

### Other
| File | Responsibility |
|---|---|
| `src-tauri/migrations/001_initial.sql` | Full SQLite schema |
| `.env.example` | Key names for FOURSQUARE_CLIENT_ID/SECRET, VITE_GOOGLE_MAPS_API_KEY |
| `.github/workflows/release.yml` | Build + publish on git tag push |
| `README.md` | Setup instructions (API keys, building, running) |

---

## Task 1: Scaffold Project + Configure Dependencies

**Files:**
- Create: entire project via `npm create tauri-app`
- Modify: `src-tauri/Cargo.toml`
- Modify: `package.json`
- Modify: `src-tauri/tauri.conf.json`
- Create: `vitest.config.ts`
- Create: `src/test-setup.ts`
- Create: `.env.example`

- [ ] **Step 1: Create the project**

```bash
cd /Users/ryanmcdowell/Developer/Projects
npm create tauri-app@latest swarm-to-notion -- --template react-ts --manager npm
cd swarm-to-notion
```

- [ ] **Step 2: Install frontend dependencies**

```bash
npm install zustand@5 @googlemaps/js-api-loader @googlemaps/markerclusterer react-window recharts @tauri-apps/api@2
npm install -D vitest@2 @testing-library/react@16 @testing-library/user-event@14 @testing-library/jest-dom jsdom @vitejs/plugin-react @types/react-window @types/googlemaps
```

- [ ] **Step 3: Replace `[dependencies]` in `src-tauri/Cargo.toml`**

```toml
[dependencies]
tauri = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
sqlx = { version = "0.8", features = ["sqlite", "runtime-tokio", "macros"] }
reqwest = { version = "0.12", features = ["json", "rustls-tls"], default-features = false }
keyring = "3"
open = "5"
tiny_http = "0.12"
thiserror = "2"
chrono = { version = "0.4", features = ["serde"] }

[dev-dependencies]
tokio = { version = "1", features = ["full"] }
tempfile = "3"

[lib]
name = "swarm_viewer_lib"
crate-type = ["staticlib", "cdylib", "rlib"]
```

- [ ] **Step 4: Write `src-tauri/tauri.conf.json`**

```json
{
  "productName": "Swarm Viewer",
  "version": "0.1.0",
  "identifier": "io.ryanmcdowell.swarm-viewer",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [
      {
        "title": "Swarm Viewer",
        "width": 1200,
        "height": 800,
        "minWidth": 900,
        "minHeight": 600,
        "resizable": true
      }
    ],
    "security": {
      "csp": "default-src 'self' ipc: http://ipc.localhost; script-src 'self' 'unsafe-inline' https://maps.googleapis.com https://maps.gstatic.com; img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' ipc: http://ipc.localhost https://maps.googleapis.com https://api.foursquare.com https://foursquare.com"
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/32x32.png","icons/128x128.png","icons/128x128@2x.png","icons/icon.icns","icons/icon.ico"]
  }
}
```

- [ ] **Step 5: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test-setup.ts'],
  },
})
```

- [ ] **Step 6: Create `src/test-setup.ts`**

```typescript
import '@testing-library/jest-dom'
import { vi } from 'vitest'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(),
}))
```

- [ ] **Step 7: Create `.env.example`**

```
FOURSQUARE_CLIENT_ID=your_foursquare_client_id
FOURSQUARE_CLIENT_SECRET=your_foursquare_client_secret
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

- [ ] **Step 8: Verify frontend tests run**

```bash
npm test -- --run
```

Expected: `0 test files found` (no tests yet, exits 0).

- [ ] **Step 9: Commit**

```bash
git add . && git commit -m "feat: scaffold Tauri + React + TypeScript project"
```

---

## Task 2: SQLite Schema + DB Pool

**Files:**
- Create: `src-tauri/migrations/001_initial.sql`
- Create: `src-tauri/src/db.rs`

- [ ] **Step 1: Create `src-tauri/migrations/001_initial.sql`**

```sql
CREATE TABLE IF NOT EXISTS checkins (
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

CREATE INDEX IF NOT EXISTS idx_checkins_time ON checkins (checked_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkins_city ON checkins (venue_city);

CREATE TABLE IF NOT EXISTS sync_state (
  id INTEGER PRIMARY KEY DEFAULT 1,
  last_sync_at INTEGER,
  total_fetched INTEGER DEFAULT 0,
  bulk_load_complete INTEGER DEFAULT 0
);
INSERT OR IGNORE INTO sync_state (id) VALUES (1);

CREATE TABLE IF NOT EXISTS preferences (
  id INTEGER PRIMARY KEY DEFAULT 1,
  show_categories INTEGER DEFAULT 1,
  show_notes INTEGER DEFAULT 1,
  map_lat REAL DEFAULT 0.0,
  map_lng REAL DEFAULT 0.0,
  map_zoom INTEGER DEFAULT 3
);
INSERT OR IGNORE INTO preferences (id) VALUES (1);
```

- [ ] **Step 2: Write failing test in `src-tauri/src/db.rs`**

```rust
use sqlx::{sqlite::{SqliteConnectOptions, SqlitePool}, Pool, Sqlite};
use std::{path::Path, str::FromStr};

pub type DbPool = Pool<Sqlite>;

pub async fn init_pool(db_path: &Path) -> Result<DbPool, sqlx::Error> {
    todo!()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_init_creates_schema() {
        let dir = tempdir().unwrap();
        let pool = init_pool(&dir.path().join("test.db")).await.unwrap();
        let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM sync_state")
            .fetch_one(&pool).await.unwrap();
        assert_eq!(count, 1);
    }
}
```

- [ ] **Step 3: Run test, verify it fails**

```bash
cd src-tauri && cargo test test_init_creates_schema 2>&1 | tail -5
```

Expected: `FAILED` — `todo!()` panics.

- [ ] **Step 4: Implement `init_pool`**

```rust
pub async fn init_pool(db_path: &Path) -> Result<DbPool, sqlx::Error> {
    let url = format!("sqlite:{}", db_path.display());
    let options = SqliteConnectOptions::from_str(&url)?
        .create_if_missing(true)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal);
    let pool = SqlitePool::connect_with(options).await?;
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .map_err(|e| sqlx::Error::Configuration(e.to_string().into()))?;
    Ok(pool)
}
```

- [ ] **Step 5: Run test, verify it passes**

```bash
cd src-tauri && cargo test test_init_creates_schema 2>&1 | tail -5
```

Expected: `test db::tests::test_init_creates_schema ... ok`

- [ ] **Step 6: Commit**

```bash
git add src-tauri/migrations/ src-tauri/src/db.rs src-tauri/Cargo.toml
git commit -m "feat: SQLite schema and connection pool"
```

---

## Task 3: Rust Models + Check-in CRUD

**Files:**
- Create: `src-tauri/src/models.rs`
- Create: `src-tauri/src/commands/mod.rs`
- Create: `src-tauri/src/commands/checkins.rs`

- [ ] **Step 1: Create `src-tauri/src/models.rs`**

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CheckIn {
    pub id: String,
    pub venue_id: Option<String>,
    pub venue_name: String,
    pub venue_address: Option<String>,
    pub venue_city: Option<String>,
    pub venue_country: Option<String>,
    pub venue_category: Option<String>,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub checked_in_at: i64,
    pub note: Option<String>,
    pub swarm_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Prefs {
    pub show_categories: bool,
    pub show_notes: bool,
    pub map_lat: f64,
    pub map_lng: f64,
    pub map_zoom: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SyncState {
    pub last_sync_at: Option<i64>,
    pub total_fetched: i64,
    pub bulk_load_complete: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncProgress {
    pub loaded: u32,
    pub total: u32,
}
```

- [ ] **Step 2: Write failing tests in `src-tauri/src/commands/checkins.rs`**

```rust
use crate::{db::DbPool, models::CheckIn};
use tauri::State;

pub(crate) async fn save_checkins_inner(pool: &DbPool, checkins: &[CheckIn]) -> Result<(), String> {
    todo!()
}

pub(crate) async fn get_checkins_inner(pool: &DbPool) -> Result<Vec<CheckIn>, String> {
    todo!()
}

pub(crate) async fn clear_checkins_inner(pool: &DbPool) -> Result<(), String> {
    todo!()
}

#[tauri::command]
pub async fn get_checkins(pool: State<'_, DbPool>) -> Result<Vec<CheckIn>, String> {
    get_checkins_inner(&pool).await
}

#[tauri::command]
pub async fn save_checkins(checkins: Vec<CheckIn>, pool: State<'_, DbPool>) -> Result<(), String> {
    save_checkins_inner(&pool, &checkins).await
}

#[tauri::command]
pub async fn clear_checkins(pool: State<'_, DbPool>) -> Result<(), String> {
    clear_checkins_inner(&pool).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_pool;
    use tempfile::tempdir;

    fn make(id: &str, city: &str) -> CheckIn {
        CheckIn {
            id: id.to_string(), venue_id: Some("v1".to_string()),
            venue_name: "Place".to_string(), venue_address: None,
            venue_city: Some(city.to_string()), venue_country: None,
            venue_category: None, lat: Some(37.7), lng: Some(-122.4),
            checked_in_at: 1_000_000, note: None, swarm_url: None,
        }
    }

    #[tokio::test]
    async fn test_save_and_get() {
        let dir = tempdir().unwrap();
        let pool = init_pool(&dir.path().join("t.db")).await.unwrap();
        save_checkins_inner(&pool, &[make("a", "SF"), make("b", "NYC")]).await.unwrap();
        let result = get_checkins_inner(&pool).await.unwrap();
        assert_eq!(result.len(), 2);
    }

    #[tokio::test]
    async fn test_save_idempotent() {
        let dir = tempdir().unwrap();
        let pool = init_pool(&dir.path().join("t.db")).await.unwrap();
        let c = make("dup", "SF");
        save_checkins_inner(&pool, &[c.clone()]).await.unwrap();
        save_checkins_inner(&pool, &[c]).await.unwrap();
        assert_eq!(get_checkins_inner(&pool).await.unwrap().len(), 1);
    }

    #[tokio::test]
    async fn test_clear() {
        let dir = tempdir().unwrap();
        let pool = init_pool(&dir.path().join("t.db")).await.unwrap();
        save_checkins_inner(&pool, &[make("x", "SF")]).await.unwrap();
        clear_checkins_inner(&pool).await.unwrap();
        assert_eq!(get_checkins_inner(&pool).await.unwrap().len(), 0);
    }
}
```

- [ ] **Step 3: Run tests, verify they fail**

```bash
cd src-tauri && cargo test commands::checkins 2>&1 | tail -8
```

Expected: 3 tests FAILED.

- [ ] **Step 4: Implement the inner functions**

Replace the `todo!()` bodies:

```rust
pub(crate) async fn save_checkins_inner(pool: &DbPool, checkins: &[CheckIn]) -> Result<(), String> {
    for c in checkins {
        sqlx::query(
            "INSERT OR REPLACE INTO checkins
             (id,venue_id,venue_name,venue_address,venue_city,venue_country,
              venue_category,lat,lng,checked_in_at,note,swarm_url)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
        )
        .bind(&c.id).bind(&c.venue_id).bind(&c.venue_name).bind(&c.venue_address)
        .bind(&c.venue_city).bind(&c.venue_country).bind(&c.venue_category)
        .bind(c.lat).bind(c.lng).bind(c.checked_in_at).bind(&c.note).bind(&c.swarm_url)
        .execute(pool).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub(crate) async fn get_checkins_inner(pool: &DbPool) -> Result<Vec<CheckIn>, String> {
    sqlx::query_as::<_, CheckIn>(
        "SELECT id,venue_id,venue_name,venue_address,venue_city,venue_country,
                venue_category,lat,lng,checked_in_at,note,swarm_url
         FROM checkins ORDER BY checked_in_at DESC"
    )
    .fetch_all(pool).await.map_err(|e| e.to_string())
}

pub(crate) async fn clear_checkins_inner(pool: &DbPool) -> Result<(), String> {
    sqlx::query("DELETE FROM checkins").execute(pool).await.map_err(|e| e.to_string())?;
    Ok(())
}
```

- [ ] **Step 5: Create `src-tauri/src/commands/mod.rs`**

```rust
pub mod auth;
pub mod checkins;
pub mod prefs;
pub mod sync;
```

Create empty stubs for the missing modules so it compiles:

`src-tauri/src/commands/auth.rs`:
```rust
use crate::db::DbPool;
use tauri::State;

#[tauri::command]
pub async fn check_auth_status() -> Result<bool, String> { Ok(false) }
#[tauri::command]
pub async fn start_oauth() -> Result<(), String> { Ok(()) }
#[tauri::command]
pub async fn sign_out(_pool: State<'_, DbPool>) -> Result<(), String> { Ok(()) }
```

`src-tauri/src/commands/prefs.rs`:
```rust
use crate::{db::DbPool, models::{Prefs, SyncState}};
use tauri::State;

#[tauri::command]
pub async fn get_prefs(_pool: State<'_, DbPool>) -> Result<Prefs, String> { todo!() }
#[tauri::command]
pub async fn save_prefs(_prefs: Prefs, _pool: State<'_, DbPool>) -> Result<(), String> { Ok(()) }
#[tauri::command]
pub async fn get_sync_state(_pool: State<'_, DbPool>) -> Result<SyncState, String> { todo!() }
#[tauri::command]
pub async fn update_sync_state(_last_sync_at: Option<i64>, _total_fetched: i64, _bulk_load_complete: bool, _pool: State<'_, DbPool>) -> Result<(), String> { Ok(()) }
```

`src-tauri/src/commands/sync.rs`:
```rust
use crate::db::DbPool;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn start_sync(_app: AppHandle, _pool: State<'_, DbPool>) -> Result<(), String> { Ok(()) }
```

- [ ] **Step 6: Create stub `src-tauri/src/lib.rs`**

```rust
pub mod commands;
pub mod db;
pub mod models;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::auth::check_auth_status,
            commands::auth::start_oauth,
            commands::auth::sign_out,
            commands::checkins::get_checkins,
            commands::checkins::save_checkins,
            commands::checkins::clear_checkins,
            commands::prefs::get_prefs,
            commands::prefs::save_prefs,
            commands::prefs::get_sync_state,
            commands::prefs::update_sync_state,
            commands::sync::start_sync,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 7: Run tests, verify they pass**

```bash
cd src-tauri && cargo test commands::checkins 2>&1 | tail -8
```

Expected: 3 tests pass.

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/ && git commit -m "feat: Rust models and check-in CRUD commands"
```

---

## Task 4: Prefs + Keychain + Auth Commands

**Files:**
- Create: `src-tauri/src/keychain.rs`
- Replace: `src-tauri/src/commands/prefs.rs` (full implementation)
- Replace: `src-tauri/src/commands/auth.rs` (full implementation)

- [ ] **Step 1: Create `src-tauri/src/keychain.rs`**

```rust
use keyring::Entry;

const SERVICE: &str = "swarm-viewer";
const USER: &str = "access-token";

pub fn store_token(token: &str) -> Result<(), String> {
    Entry::new(SERVICE, USER).map_err(|e| e.to_string())?
        .set_password(token).map_err(|e| e.to_string())
}

pub fn get_token() -> Result<Option<String>, String> {
    match Entry::new(SERVICE, USER).map_err(|e| e.to_string())?.get_password() {
        Ok(t) => Ok(Some(t)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub fn delete_token() -> Result<(), String> {
    match Entry::new(SERVICE, USER).map_err(|e| e.to_string())?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
```

- [ ] **Step 2: Replace `src-tauri/src/commands/prefs.rs`**

```rust
use crate::{db::DbPool, models::{Prefs, SyncState}};
use tauri::State;

pub(crate) async fn get_prefs_inner(pool: &DbPool) -> Result<Prefs, String> {
    sqlx::query_as::<_, Prefs>(
        "SELECT show_categories,show_notes,map_lat,map_lng,map_zoom FROM preferences WHERE id=1"
    ).fetch_one(pool).await.map_err(|e| e.to_string())
}

pub(crate) async fn get_sync_state_inner(pool: &DbPool) -> Result<SyncState, String> {
    sqlx::query_as::<_, SyncState>(
        "SELECT last_sync_at,total_fetched,bulk_load_complete FROM sync_state WHERE id=1"
    ).fetch_one(pool).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_prefs(pool: State<'_, DbPool>) -> Result<Prefs, String> {
    get_prefs_inner(&pool).await
}

#[tauri::command]
pub async fn save_prefs(prefs: Prefs, pool: State<'_, DbPool>) -> Result<(), String> {
    sqlx::query(
        "UPDATE preferences SET show_categories=?,show_notes=?,map_lat=?,map_lng=?,map_zoom=? WHERE id=1"
    )
    .bind(prefs.show_categories).bind(prefs.show_notes)
    .bind(prefs.map_lat).bind(prefs.map_lng).bind(prefs.map_zoom)
    .execute(&*pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_sync_state(pool: State<'_, DbPool>) -> Result<SyncState, String> {
    get_sync_state_inner(&pool).await
}

#[tauri::command]
pub async fn update_sync_state(
    last_sync_at: Option<i64>,
    total_fetched: i64,
    bulk_load_complete: bool,
    pool: State<'_, DbPool>,
) -> Result<(), String> {
    sqlx::query(
        "UPDATE sync_state SET last_sync_at=?,total_fetched=?,bulk_load_complete=? WHERE id=1"
    )
    .bind(last_sync_at).bind(total_fetched).bind(bulk_load_complete)
    .execute(&*pool).await.map_err(|e| e.to_string())?;
    Ok(())
}
```

- [ ] **Step 3: Replace `src-tauri/src/commands/auth.rs`**

```rust
use crate::{commands::checkins::clear_checkins_inner, db::DbPool, keychain};
use reqwest::Client;
use tauri::State;

const CLIENT_ID: &str = env!("FOURSQUARE_CLIENT_ID");
const CLIENT_SECRET: &str = env!("FOURSQUARE_CLIENT_SECRET");
const REDIRECT_URI: &str = "http://127.0.0.1:7878/callback";

#[tauri::command]
pub async fn check_auth_status() -> Result<bool, String> {
    keychain::get_token().map(|t| t.is_some())
}

#[tauri::command]
pub async fn start_oauth() -> Result<(), String> {
    let auth_url = format!(
        "https://foursquare.com/oauth2/authenticate?client_id={}&redirect_uri={}&response_type=code",
        CLIENT_ID, REDIRECT_URI
    );
    open::that(&auth_url).map_err(|e| e.to_string())?;

    let code = tokio::task::spawn_blocking(|| -> Result<String, String> {
        let server = tiny_http::Server::http("127.0.0.1:7878")
            .map_err(|e| format!("OAuth listener failed: {e}"))?;
        let request = server.recv().map_err(|e| e.to_string())?;
        let url = request.url().to_string();
        let code = url.split("code=").nth(1)
            .and_then(|s| s.split('&').next())
            .ok_or("No code in OAuth callback")?
            .to_string();
        request.respond(tiny_http::Response::from_string(
            "<html><body><h2>Connected! You can close this tab.</h2></body></html>"
        )).ok();
        Ok(code)
    }).await.map_err(|e| e.to_string())??;

    let resp: serde_json::Value = Client::new()
        .get("https://foursquare.com/oauth2/access_token")
        .query(&[
            ("client_id", CLIENT_ID), ("client_secret", CLIENT_SECRET),
            ("grant_type", "authorization_code"),
            ("redirect_uri", REDIRECT_URI), ("code", &code),
        ])
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;

    let token = resp["access_token"].as_str()
        .ok_or("No access_token in Foursquare response")?;
    keychain::store_token(token)
}

#[tauri::command]
pub async fn sign_out(pool: State<'_, DbPool>) -> Result<(), String> {
    keychain::delete_token()?;
    clear_checkins_inner(&pool).await?;
    sqlx::query(
        "UPDATE sync_state SET last_sync_at=NULL,total_fetched=0,bulk_load_complete=0 WHERE id=1"
    ).execute(&*pool).await.map_err(|e| e.to_string())?;
    Ok(())
}
```

- [ ] **Step 4: Add `keychain` module to `lib.rs`**

```rust
pub mod keychain;
```

- [ ] **Step 5: Build check**

```bash
cd src-tauri && FOURSQUARE_CLIENT_ID=test FOURSQUARE_CLIENT_SECRET=test cargo check 2>&1 | tail -5
```

Expected: `warning: unused import` or clean — no errors.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/ && git commit -m "feat: keychain wrapper, OAuth flow, prefs commands"
```

---

## Task 5: Swarm API Client + Stats

**Files:**
- Create: `src-tauri/src/swarm.rs`
- Create: `src-tauri/src/stats.rs`

- [ ] **Step 1: Write failing tests for `src-tauri/src/swarm.rs`**

```rust
use crate::models::CheckIn;
use reqwest::Client;
use serde::Deserialize;

#[derive(Deserialize)]
struct ApiResponse { response: CheckinsWrapper }
#[derive(Deserialize)]
struct CheckinsWrapper { checkins: CheckinPage }
#[derive(Deserialize)]
struct CheckinPage { count: u32, items: Vec<RawCheckIn> }

#[derive(Deserialize)]
pub struct RawCheckIn {
    pub id: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    pub shout: Option<String>,
    pub venue: Option<RawVenue>,
}

#[derive(Deserialize)]
pub struct RawVenue {
    pub id: String,
    pub name: String,
    pub location: Option<RawLocation>,
    pub categories: Option<Vec<RawCategory>>,
}

#[derive(Deserialize)]
pub struct RawLocation {
    pub address: Option<String>,
    pub city: Option<String>,
    pub country: Option<String>,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
}

#[derive(Deserialize)]
pub struct RawCategory { pub name: String }

pub fn raw_to_checkin(raw: RawCheckIn) -> CheckIn {
    todo!()
}

pub async fn fetch_page(
    client: &Client, token: &str, limit: u32, offset: u32, after: Option<i64>,
) -> Result<(Vec<CheckIn>, u32), String> {
    todo!()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_maps_fields() {
        let raw = RawCheckIn {
            id: "abc".into(), created_at: 1_609_459_200,
            shout: Some("Great!".into()),
            venue: Some(RawVenue {
                id: "v1".into(), name: "Blue Bottle".into(),
                location: Some(RawLocation {
                    address: Some("300 Webster".into()),
                    city: Some("San Francisco".into()),
                    country: Some("US".into()),
                    lat: Some(37.77), lng: Some(-122.41),
                }),
                categories: Some(vec![RawCategory { name: "Coffee Shop".into() }]),
            }),
        };
        let c = raw_to_checkin(raw);
        assert_eq!(c.id, "abc");
        assert_eq!(c.venue_name, "Blue Bottle");
        assert_eq!(c.venue_city.as_deref(), Some("San Francisco"));
        assert_eq!(c.venue_category.as_deref(), Some("Coffee Shop"));
        assert_eq!(c.note.as_deref(), Some("Great!"));
        assert!(c.swarm_url.as_deref().unwrap().contains("abc"));
    }

    #[test]
    fn test_missing_venue() {
        let raw = RawCheckIn { id: "x".into(), created_at: 1, shout: None, venue: None };
        let c = raw_to_checkin(raw);
        assert_eq!(c.venue_name, "Unknown Venue");
        assert!(c.venue_city.is_none());
    }
}
```

- [ ] **Step 2: Run tests, verify fail**

```bash
cd src-tauri && cargo test swarm::tests 2>&1 | tail -5
```

Expected: FAILED.

- [ ] **Step 3: Implement `raw_to_checkin` and `fetch_page`**

```rust
pub fn raw_to_checkin(raw: RawCheckIn) -> CheckIn {
    let loc = raw.venue.as_ref().and_then(|v| v.location.as_ref());
    CheckIn {
        id: raw.id.clone(),
        venue_id: raw.venue.as_ref().map(|v| v.id.clone()),
        venue_name: raw.venue.as_ref().map(|v| v.name.clone()).unwrap_or_else(|| "Unknown Venue".into()),
        venue_address: loc.and_then(|l| l.address.clone()),
        venue_city: loc.and_then(|l| l.city.clone()),
        venue_country: loc.and_then(|l| l.country.clone()),
        venue_category: raw.venue.as_ref()
            .and_then(|v| v.categories.as_ref())
            .and_then(|c| c.first())
            .map(|c| c.name.clone()),
        lat: loc.and_then(|l| l.lat),
        lng: loc.and_then(|l| l.lng),
        checked_in_at: raw.created_at,
        note: raw.shout,
        swarm_url: Some(format!("https://www.swarmapp.com/checkin/{}", raw.id)),
    }
}

pub async fn fetch_page(
    client: &Client, token: &str, limit: u32, offset: u32, after: Option<i64>,
) -> Result<(Vec<CheckIn>, u32), String> {
    let mut params = vec![
        ("oauth_token", token.to_string()),
        ("v", "20240101".into()),
        ("limit", limit.to_string()),
        ("offset", offset.to_string()),
        ("sort", "newestfirst".into()),
    ];
    if let Some(ts) = after {
        params.push(("afterTimestamp", ts.to_string()));
    }
    let resp = client
        .get("https://api.foursquare.com/v2/users/self/checkins")
        .query(&params).send().await.map_err(|e| e.to_string())?;
    if resp.status() == 429 { return Err("rate_limited".into()); }
    let api: ApiResponse = resp.json().await.map_err(|e| e.to_string())?;
    let total = api.response.checkins.count;
    let items = api.response.checkins.items.into_iter().map(raw_to_checkin).collect();
    Ok((items, total))
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
cd src-tauri && cargo test swarm::tests 2>&1 | tail -5
```

Expected: 2 tests pass.

- [ ] **Step 5: Write failing tests in `src-tauri/src/stats.rs`**

```rust
use crate::models::CheckIn;
use chrono::{DateTime, Utc, TimeZone};
use std::collections::HashMap;

#[derive(Debug, PartialEq, serde::Serialize, serde::Deserialize)]
pub struct StreakResult {
    pub days: u32,
    pub start_ts: Option<i64>,
    pub end_ts: Option<i64>,
}

pub fn longest_streak(timestamps: &[i64]) -> StreakResult { todo!() }
pub fn top_cities(checkins: &[CheckIn], limit: usize) -> Vec<(String, usize)> { todo!() }
pub fn checkins_per_month(checkins: &[CheckIn]) -> Vec<(String, usize)> { todo!() }
pub fn new_venues_per_month(checkins: &[CheckIn]) -> Vec<(String, usize)> { todo!() }

fn fmt_month(ts: i64) -> String {
    Utc.timestamp_opt(ts, 0).unwrap().format("%Y-%m").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn day(y: i32, m: u32, d: u32) -> i64 {
        chrono::NaiveDate::from_ymd_opt(y, m, d).unwrap()
            .and_hms_opt(12, 0, 0).unwrap().and_utc().timestamp()
    }

    fn ci(id: &str, city: &str, vid: &str, ts: i64) -> CheckIn {
        CheckIn { id: id.into(), venue_id: Some(vid.into()), venue_name: "P".into(),
            venue_address: None, venue_city: Some(city.into()), venue_country: None,
            venue_category: None, lat: None, lng: None, checked_in_at: ts,
            note: None, swarm_url: None }
    }

    #[test]
    fn test_streak_consecutive() {
        let r = longest_streak(&[day(2024,1,1), day(2024,1,2), day(2024,1,3)]);
        assert_eq!(r.days, 3);
    }

    #[test]
    fn test_streak_with_gap() {
        let r = longest_streak(&[day(2024,1,1), day(2024,1,2), day(2024,1,5), day(2024,1,6)]);
        assert_eq!(r.days, 2);
    }

    #[test]
    fn test_streak_empty() {
        assert_eq!(longest_streak(&[]).days, 0);
    }

    #[test]
    fn test_streak_deduplicates_same_day() {
        let r = longest_streak(&[day(2024,1,1), day(2024,1,1)+3600, day(2024,1,2)]);
        assert_eq!(r.days, 2);
    }

    #[test]
    fn test_top_cities() {
        let checkins = vec![ci("1","SF","v1",1), ci("2","SF","v2",2), ci("3","NYC","v3",3)];
        let r = top_cities(&checkins, 2);
        assert_eq!(r[0], ("SF".into(), 2));
        assert_eq!(r[1], ("NYC".into(), 1));
    }

    #[test]
    fn test_new_venues_per_month() {
        let checkins = vec![
            ci("1","SF","v1",day(2024,1,5)),
            ci("2","SF","v1",day(2024,1,10)), // repeat v1 — doesn't count
            ci("3","SF","v2",day(2024,1,15)),
            ci("4","SF","v3",day(2024,2,10)),
        ];
        let r = new_venues_per_month(&checkins);
        let jan = r.iter().find(|(m,_)| m=="2024-01").map(|(_,n)| *n);
        let feb = r.iter().find(|(m,_)| m=="2024-02").map(|(_,n)| *n);
        assert_eq!(jan, Some(2));
        assert_eq!(feb, Some(1));
    }
}
```

- [ ] **Step 6: Run tests, verify fail**

```bash
cd src-tauri && cargo test stats::tests 2>&1 | tail -5
```

- [ ] **Step 7: Implement stat functions**

```rust
pub fn longest_streak(timestamps: &[i64]) -> StreakResult {
    if timestamps.is_empty() {
        return StreakResult { days: 0, start_ts: None, end_ts: None };
    }
    let mut days: Vec<i64> = timestamps.iter().map(|ts| ts / 86400).collect();
    days.sort_unstable();
    days.dedup();

    let (mut max, mut curr) = (1u32, 1u32);
    let (mut max_start, mut max_end, mut curr_start) = (days[0], days[0], days[0]);

    for i in 1..days.len() {
        if days[i] == days[i-1] + 1 {
            curr += 1;
            if curr > max { max = curr; max_start = curr_start; max_end = days[i]; }
        } else {
            curr = 1; curr_start = days[i];
        }
    }
    StreakResult { days: max, start_ts: Some(max_start * 86400), end_ts: Some(max_end * 86400) }
}

pub fn top_cities(checkins: &[CheckIn], limit: usize) -> Vec<(String, usize)> {
    let mut counts: HashMap<String, usize> = HashMap::new();
    for c in checkins {
        if let Some(city) = &c.venue_city {
            *counts.entry(city.clone()).or_insert(0) += 1;
        }
    }
    let mut pairs: Vec<_> = counts.into_iter().collect();
    pairs.sort_by(|a,b| b.1.cmp(&a.1));
    pairs.truncate(limit);
    pairs
}

pub fn checkins_per_month(checkins: &[CheckIn]) -> Vec<(String, usize)> {
    let mut counts: HashMap<String, usize> = HashMap::new();
    for c in checkins { *counts.entry(fmt_month(c.checked_in_at)).or_insert(0) += 1; }
    let mut pairs: Vec<_> = counts.into_iter().collect();
    pairs.sort_by(|a,b| a.0.cmp(&b.0));
    pairs
}

pub fn new_venues_per_month(checkins: &[CheckIn]) -> Vec<(String, usize)> {
    let mut sorted = checkins.to_vec();
    sorted.sort_by_key(|c| c.checked_in_at);
    let mut first: HashMap<String, String> = HashMap::new();
    for c in &sorted {
        if let Some(vid) = &c.venue_id {
            first.entry(vid.clone()).or_insert_with(|| fmt_month(c.checked_in_at));
        }
    }
    let mut counts: HashMap<String, usize> = HashMap::new();
    for month in first.values() { *counts.entry(month.clone()).or_insert(0) += 1; }
    let mut pairs: Vec<_> = counts.into_iter().collect();
    pairs.sort_by(|a,b| a.0.cmp(&b.0));
    pairs
}
```

- [ ] **Step 8: Run tests, verify pass**

```bash
cd src-tauri && cargo test stats::tests 2>&1 | tail -8
```

Expected: 6 tests pass.

- [ ] **Step 9: Commit**

```bash
git add src-tauri/src/swarm.rs src-tauri/src/stats.rs
git commit -m "feat: Swarm API client and stats calculation functions"
```

---

## Task 6: Sync Command + Wire Up lib.rs

**Files:**
- Replace: `src-tauri/src/commands/sync.rs`
- Replace: `src-tauri/src/lib.rs`
- Replace: `src-tauri/src/main.rs`

- [ ] **Step 1: Replace `src-tauri/src/commands/sync.rs`**

```rust
use crate::{
    commands::{checkins::save_checkins_inner, prefs::get_sync_state_inner},
    db::DbPool, keychain, models::SyncProgress, swarm,
};
use reqwest::Client;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};

const PAGE_SIZE: u32 = 250;

#[tauri::command]
pub async fn start_sync(app: AppHandle, pool: State<'_, DbPool>) -> Result<(), String> {
    let token = keychain::get_token()?.ok_or("Not authenticated")?;
    let sync_state = get_sync_state_inner(&pool).await?;
    let client = Client::new();
    if !sync_state.bulk_load_complete {
        bulk_load(&app, &pool, &client, &token).await
    } else {
        incremental_sync(&app, &pool, &client, &token, sync_state.last_sync_at).await
    }
}

async fn bulk_load(app: &AppHandle, pool: &DbPool, client: &Client, token: &str) -> Result<(), String> {
    let mut offset = 0u32;
    let mut total = u32::MAX;
    while offset < total {
        let (checkins, count) = fetch_with_backoff(client, token, PAGE_SIZE, offset, None).await?;
        total = count;
        let newest = checkins.iter().map(|c| c.checked_in_at).max();
        save_checkins_inner(pool, &checkins).await?;
        offset += checkins.len() as u32;
        let loaded = offset.min(total);
        app.emit("sync-progress", SyncProgress { loaded, total }).map_err(|e| e.to_string())?;
        if let Some(ts) = newest {
            sqlx::query("UPDATE sync_state SET last_sync_at=MAX(COALESCE(last_sync_at,0),?),total_fetched=? WHERE id=1")
                .bind(ts).bind(loaded as i64)
                .execute(pool).await.map_err(|e| e.to_string())?;
        }
        if checkins.is_empty() { break; }
    }
    sqlx::query("UPDATE sync_state SET bulk_load_complete=1,total_fetched=? WHERE id=1")
        .bind(total as i64).execute(pool).await.map_err(|e| e.to_string())?;
    app.emit("sync-complete", ()).map_err(|e| e.to_string())
}

async fn incremental_sync(app: &AppHandle, pool: &DbPool, client: &Client, token: &str, last_sync_at: Option<i64>) -> Result<(), String> {
    let mut offset = 0u32;
    loop {
        let (checkins, _) = fetch_with_backoff(client, token, PAGE_SIZE, offset, last_sync_at).await?;
        if checkins.is_empty() { break; }
        let newest = checkins.iter().map(|c| c.checked_in_at).max();
        save_checkins_inner(pool, &checkins).await?;
        if let Some(ts) = newest {
            sqlx::query("UPDATE sync_state SET last_sync_at=MAX(COALESCE(last_sync_at,0),?) WHERE id=1")
                .bind(ts).execute(pool).await.map_err(|e| e.to_string())?;
        }
        offset += checkins.len() as u32;
    }
    app.emit("sync-complete", ()).map_err(|e| e.to_string())
}

async fn fetch_with_backoff(client: &Client, token: &str, limit: u32, offset: u32, after: Option<i64>) -> Result<(Vec<crate::models::CheckIn>, u32), String> {
    let mut delay = Duration::from_secs(2);
    for attempt in 0..5u32 {
        match swarm::fetch_page(client, token, limit, offset, after).await {
            Ok(r) => return Ok(r),
            Err(e) if e == "rate_limited" => {
                if attempt == 4 { return Err("Rate limit exceeded after 5 retries".into()); }
                tokio::time::sleep(delay).await;
                delay *= 2;
            }
            Err(e) => return Err(e),
        }
    }
    unreachable!()
}
```

- [ ] **Step 2: Replace `src-tauri/src/lib.rs`**

```rust
pub mod commands;
pub mod db;
pub mod keychain;
pub mod models;
pub mod stats;
pub mod swarm;

use db::DbPool;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&app_dir)?;
            let pool: DbPool = tauri::async_runtime::block_on(
                db::init_pool(&app_dir.join("swarm.db"))
            ).expect("Failed to initialize database");
            app.manage(pool);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::auth::check_auth_status,
            commands::auth::start_oauth,
            commands::auth::sign_out,
            commands::checkins::get_checkins,
            commands::checkins::save_checkins,
            commands::checkins::clear_checkins,
            commands::prefs::get_prefs,
            commands::prefs::save_prefs,
            commands::prefs::get_sync_state,
            commands::prefs::update_sync_state,
            commands::sync::start_sync,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Replace `src-tauri/src/main.rs`**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
fn main() { swarm_viewer_lib::run(); }
```

- [ ] **Step 4: Build check**

```bash
cd src-tauri && FOURSQUARE_CLIENT_ID=test FOURSQUARE_CLIENT_SECRET=test cargo build 2>&1 | tail -5
```

Expected: `Finished` — no errors.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/ && git commit -m "feat: sync command and complete Rust backend wiring"
```

---

## Task 7: TypeScript Types + Zustand Store

**Files:**
- Create: `src/types/index.ts`
- Create: `src/store/index.ts`
- Create: `src/hooks/useFilteredCheckins.ts`

- [ ] **Step 1: Create `src/types/index.ts`**

```typescript
export interface CheckIn {
  id: string
  venue_id: string | null
  venue_name: string
  venue_address: string | null
  venue_city: string | null
  venue_country: string | null
  venue_category: string | null
  lat: number | null
  lng: number | null
  checked_in_at: number  // Unix timestamp
  note: string | null
  swarm_url: string | null
}

export interface Prefs {
  show_categories: boolean
  show_notes: boolean
  map_lat: number
  map_lng: number
  map_zoom: number
}

export interface SyncState {
  last_sync_at: number | null
  total_fetched: number
  bulk_load_complete: boolean
}

export interface SyncProgress {
  loaded: number
  total: number
}

export interface Filters {
  dateRange: { start: number | null; end: number | null }
  city: string | null
}

export type AppView = 'connect' | 'loading' | 'main'
export type PanelView = 'timeline' | 'stats'
```

- [ ] **Step 2: Write failing store test**

Create `src/store/index.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './index'
import { act } from '@testing-library/react'

describe('useAppStore', () => {
  beforeEach(() => useAppStore.setState(useAppStore.getInitialState()))

  it('sets search query', () => {
    act(() => useAppStore.getState().setSearchQuery('coffee'))
    expect(useAppStore.getState().searchQuery).toBe('coffee')
  })

  it('sets selected checkin', () => {
    act(() => useAppStore.getState().setSelectedCheckinId('abc123'))
    expect(useAppStore.getState().selectedCheckinId).toBe('abc123')
  })

  it('clears filters', () => {
    act(() => {
      useAppStore.getState().setFilters({ dateRange: { start: 100, end: 200 }, city: 'SF' })
      useAppStore.getState().clearFilters()
    })
    const { filters } = useAppStore.getState()
    expect(filters.city).toBeNull()
    expect(filters.dateRange.start).toBeNull()
  })
})
```

- [ ] **Step 3: Run test, verify fail**

```bash
npm test -- --run src/store/index.test.ts 2>&1 | tail -10
```

Expected: FAILED — `useAppStore` not found.

- [ ] **Step 4: Create `src/store/index.ts`**

```typescript
import { create } from 'zustand'
import type { CheckIn, Prefs, SyncProgress, Filters, AppView, PanelView } from '../types'

interface AppState {
  // Data
  checkins: CheckIn[]
  prefs: Prefs
  // UI
  appView: AppView
  panelView: PanelView
  selectedCheckinId: string | null
  searchQuery: string
  filters: Filters
  syncProgress: SyncProgress | null
  // Actions
  setCheckins: (checkins: CheckIn[]) => void
  setPrefs: (prefs: Prefs) => void
  setAppView: (view: AppView) => void
  setPanelView: (view: PanelView) => void
  setSelectedCheckinId: (id: string | null) => void
  setSearchQuery: (q: string) => void
  setFilters: (f: Filters) => void
  clearFilters: () => void
  setSyncProgress: (p: SyncProgress | null) => void
}

const DEFAULT_FILTERS: Filters = { dateRange: { start: null, end: null }, city: null }
const DEFAULT_PREFS: Prefs = { show_categories: true, show_notes: true, map_lat: 0, map_lng: 0, map_zoom: 3 }

export const useAppStore = create<AppState>()((set) => ({
  checkins: [],
  prefs: DEFAULT_PREFS,
  appView: 'connect',
  panelView: 'timeline',
  selectedCheckinId: null,
  searchQuery: '',
  filters: DEFAULT_FILTERS,
  syncProgress: null,
  setCheckins: (checkins) => set({ checkins }),
  setPrefs: (prefs) => set({ prefs }),
  setAppView: (appView) => set({ appView }),
  setPanelView: (panelView) => set({ panelView }),
  setSelectedCheckinId: (selectedCheckinId) => set({ selectedCheckinId }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setFilters: (filters) => set({ filters }),
  clearFilters: () => set({ filters: DEFAULT_FILTERS }),
  setSyncProgress: (syncProgress) => set({ syncProgress }),
}))

// Expose getInitialState for test resets
;(useAppStore as any).getInitialState = () => ({
  checkins: [], prefs: DEFAULT_PREFS, appView: 'connect' as AppView,
  panelView: 'timeline' as PanelView, selectedCheckinId: null,
  searchQuery: '', filters: DEFAULT_FILTERS, syncProgress: null,
})
```

- [ ] **Step 5: Run test, verify pass**

```bash
npm test -- --run src/store/index.test.ts 2>&1 | tail -5
```

Expected: 3 tests pass.

- [ ] **Step 6: Write failing test for `useFilteredCheckins`**

Create `src/hooks/useFilteredCheckins.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../store'
import { filterCheckins } from './useFilteredCheckins'
import type { CheckIn } from '../types'

const ci = (id: string, name: string, city: string, ts: number, note?: string): CheckIn => ({
  id, venue_id: null, venue_name: name, venue_address: null, venue_city: city,
  venue_country: null, venue_category: null, lat: null, lng: null,
  checked_in_at: ts, note: note ?? null, swarm_url: null,
})

describe('filterCheckins', () => {
  const checkins = [
    ci('1', 'Blue Bottle', 'San Francisco', 1000),
    ci('2', 'Tartine', 'San Francisco', 2000, 'great croissants'),
    ci('3', 'Russ & Daughters', 'New York', 3000),
  ]

  it('filters by search query on venue name', () => {
    const result = filterCheckins(checkins, 'blue', { dateRange: { start: null, end: null }, city: null })
    expect(result.map(c => c.id)).toEqual(['1'])
  })

  it('filters by search query on note', () => {
    const result = filterCheckins(checkins, 'croissant', { dateRange: { start: null, end: null }, city: null })
    expect(result.map(c => c.id)).toEqual(['2'])
  })

  it('filters by city', () => {
    const result = filterCheckins(checkins, '', { dateRange: { start: null, end: null }, city: 'New York' })
    expect(result.map(c => c.id)).toEqual(['3'])
  })

  it('filters by date range', () => {
    const result = filterCheckins(checkins, '', { dateRange: { start: 1500, end: 2500 }, city: null })
    expect(result.map(c => c.id)).toEqual(['2'])
  })

  it('returns all when no filters', () => {
    expect(filterCheckins(checkins, '', { dateRange: { start: null, end: null }, city: null })).toHaveLength(3)
  })
})
```

- [ ] **Step 7: Run test, verify fail**

```bash
npm test -- --run src/hooks/useFilteredCheckins.test.ts 2>&1 | tail -5
```

- [ ] **Step 8: Create `src/hooks/useFilteredCheckins.ts`**

```typescript
import { useMemo } from 'react'
import { useAppStore } from '../store'
import type { CheckIn, Filters } from '../types'

export function filterCheckins(checkins: CheckIn[], query: string, filters: Filters): CheckIn[] {
  let result = checkins
  if (query) {
    const q = query.toLowerCase()
    result = result.filter(c =>
      c.venue_name.toLowerCase().includes(q) ||
      c.venue_city?.toLowerCase().includes(q) ||
      c.note?.toLowerCase().includes(q)
    )
  }
  if (filters.city) {
    result = result.filter(c => c.venue_city === filters.city)
  }
  if (filters.dateRange.start !== null) {
    result = result.filter(c => c.checked_in_at >= filters.dateRange.start!)
  }
  if (filters.dateRange.end !== null) {
    result = result.filter(c => c.checked_in_at <= filters.dateRange.end!)
  }
  return result
}

export function useFilteredCheckins(): CheckIn[] {
  const checkins = useAppStore(s => s.checkins)
  const query = useAppStore(s => s.searchQuery)
  const filters = useAppStore(s => s.filters)
  return useMemo(() => filterCheckins(checkins, query, filters), [checkins, query, filters])
}
```

- [ ] **Step 9: Run all tests, verify pass**

```bash
npm test -- --run 2>&1 | tail -5
```

Expected: All tests pass.

- [ ] **Step 10: Commit**

```bash
git add src/ && git commit -m "feat: TypeScript types, Zustand store, filter hook"
```

---

## Task 8: Tauri Event Bridge + App Router

**Files:**
- Create: `src/hooks/useTauriEvents.ts`
- Replace: `src/App.tsx`

- [ ] **Step 1: Create `src/hooks/useTauriEvents.ts`**

```typescript
import { useEffect } from 'react'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { useAppStore } from '../store'
import type { CheckIn, Prefs, SyncProgress } from '../types'

export function useTauriEvents() {
  const { setCheckins, setPrefs, setAppView, setSyncProgress } = useAppStore()

  useEffect(() => {
    let unlistenProgress: (() => void) | undefined
    let unlistenComplete: (() => void) | undefined

    async function init() {
      // Check auth
      const isAuthed = await invoke<boolean>('check_auth_status')
      if (!isAuthed) { setAppView('connect'); return }

      // Load cached data immediately
      const [checkins, prefs] = await Promise.all([
        invoke<CheckIn[]>('get_checkins'),
        invoke<Prefs>('get_prefs'),
      ])
      setCheckins(checkins)
      setPrefs(prefs)

      // Subscribe to sync events before starting sync
      unlistenProgress = await listen<SyncProgress>('sync-progress', (e) => {
        setSyncProgress(e.payload)
        if (checkins.length === 0) setAppView('loading')
      })

      unlistenComplete = await listen<void>('sync-complete', async () => {
        const updated = await invoke<CheckIn[]>('get_checkins')
        setCheckins(updated)
        setSyncProgress(null)
        setAppView('main')
      })

      // Show main if we already have data, otherwise show loading
      setAppView(checkins.length > 0 ? 'main' : 'loading')

      // Start sync (background)
      invoke('start_sync').catch(console.error)
    }

    init().catch(console.error)

    return () => {
      unlistenProgress?.()
      unlistenComplete?.()
    }
  }, [])
}
```

- [ ] **Step 2: Replace `src/App.tsx`**

```tsx
import { useTauriEvents } from './hooks/useTauriEvents'
import { useAppStore } from './store'
import ConnectScreen from './components/ConnectScreen'
import LoadingScreen from './components/LoadingScreen'
import Shell from './components/Shell'

export default function App() {
  useTauriEvents()
  const appView = useAppStore(s => s.appView)

  if (appView === 'connect') return <ConnectScreen />
  if (appView === 'loading') return <LoadingScreen />
  return <Shell />
}
```

- [ ] **Step 3: Create placeholder components so the app compiles**

`src/components/ConnectScreen.tsx`:
```tsx
export default function ConnectScreen() {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
    <div>
      <h1>Swarm Viewer</h1>
      <button onClick={() => {}}>Connect to Swarm</button>
    </div>
  </div>
}
```

`src/components/LoadingScreen.tsx`:
```tsx
export default function LoadingScreen() {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
    <p>Loading check-ins…</p>
  </div>
}
```

`src/components/Shell.tsx`:
```tsx
export default function Shell() {
  return <div style={{ height: '100vh' }}>Shell</div>
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run build 2>&1 | tail -10
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/ && git commit -m "feat: Tauri event bridge, app router, placeholder components"
```

---

## Task 9: Connect Screen + Loading Screen

**Files:**
- Replace: `src/components/ConnectScreen.tsx`
- Replace: `src/components/LoadingScreen.tsx`

- [ ] **Step 1: Write test for ConnectScreen**

Create `src/components/ConnectScreen.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import ConnectScreen from './ConnectScreen'

describe('ConnectScreen', () => {
  it('renders connect button', () => {
    render(<ConnectScreen />)
    expect(screen.getByRole('button', { name: /connect to swarm/i })).toBeInTheDocument()
  })

  it('calls start_oauth on click', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined)
    render(<ConnectScreen />)
    fireEvent.click(screen.getByRole('button', { name: /connect to swarm/i }))
    expect(invoke).toHaveBeenCalledWith('start_oauth')
  })
})
```

- [ ] **Step 2: Run test, verify fail**

```bash
npm test -- --run src/components/ConnectScreen.test.tsx 2>&1 | tail -5
```

- [ ] **Step 3: Replace `src/components/ConnectScreen.tsx`**

```tsx
import { invoke } from '@tauri-apps/api/core'
import { useState } from 'react'
import { useAppStore } from '../store'

export default function ConnectScreen() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setAppView = useAppStore(s => s.setAppView)

  async function handleConnect() {
    setLoading(true)
    setError(null)
    try {
      await invoke('start_oauth')
      setAppView('loading')
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', gap: '16px',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ fontSize: '48px' }}>📍</div>
      <h1 style={{ margin: 0, fontSize: '24px' }}>Swarm Viewer</h1>
      <p style={{ margin: 0, color: 'var(--color-muted, #888)', textAlign: 'center', maxWidth: '320px' }}>
        Connect your Foursquare account to explore your check-in history.
      </p>
      {error && <p style={{ color: 'red', fontSize: '14px' }}>{error}</p>}
      <button
        onClick={handleConnect}
        disabled={loading}
        style={{
          padding: '10px 24px', fontSize: '16px', borderRadius: '8px',
          background: '#F4845F', color: '#fff', border: 'none',
          cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? 'Opening browser…' : 'Connect to Swarm'}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Write test for LoadingScreen**

Create `src/components/LoadingScreen.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import LoadingScreen from './LoadingScreen'
import { useAppStore } from '../store'

describe('LoadingScreen', () => {
  it('shows progress when available', () => {
    useAppStore.setState({ syncProgress: { loaded: 142, total: 600 } })
    render(<LoadingScreen />)
    expect(screen.getByText(/142.*600/)).toBeInTheDocument()
  })

  it('shows generic message when no progress yet', () => {
    useAppStore.setState({ syncProgress: null })
    render(<LoadingScreen />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Run tests, verify fail**

```bash
npm test -- --run src/components/LoadingScreen.test.tsx 2>&1 | tail -5
```

- [ ] **Step 6: Replace `src/components/LoadingScreen.tsx`**

```tsx
import { useAppStore } from '../store'

export default function LoadingScreen() {
  const progress = useAppStore(s => s.syncProgress)
  const pct = progress ? Math.round((progress.loaded / progress.total) * 100) : 0

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', gap: '16px',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{ fontSize: '32px' }}>📍</div>
      <h2 style={{ margin: 0 }}>Loading your check-ins…</h2>
      {progress && (
        <>
          <div style={{
            width: '300px', height: '8px', background: 'var(--color-muted-bg, #eee)', borderRadius: '4px', overflow: 'hidden'
          }}>
            <div style={{ width: `${pct}%`, height: '100%', background: '#F4845F', transition: 'width 0.3s' }} />
          </div>
          <p style={{ margin: 0, color: 'var(--color-muted, #888)', fontSize: '14px' }}>
            Loading {progress.loaded} of {progress.total} check-ins
          </p>
        </>
      )}
      {!progress && <p style={{ color: 'var(--color-muted, #888)' }}>Connecting…</p>}
    </div>
  )
}
```

- [ ] **Step 7: Run all tests, verify pass**

```bash
npm test -- --run 2>&1 | tail -5
```

- [ ] **Step 8: Commit**

```bash
git add src/ && git commit -m "feat: ConnectScreen and LoadingScreen components"
```

---

## Task 10: Shell + Toolbar

**Files:**
- Replace: `src/components/Shell.tsx`
- Create: `src/components/Toolbar.tsx`
- Create: `src/components/FilterChips.tsx`
- Create: `src/components/SettingsMenu.tsx`

- [ ] **Step 1: Write test for Toolbar**

Create `src/components/Toolbar.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import Toolbar from './Toolbar'
import { useAppStore } from '../store'

describe('Toolbar', () => {
  it('updates search query on input', () => {
    render(<Toolbar />)
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'coffee' } })
    expect(useAppStore.getState().searchQuery).toBe('coffee')
  })

  it('switches to stats panel on Stats click', () => {
    render(<Toolbar />)
    fireEvent.click(screen.getByRole('button', { name: /stats/i }))
    expect(useAppStore.getState().panelView).toBe('stats')
  })

  it('calls start_sync on refresh click', () => {
    vi.mocked(invoke).mockResolvedValue(undefined)
    render(<Toolbar />)
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))
    expect(invoke).toHaveBeenCalledWith('start_sync')
  })
})
```

- [ ] **Step 2: Run test, verify fail**

```bash
npm test -- --run src/components/Toolbar.test.tsx 2>&1 | tail -5
```

- [ ] **Step 3: Create `src/components/Toolbar.tsx`**

```tsx
import { invoke } from '@tauri-apps/api/core'
import { useAppStore } from '../store'
import FilterChips from './FilterChips'
import SettingsMenu from './SettingsMenu'

export default function Toolbar() {
  const { searchQuery, setSearchQuery, panelView, setPanelView } = useAppStore()

  function handleRefresh() {
    invoke('start_sync').catch(console.error)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
      borderBottom: '1px solid var(--color-border, #e5e7eb)',
      background: 'var(--color-surface, #fff)', flexShrink: 0,
    }}>
      <span style={{ fontWeight: 700, color: '#F4845F', marginRight: '4px' }}>◉ Swarm</span>
      <input
        type="search"
        placeholder="Search check-ins…"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        style={{
          flex: 1, padding: '6px 10px', borderRadius: '6px',
          border: '1px solid var(--color-border, #e5e7eb)',
          background: 'var(--color-input-bg, #f9fafb)', fontSize: '14px',
        }}
      />
      <FilterChips />
      <button
        onClick={() => setPanelView(panelView === 'stats' ? 'timeline' : 'stats')}
        aria-label="Stats"
        style={{
          padding: '6px 12px', borderRadius: '6px', fontSize: '13px',
          border: '1px solid var(--color-border, #e5e7eb)',
          background: panelView === 'stats' ? '#F4845F' : 'var(--color-surface, #fff)',
          color: panelView === 'stats' ? '#fff' : 'inherit',
          cursor: 'pointer',
        }}
      >
        Stats
      </button>
      <button onClick={handleRefresh} aria-label="Refresh" style={{
        padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--color-border, #e5e7eb)',
        background: 'var(--color-surface, #fff)', cursor: 'pointer', fontSize: '14px',
      }}>↻</button>
      <SettingsMenu />
    </div>
  )
}
```

- [ ] **Step 4: Create `src/components/FilterChips.tsx`**

```tsx
import { useAppStore } from '../store'

export default function FilterChips() {
  const { filters, clearFilters, setFilters } = useAppStore()
  const chips: { label: string; onRemove: () => void }[] = []

  if (filters.city) {
    chips.push({ label: filters.city, onRemove: () => setFilters({ ...filters, city: null }) })
  }
  if (filters.dateRange.start || filters.dateRange.end) {
    chips.push({ label: 'Date range', onRemove: () => setFilters({ ...filters, dateRange: { start: null, end: null } }) })
  }

  if (chips.length === 0) return null

  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      {chips.map((chip) => (
        <span key={chip.label} style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: '2px 8px', borderRadius: '12px', fontSize: '12px',
          background: '#FEF3C7', color: '#92400E',
        }}>
          {chip.label}
          <button onClick={chip.onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', fontSize: '12px', lineHeight: 1 }}>×</button>
        </span>
      ))}
      <button onClick={clearFilters} style={{ fontSize: '12px', color: '#888', background: 'none', border: 'none', cursor: 'pointer' }}>
        Clear all
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Create `src/components/SettingsMenu.tsx`**

```tsx
import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { useAppStore } from '../store'

export default function SettingsMenu() {
  const [open, setOpen] = useState(false)
  const { prefs, setPrefs, setAppView, setCheckins } = useAppStore()

  async function handleToggle(key: 'show_categories' | 'show_notes') {
    const updated = { ...prefs, [key]: !prefs[key] }
    setPrefs(updated)
    await invoke('save_prefs', { prefs: updated }).catch(console.error)
  }

  async function handleSignOut() {
    await invoke('sign_out').catch(console.error)
    setCheckins([])
    setAppView('connect')
    setOpen(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Settings"
        style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--color-border, #e5e7eb)', background: 'var(--color-surface, #fff)', cursor: 'pointer', fontSize: '14px' }}
      >
        ⚙
      </button>
      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '100%', marginTop: '4px',
          background: 'var(--color-surface, #fff)', border: '1px solid var(--color-border, #e5e7eb)',
          borderRadius: '8px', padding: '8px', minWidth: '200px', zIndex: 100,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        }}>
          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 4px', cursor: 'pointer', fontSize: '14px' }}>
            Show categories
            <input type="checkbox" checked={prefs.show_categories} onChange={() => handleToggle('show_categories')} />
          </label>
          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 4px', cursor: 'pointer', fontSize: '14px' }}>
            Show notes
            <input type="checkbox" checked={prefs.show_notes} onChange={() => handleToggle('show_notes')} />
          </label>
          <hr style={{ margin: '6px 0', border: 'none', borderTop: '1px solid var(--color-border, #e5e7eb)' }} />
          <button onClick={handleSignOut} style={{ width: '100%', padding: '6px', fontSize: '14px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Replace `src/components/Shell.tsx`**

```tsx
import Toolbar from './Toolbar'
import MapPanel from './MapPanel'
import TimelinePanel from './TimelinePanel'
import StatsPanel from './StatsPanel'
import { useAppStore } from '../store'

export default function Shell() {
  const panelView = useAppStore(s => s.panelView)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Toolbar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: '0 0 60%', position: 'relative' }}>
          <MapPanel />
        </div>
        <div style={{ flex: '0 0 40%', overflow: 'hidden', borderLeft: '1px solid var(--color-border, #e5e7eb)' }}>
          {panelView === 'timeline' ? <TimelinePanel /> : <StatsPanel />}
        </div>
      </div>
    </div>
  )
}
```

Add placeholder `MapPanel`, `TimelinePanel`, `StatsPanel`:

`src/components/MapPanel.tsx`: `export default function MapPanel() { return <div style={{height:'100%',background:'#e8e0d8'}} /> }`
`src/components/TimelinePanel.tsx`: `export default function TimelinePanel() { return <div>Timeline</div> }`
`src/components/StatsPanel.tsx`: `export default function StatsPanel() { return <div>Stats</div> }`

- [ ] **Step 7: Run tests, verify pass**

```bash
npm test -- --run 2>&1 | tail -5
```

- [ ] **Step 8: Commit**

```bash
git add src/ && git commit -m "feat: Shell layout, Toolbar, FilterChips, SettingsMenu"
```

---

## Task 11: Google Maps Panel + Detail Card

**Files:**
- Replace: `src/components/MapPanel.tsx`
- Create: `src/components/DetailCard.tsx`

- [ ] **Step 1: Create `src/components/DetailCard.tsx`**

```tsx
import { useAppStore } from '../store'
import type { CheckIn } from '../types'

interface Props {
  checkin: CheckIn
  onClose: () => void
}

export default function DetailCard({ checkin, onClose }: Props) {
  const prefs = useAppStore(s => s.prefs)
  const date = new Date(checkin.checked_in_at * 1000).toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div style={{
      background: 'var(--color-surface, #fff)', borderRadius: '8px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.15)', padding: '16px', minWidth: '240px', maxWidth: '300px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <strong style={{ fontSize: '15px', lineHeight: '1.3' }}>{checkin.venue_name}</strong>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#888', padding: '0 0 0 8px' }}>×</button>
      </div>
      {checkin.venue_address && <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#888' }}>{checkin.venue_address}</p>}
      <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#888' }}>{date}</p>
      {prefs.show_categories && checkin.venue_category && (
        <span style={{ display: 'inline-block', fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: '#FEF3C7', color: '#92400E', marginBottom: '8px' }}>
          {checkin.venue_category}
        </span>
      )}
      {prefs.show_notes && checkin.note && (
        <p style={{ margin: '0 0 8px', fontSize: '13px', fontStyle: 'italic', color: '#555' }}>"{checkin.note}"</p>
      )}
      <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
        {checkin.venue_city && checkin.lat && checkin.lng && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${checkin.lat},${checkin.lng}`}
            target="_blank" rel="noreferrer"
            style={{ color: '#F4845F' }}
          >
            Open in Maps
          </a>
        )}
        {checkin.swarm_url && (
          <a href={checkin.swarm_url} target="_blank" rel="noreferrer" style={{ color: '#F4845F' }}>
            View on Swarm
          </a>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace `src/components/MapPanel.tsx`**

```tsx
import { useEffect, useRef, useState, useCallback } from 'react'
import { Loader } from '@googlemaps/js-api-loader'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import { useAppStore } from '../store'
import { useFilteredCheckins } from '../hooks/useFilteredCheckins'
import DetailCard from './DetailCard'
import type { CheckIn } from '../types'

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string

const DARK_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#1a2535' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0f1923' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ab4c8' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d4a6e' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#162a3a' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a3a2a' }] },
]

export default function MapPanel() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<google.maps.Map | null>(null)
  const clusterer = useRef<MarkerClusterer | null>(null)
  const markers = useRef<Map<string, google.maps.Marker>>(new Map())
  const [selectedCheckin, setSelectedCheckin] = useState<CheckIn | null>(null)
  const [cardPos, setCardPos] = useState<{ x: number; y: number } | null>(null)
  const filteredCheckins = useFilteredCheckins()
  const { prefs, selectedCheckinId, setSelectedCheckinId } = useAppStore()

  // Detect OS dark mode
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return
    if (!MAPS_KEY) {
      console.error('Google Maps API key not configured — set VITE_GOOGLE_MAPS_API_KEY')
      return
    }

    const loader = new Loader({ apiKey: MAPS_KEY, version: 'weekly' })
    loader.load().then(() => {
      mapInstance.current = new google.maps.Map(mapRef.current!, {
        center: { lat: prefs.map_lat || 20, lng: prefs.map_lng || 0 },
        zoom: prefs.map_zoom || 2,
        styles: prefersDark ? DARK_STYLES : [],
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      })
      clusterer.current = new MarkerClusterer({ map: mapInstance.current })
    })
  }, [])

  // Sync markers when filtered checkins change
  useEffect(() => {
    if (!mapInstance.current || !clusterer.current) return
    // Remove old markers
    clusterer.current.clearMarkers()
    markers.current.clear()

    const newMarkers = filteredCheckins
      .filter(c => c.lat !== null && c.lng !== null)
      .map(c => {
        const marker = new google.maps.Marker({
          position: { lat: c.lat!, lng: c.lng! },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#F4845F',
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2,
          },
        })
        marker.addListener('click', (e: google.maps.MapMouseEvent) => {
          setSelectedCheckin(c)
          setSelectedCheckinId(c.id)
          if (e.domEvent) {
            const rect = mapRef.current!.getBoundingClientRect()
            setCardPos({ x: (e.domEvent as MouseEvent).clientX - rect.left, y: (e.domEvent as MouseEvent).clientY - rect.top })
          }
        })
        markers.current.set(c.id, marker)
        return marker
      })

    clusterer.current.addMarkers(newMarkers)
  }, [filteredCheckins])

  // Pan to selected checkin when changed from timeline
  useEffect(() => {
    if (!selectedCheckinId || !mapInstance.current) return
    const checkin = filteredCheckins.find(c => c.id === selectedCheckinId)
    if (checkin?.lat && checkin?.lng) {
      mapInstance.current.panTo({ lat: checkin.lat, lng: checkin.lng })
      setSelectedCheckin(checkin)
    }
  }, [selectedCheckinId])

  const errorMsg = !MAPS_KEY ? (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '24px', textAlign: 'center', color: '#888' }}>
      Google Maps API key not configured — set <code>VITE_GOOGLE_MAPS_API_KEY</code> in your <code>.env</code> file.
    </div>
  ) : null

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      {errorMsg || <div ref={mapRef} style={{ height: '100%' }} />}
      {selectedCheckin && cardPos && (
        <div style={{ position: 'absolute', left: cardPos.x + 12, top: cardPos.y - 12, zIndex: 10 }}>
          <DetailCard
            checkin={selectedCheckin}
            onClose={() => { setSelectedCheckin(null); setSelectedCheckinId(null); setCardPos(null) }}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Compile check**

```bash
npm run build 2>&1 | tail -10
```

Expected: Build succeeds. (Map won't render without API key in `.env`.)

- [ ] **Step 4: Commit**

```bash
git add src/components/ && git commit -m "feat: Google Maps panel with pin markers, clustering, and detail card"
```

---

## Task 12: Timeline Panel

**Files:**
- Replace: `src/components/TimelinePanel.tsx`
- Create: `src/components/TimelineRow.tsx`

- [ ] **Step 1: Write tests for TimelinePanel**

Create `src/components/TimelinePanel.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import TimelinePanel from './TimelinePanel'
import { useAppStore } from '../store'
import type { CheckIn } from '../types'

const ci = (id: string, name: string, city: string, ts: number): CheckIn => ({
  id, venue_id: null, venue_name: name, venue_address: null, venue_city: city,
  venue_country: null, venue_category: 'Cafe', lat: 37.7, lng: -122.4,
  checked_in_at: ts, note: 'nice', swarm_url: null,
})

describe('TimelinePanel', () => {
  it('renders venue names', () => {
    useAppStore.setState({ checkins: [ci('1', 'Blue Bottle', 'SF', 1_700_000_000)] })
    render(<TimelinePanel />)
    expect(screen.getByText('Blue Bottle')).toBeInTheDocument()
  })

  it('selects checkin on row click', () => {
    useAppStore.setState({ checkins: [ci('1', 'Tartine', 'SF', 1_700_000_000)] })
    render(<TimelinePanel />)
    fireEvent.click(screen.getByText('Tartine'))
    expect(useAppStore.getState().selectedCheckinId).toBe('1')
  })
})
```

- [ ] **Step 2: Run tests, verify fail**

```bash
npm test -- --run src/components/TimelinePanel.test.tsx 2>&1 | tail -5
```

- [ ] **Step 3: Create `src/components/TimelineRow.tsx`**

```tsx
import { useAppStore } from '../store'
import type { CheckIn } from '../types'

interface Props {
  checkin: CheckIn
  style: React.CSSProperties
}

export default function TimelineRow({ checkin, style }: Props) {
  const { selectedCheckinId, setSelectedCheckinId, prefs } = useAppStore()
  const isSelected = selectedCheckinId === checkin.id
  const date = new Date(checkin.checked_in_at * 1000).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  })

  return (
    <div
      onClick={() => setSelectedCheckinId(checkin.id)}
      style={{
        ...style,
        padding: '10px 16px',
        borderBottom: '1px solid var(--color-border, #f0f0f0)',
        cursor: 'pointer',
        background: isSelected ? '#FFF7ED' : 'var(--color-surface, #fff)',
        borderLeft: isSelected ? '3px solid #F4845F' : '3px solid transparent',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {checkin.venue_name}
      </div>
      <div style={{ fontSize: '12px', color: '#888', marginBottom: prefs.show_categories && checkin.venue_category ? '4px' : 0 }}>
        {checkin.venue_city} · {date}
      </div>
      {prefs.show_categories && checkin.venue_category && (
        <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '10px', background: '#FEF3C7', color: '#92400E' }}>
          {checkin.venue_category}
        </span>
      )}
      {prefs.show_notes && checkin.note && (
        <div style={{ fontSize: '12px', color: '#777', fontStyle: 'italic', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          "{checkin.note}"
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Replace `src/components/TimelinePanel.tsx`**

```tsx
import { FixedSizeList as List } from 'react-window'
import { useRef, useEffect } from 'react'
import { useAppStore } from '../store'
import { useFilteredCheckins } from '../hooks/useFilteredCheckins'
import TimelineRow from './TimelineRow'

const ROW_HEIGHT = 80

export default function TimelinePanel() {
  const filteredCheckins = useFilteredCheckins()
  const selectedCheckinId = useAppStore(s => s.selectedCheckinId)
  const listRef = useRef<List>(null)

  // Scroll to selected item when changed from map
  useEffect(() => {
    if (!selectedCheckinId) return
    const idx = filteredCheckins.findIndex(c => c.id === selectedCheckinId)
    if (idx >= 0) listRef.current?.scrollToItem(idx, 'smart')
  }, [selectedCheckinId])

  if (filteredCheckins.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888', flexDirection: 'column', gap: '8px' }}>
        <span style={{ fontSize: '32px' }}>🔍</span>
        <p style={{ margin: 0 }}>No check-ins match your search.</p>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      <List
        ref={listRef}
        height={window.innerHeight - 48} // subtract toolbar height
        itemCount={filteredCheckins.length}
        itemSize={ROW_HEIGHT}
        width="100%"
      >
        {({ index, style }) => (
          <TimelineRow checkin={filteredCheckins[index]} style={style} />
        )}
      </List>
    </div>
  )
}
```

- [ ] **Step 5: Run tests, verify pass**

```bash
npm test -- --run src/components/TimelinePanel.test.tsx 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ && git commit -m "feat: virtualized timeline panel with selection sync"
```

---

## Task 13: Stats Panel

**Files:**
- Replace: `src/components/StatsPanel.tsx`

Note: Stats are computed client-side from the in-memory check-in list. No Tauri call needed.

- [ ] **Step 1: Write failing test for StatsPanel**

Create `src/components/StatsPanel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import StatsPanel from './StatsPanel'
import { useAppStore } from '../store'
import type { CheckIn } from '../types'

const ci = (id: string, city: string, vid: string, ts: number): CheckIn => ({
  id, venue_id: vid, venue_name: 'P', venue_address: null, venue_city: city,
  venue_country: null, venue_category: null, lat: null, lng: null,
  checked_in_at: ts, note: null, swarm_url: null,
})

describe('StatsPanel', () => {
  it('shows total check-in count', () => {
    useAppStore.setState({ checkins: [ci('1','SF','v1',1000), ci('2','NYC','v2',2000)] })
    render(<StatsPanel />)
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows top city', () => {
    useAppStore.setState({ checkins: [ci('1','SF','v1',1000), ci('2','SF','v2',2000), ci('3','NYC','v3',3000)] })
    render(<StatsPanel />)
    expect(screen.getByText('SF')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test, verify fail**

```bash
npm test -- --run src/components/StatsPanel.test.tsx 2>&1 | tail -5
```

- [ ] **Step 3: Replace `src/components/StatsPanel.tsx`**

```tsx
import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useFilteredCheckins } from '../hooks/useFilteredCheckins'

function fmtMonth(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
}

function longestStreak(timestamps: number[]): { days: number; startTs: number | null; endTs: number | null } {
  if (!timestamps.length) return { days: 0, startTs: null, endTs: null }
  const days = [...new Set(timestamps.map(ts => Math.floor(ts / 86400)))].sort((a,b) => a-b)
  let max = 1, curr = 1, maxStart = days[0], maxEnd = days[0], currStart = days[0]
  for (let i = 1; i < days.length; i++) {
    if (days[i] === days[i-1] + 1) {
      curr++
      if (curr > max) { max = curr; maxStart = currStart; maxEnd = days[i] }
    } else { curr = 1; currStart = days[i] }
  }
  return { days: max, startTs: maxStart * 86400, endTs: maxEnd * 86400 }
}

export default function StatsPanel() {
  const checkins = useFilteredCheckins()

  const stats = useMemo(() => {
    const total = checkins.length

    // Checkins per month
    const monthMap = new Map<string, number>()
    for (const c of checkins) {
      const key = fmtMonth(c.checked_in_at)
      monthMap.set(key, (monthMap.get(key) ?? 0) + 1)
    }
    const perMonth = [...monthMap.entries()].sort((a,b) => a[0].localeCompare(b[0]))
      .map(([month, count]) => ({ month, count }))

    // Streak
    const streak = longestStreak(checkins.map(c => c.checked_in_at))
    const streakStart = streak.startTs ? new Date(streak.startTs * 1000).toLocaleDateString() : null
    const streakEnd = streak.endTs ? new Date(streak.endTs * 1000).toLocaleDateString() : null

    // Top cities
    const cityMap = new Map<string, number>()
    for (const c of checkins) {
      if (c.venue_city) cityMap.set(c.venue_city, (cityMap.get(c.venue_city) ?? 0) + 1)
    }
    const topCities = [...cityMap.entries()].sort((a,b) => b[1]-a[1]).slice(0,10)
      .map(([city, count]) => ({ city, count }))

    // New venues per month
    const firstVisit = new Map<string, string>()
    const sorted = [...checkins].sort((a,b) => a.checked_in_at - b.checked_in_at)
    for (const c of sorted) {
      if (c.venue_id && !firstVisit.has(c.venue_id)) firstVisit.set(c.venue_id, fmtMonth(c.checked_in_at))
    }
    const newVenueMap = new Map<string, number>()
    for (const month of firstVisit.values()) newVenueMap.set(month, (newVenueMap.get(month) ?? 0) + 1)
    const newVenues = [...newVenueMap.entries()].sort((a,b) => a[0].localeCompare(b[0]))
      .map(([month, count]) => ({ month, count }))

    return { total, perMonth, streak, streakStart, streakEnd, topCities, newVenues }
  }, [checkins])

  const sectionStyle: React.CSSProperties = { marginBottom: '24px' }
  const headingStyle: React.CSSProperties = { fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#888', marginBottom: '8px' }

  return (
    <div style={{ padding: '16px', overflowY: 'auto', height: '100%', boxSizing: 'border-box', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ ...sectionStyle, textAlign: 'center' }}>
        <div style={{ fontSize: '48px', fontWeight: 700, color: '#F4845F', lineHeight: 1 }}>{stats.total}</div>
        <div style={{ color: '#888', fontSize: '13px' }}>total check-ins</div>
      </div>

      <div style={sectionStyle}>
        <div style={headingStyle}>Check-ins per month</div>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={stats.perMonth} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
            <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip formatter={(v) => [v, 'check-ins']} />
            <Bar dataKey="count" fill="#F4845F" radius={[2,2,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={sectionStyle}>
        <div style={headingStyle}>Longest streak</div>
        <div style={{ fontSize: '24px', fontWeight: 700 }}>{stats.streak.days} days</div>
        {stats.streakStart && <div style={{ fontSize: '12px', color: '#888' }}>{stats.streakStart} – {stats.streakEnd}</div>}
      </div>

      <div style={sectionStyle}>
        <div style={headingStyle}>Top cities</div>
        {stats.topCities.map(({ city, count }) => (
          <div key={city} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px', borderBottom: '1px solid var(--color-border, #f0f0f0)' }}>
            <span>{city}</span>
            <span style={{ color: '#888' }}>{count}</span>
          </div>
        ))}
      </div>

      <div style={sectionStyle}>
        <div style={headingStyle}>New venues per month</div>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={stats.newVenues} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
            <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip formatter={(v) => [v, 'new venues']} />
            <Bar dataKey="count" fill="#60A5FA" radius={[2,2,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests, verify pass**

```bash
npm test -- --run src/components/StatsPanel.test.tsx 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add src/components/StatsPanel.tsx && git commit -m "feat: stats panel with charts, streak, and top cities"
```

---

## Task 14: System Theme

**Files:**
- Modify: `src/main.tsx`
- Create: `src/theme.css`

- [ ] **Step 1: Create `src/theme.css`**

```css
:root {
  --color-surface: #ffffff;
  --color-border: #e5e7eb;
  --color-muted: #6b7280;
  --color-muted-bg: #f3f4f6;
  --color-input-bg: #f9fafb;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-surface: #1f2937;
    --color-border: #374151;
    --color-muted: #9ca3af;
    --color-muted-bg: #374151;
    --color-input-bg: #111827;
  }

  body {
    background: #111827;
    color: #f9fafb;
  }
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 2: Import theme in `src/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import './theme.css'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 3: Build check**

```bash
npm run build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/main.tsx src/theme.css && git commit -m "feat: system light/dark theme via CSS variables"
```

---

## Task 15: Filter Controls

The spec requires date-range presets and city filtering. `FilterChips` (Task 10) shows/dismisses active filters, but we need a UI to SET them.

**Files:**
- Create: `src/components/FilterPanel.tsx`
- Modify: `src/components/Toolbar.tsx` — add filter button that opens FilterPanel

- [ ] **Step 1: Write test for FilterPanel**

Create `src/components/FilterPanel.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import FilterPanel from './FilterPanel'
import { useAppStore } from '../store'

describe('FilterPanel', () => {
  it('sets last 30 days preset', () => {
    render(<FilterPanel onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /last 30 days/i }))
    const { filters } = useAppStore.getState()
    expect(filters.dateRange.start).not.toBeNull()
    expect(filters.dateRange.end).not.toBeNull()
  })

  it('sets city filter', () => {
    useAppStore.setState({ checkins: [
      { id:'1', venue_id:null, venue_name:'A', venue_address:null, venue_city:'San Francisco',
        venue_country:null, venue_category:null, lat:null, lng:null, checked_in_at:1000, note:null, swarm_url:null }
    ]})
    render(<FilterPanel onClose={() => {}} />)
    fireEvent.click(screen.getByText('San Francisco'))
    expect(useAppStore.getState().filters.city).toBe('San Francisco')
  })

  it('clears all filters', () => {
    useAppStore.setState({ filters: { dateRange: { start: 1, end: 2 }, city: 'SF' } })
    render(<FilterPanel onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /all time/i }))
    const { filters } = useAppStore.getState()
    expect(filters.city).toBeNull()
    expect(filters.dateRange.start).toBeNull()
  })
})
```

- [ ] **Step 2: Run test, verify fail**

```bash
npm test -- --run src/components/FilterPanel.test.tsx 2>&1 | tail -5
```

- [ ] **Step 3: Create `src/components/FilterPanel.tsx`**

```tsx
import { useMemo } from 'react'
import { useAppStore } from '../store'
import type { Filters } from '../types'

interface Props { onClose: () => void }

const now = () => Math.floor(Date.now() / 1000)

const PRESETS: { label: string; getRange: () => { start: number | null; end: number | null } }[] = [
  { label: 'Last 30 days', getRange: () => ({ start: now() - 30 * 86400, end: now() }) },
  { label: 'Last year',    getRange: () => ({ start: now() - 365 * 86400, end: now() }) },
  { label: 'All time',     getRange: () => ({ start: null, end: null }) },
]

export default function FilterPanel({ onClose }: Props) {
  const { checkins, filters, setFilters, clearFilters } = useAppStore()

  const cities = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of checkins) {
      if (c.venue_city) counts.set(c.venue_city, (counts.get(c.venue_city) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a,b) => b[1]-a[1]).slice(0,20).map(([city]) => city)
  }, [checkins])

  function applyPreset(getRange: () => { start: number | null; end: number | null }) {
    const range = getRange()
    if (range.start === null && range.end === null) {
      clearFilters()
    } else {
      setFilters({ ...filters, dateRange: range })
    }
    onClose()
  }

  function applyCity(city: string) {
    setFilters({ ...filters, city: filters.city === city ? null : city })
    onClose()
  }

  return (
    <div style={{
      position: 'absolute', top: '100%', left: 0, marginTop: '4px',
      background: 'var(--color-surface, #fff)', border: '1px solid var(--color-border, #e5e7eb)',
      borderRadius: '8px', padding: '12px', minWidth: '220px', zIndex: 200,
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    }}>
      <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#888', marginBottom: '8px' }}>
        Date range
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => applyPreset(p.getRange)}
            style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', cursor: 'pointer',
              border: '1px solid var(--color-border, #e5e7eb)',
              background: 'var(--color-surface, #fff)' }}>
            {p.label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#888', marginBottom: '8px' }}>
        City
      </div>
      <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {cities.map(city => (
          <button key={city} onClick={() => applyCity(city)}
            style={{ textAlign: 'left', padding: '4px 8px', borderRadius: '4px', fontSize: '13px', cursor: 'pointer',
              border: 'none', background: filters.city === city ? '#FEF3C7' : 'transparent',
              color: filters.city === city ? '#92400E' : 'inherit' }}>
            {city}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add filter button to `src/components/Toolbar.tsx`**

Add `useState` import and insert the filter button between FilterChips and Stats:

```tsx
// At top of Toolbar.tsx, add:
import { useState } from 'react'
import FilterPanel from './FilterPanel'

// Inside the component, add:
const [filterOpen, setFilterOpen] = useState(false)

// In JSX, after the search input and before FilterChips:
<div style={{ position: 'relative' }}>
  <button
    onClick={() => setFilterOpen(o => !o)}
    aria-label="Filters"
    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--color-border, #e5e7eb)', background: 'var(--color-surface, #fff)', cursor: 'pointer', fontSize: '13px' }}
  >
    Filters
  </button>
  {filterOpen && <FilterPanel onClose={() => setFilterOpen(false)} />}
</div>
```

- [ ] **Step 5: Run all tests, verify pass**

```bash
npm test -- --run 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ && git commit -m "feat: filter controls for date range and city"
```

---

## Task 16: Map State Persistence

When the user pans or zooms the map, save the new position to preferences so it restores on next open.

**Files:**
- Modify: `src/components/MapPanel.tsx`

- [ ] **Step 1: Add map event listeners in MapPanel**

Inside the `useEffect` where `mapInstance.current` is created, after the map and clusterer are initialized, add:

```tsx
// Save map position on idle (after pan/zoom settles)
mapInstance.current.addListener('idle', () => {
  const center = mapInstance.current!.getCenter()
  const zoom = mapInstance.current!.getZoom()
  if (!center || zoom === undefined) return
  const updated: Prefs = {
    ...useAppStore.getState().prefs,
    map_lat: center.lat(),
    map_lng: center.lng(),
    map_zoom: zoom,
  }
  useAppStore.getState().setPrefs(updated)
  invoke('save_prefs', { prefs: updated }).catch(console.error)
})
```

Add `invoke` to the import at the top of MapPanel.tsx:
```tsx
import { invoke } from '@tauri-apps/api/core'
```

Add `Prefs` to the types import:
```tsx
import type { CheckIn, Prefs } from '../types'
```

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/MapPanel.tsx && git commit -m "feat: persist map position and zoom to preferences"
```

---

## Task 17: GitHub Actions Release Workflow + README



**Files:**
- Create: `.github/workflows/release.yml`
- Create: `README.md`

- [ ] **Step 1: Create `.github/workflows/release.yml`**

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

permissions:
  contents: write

jobs:
  release:
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: macos-latest
            args: '--target aarch64-apple-darwin'
          - platform: macos-latest
            args: '--target x86_64-apple-darwin'
          - platform: windows-latest
            args: ''

    runs-on: ${{ matrix.platform }}

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}

      - name: Install dependencies
        run: npm ci

      - name: Build and release
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          FOURSQUARE_CLIENT_ID: ${{ secrets.FOURSQUARE_CLIENT_ID }}
          FOURSQUARE_CLIENT_SECRET: ${{ secrets.FOURSQUARE_CLIENT_SECRET }}
          VITE_GOOGLE_MAPS_API_KEY: ${{ secrets.VITE_GOOGLE_MAPS_API_KEY }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: 'Swarm Viewer ${{ github.ref_name }}'
          releaseBody: 'See CHANGELOG for details.'
          releaseDraft: true
          prerelease: false
          args: ${{ matrix.args }}
```

- [ ] **Step 2: Create `README.md`**

```markdown
# Swarm Viewer

A desktop app to explore your Foursquare Swarm check-in history on an interactive map.

## Prerequisites

### 1. Foursquare Developer Account

1. Go to [foursquare.com/developers](https://foursquare.com/developers) and create an account
2. Create a new project → add an OAuth consumer
3. Set the **Redirect URI** to: `http://127.0.0.1:7878/callback`
4. Copy your **Client ID** and **Client Secret**

### 2. Google Maps API Key

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → Enable **Maps JavaScript API**
3. Create an API key → restrict it to **Maps JavaScript API**
4. Copy the key

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:
```
FOURSQUARE_CLIENT_ID=your_client_id
FOURSQUARE_CLIENT_SECRET=your_client_secret
VITE_GOOGLE_MAPS_API_KEY=your_maps_key
```

## Development

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

The `.dmg` (macOS) or `.exe` installer (Windows) will be in `src-tauri/target/release/bundle/`.

## Release

Push a version tag to trigger a GitHub Actions build:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Add `FOURSQUARE_CLIENT_ID`, `FOURSQUARE_CLIENT_SECRET`, and `VITE_GOOGLE_MAPS_API_KEY` as GitHub repository secrets before releasing.
```

- [ ] **Step 3: Commit**

```bash
git add .github/ README.md && git commit -m "feat: GitHub Actions release workflow and README"
```

---

## Task 18: End-to-End Integration Smoke Test

Run the full app in dev mode and verify the golden path works end to end.

- [ ] **Step 1: Copy and populate `.env`**

```bash
cp .env.example .env
# Edit .env with your real Foursquare and Google Maps credentials
```

- [ ] **Step 2: Run in dev mode**

```bash
npm run tauri dev
```

Expected: App window opens. Should show the Connect screen.

- [ ] **Step 3: Test OAuth flow**

1. Click "Connect to Swarm"
2. Browser opens Foursquare login
3. Approve the app
4. Loading screen appears with progress bar
5. After load, map renders with orange pins

- [ ] **Step 4: Test map interaction**

1. Click a pin — detail card appears with venue name, date, links
2. Click "×" to close the card
3. Zoom in — clustered pins expand
4. Pan the map

- [ ] **Step 5: Test timeline**

1. Scroll the timeline — venue names and dates appear
2. Click a timeline entry — map pans to that pin, detail card opens
3. Selected entry highlights in orange

- [ ] **Step 6: Test search**

1. Type a venue name in the search bar
2. Timeline filters in real time
3. Map shows only matching pins
4. Clear search — full view restores

- [ ] **Step 7: Test stats**

1. Click "Stats" in the toolbar
2. Right panel shows total count, bar charts, streak, top cities
3. Click "Stats" again — timeline returns

- [ ] **Step 8: Test settings**

1. Click ⚙ → uncheck "Show categories"
2. Category chips disappear from timeline rows and detail cards
3. Click ⚙ → "Sign out"
4. App returns to Connect screen

- [ ] **Step 9: Verify OS theme**

1. Switch macOS to dark mode (System Preferences → Appearance)
2. Quit and relaunch the app
3. App should use dark shell colors and dark-styled map

- [ ] **Step 10: Final commit**

```bash
npm test -- --run 2>&1
```

Expected: All tests pass.

```bash
git add . && git commit -m "chore: integration smoke test complete, ready for release"
```
