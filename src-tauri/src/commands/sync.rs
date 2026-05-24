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
