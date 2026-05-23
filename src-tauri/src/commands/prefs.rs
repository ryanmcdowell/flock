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
