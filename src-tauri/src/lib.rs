pub mod commands;
pub mod db;
pub mod models;

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
