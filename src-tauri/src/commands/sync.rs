use crate::db::DbPool;
use tauri::{AppHandle, State};

#[tauri::command]
pub async fn start_sync(_app: AppHandle, _pool: State<'_, DbPool>) -> Result<(), String> { Ok(()) }
