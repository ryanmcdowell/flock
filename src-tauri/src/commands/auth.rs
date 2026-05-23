use crate::db::DbPool;
use tauri::State;

#[tauri::command]
pub async fn check_auth_status() -> Result<bool, String> { Ok(false) }
#[tauri::command]
pub async fn start_oauth() -> Result<(), String> { Ok(()) }
#[tauri::command]
pub async fn sign_out(_pool: State<'_, DbPool>) -> Result<(), String> { Ok(()) }
