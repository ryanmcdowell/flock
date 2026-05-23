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
