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
