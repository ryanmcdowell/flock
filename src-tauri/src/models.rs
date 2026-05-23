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
