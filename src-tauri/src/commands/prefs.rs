use crate::{db::DbPool, models::{Prefs, SyncState}};
use tauri::State;

pub(crate) async fn get_prefs_inner(_pool: &DbPool) -> Result<Prefs, String> { todo!() }
pub(crate) async fn get_sync_state_inner(_pool: &DbPool) -> Result<SyncState, String> { todo!() }

#[tauri::command]
pub async fn get_prefs(_pool: State<'_, DbPool>) -> Result<Prefs, String> { todo!() }
#[tauri::command]
pub async fn save_prefs(_prefs: Prefs, _pool: State<'_, DbPool>) -> Result<(), String> { Ok(()) }
#[tauri::command]
pub async fn get_sync_state(_pool: State<'_, DbPool>) -> Result<SyncState, String> { todo!() }
#[tauri::command]
pub async fn update_sync_state(_last_sync_at: Option<i64>, _total_fetched: i64, _bulk_load_complete: bool, _pool: State<'_, DbPool>) -> Result<(), String> { Ok(()) }
