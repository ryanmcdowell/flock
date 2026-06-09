use crate::{db::DbPool, keychain};
use reqwest::Client;
use tauri::State;

const CLIENT_ID: &str = env!("FOURSQUARE_CLIENT_ID");
const CLIENT_SECRET: &str = env!("FOURSQUARE_CLIENT_SECRET");
const REDIRECT_URI: &str = "http://127.0.0.1:7878/callback";

#[tauri::command]
pub async fn check_auth_status() -> Result<bool, String> {
    tokio::task::spawn_blocking(|| keychain::get_token().map(|t| t.is_some()))
        .await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn start_oauth() -> Result<(), String> {
    eprintln!("[oauth] start_oauth invoked");
    let auth_url = format!(
        "https://foursquare.com/oauth2/authenticate?client_id={}&redirect_uri={}&response_type=code",
        CLIENT_ID, REDIRECT_URI
    );
    eprintln!("[oauth] auth_url length={}", auth_url.len());

    let code = tokio::task::spawn_blocking(move || -> Result<String, String> {
        eprintln!("[oauth] binding listener on 127.0.0.1:7878");
        let server = tiny_http::Server::http("127.0.0.1:7878")
            .map_err(|e| format!("OAuth listener failed: {e}"))?;
        eprintln!("[oauth] listener bound; opening browser");
        open::that(&auth_url).map_err(|e| e.to_string())?;

        eprintln!("[oauth] waiting for callback (120s timeout)");
        let request = server.recv_timeout(std::time::Duration::from_secs(120))
            .map_err(|e| e.to_string())?
            .ok_or("OAuth timed out after 120 seconds — please try again")?;
        eprintln!("[oauth] callback received: {}", request.url());

        let raw_url = request.url().to_string();
        let parsed = url::Url::parse(&format!("http://localhost{}", raw_url))
            .map_err(|e| format!("Failed to parse callback URL: {e}"))?;
        let params: std::collections::HashMap<_, _> = parsed.query_pairs().collect();

        if let Some(err) = params.get("error") {
            let desc = params.get("error_description")
                .map(|s| s.as_ref())
                .unwrap_or(err.as_ref());
            eprintln!("[oauth] error param in callback: {err}: {desc}");
            request.respond(tiny_http::Response::from_string(
                "<html><body><h2>Authorization denied. You can close this tab.</h2></body></html>"
            )).ok();
            return Err(format!("OAuth denied: {desc}"));
        }

        let code = params.get("code")
            .ok_or("No code in OAuth callback")?
            .to_string();
        eprintln!("[oauth] code extracted (len={})", code.len());

        request.respond(tiny_http::Response::from_string(
            "<html><body><h2>Connected! You can close this tab.</h2></body></html>"
        )).ok();
        Ok(code)
    }).await.map_err(|e| {
        let msg = format!("spawn_blocking join failed: {e}");
        eprintln!("[oauth] {msg}");
        msg
    })??;

    eprintln!("[oauth] exchanging code for token");
    let resp = Client::new()
        .get("https://foursquare.com/oauth2/access_token")
        .query(&[
            ("client_id", CLIENT_ID), ("client_secret", CLIENT_SECRET),
            ("grant_type", "authorization_code"),
            ("redirect_uri", REDIRECT_URI), ("code", &code),
        ])
        .send().await.map_err(|e| {
            let msg = format!("token endpoint send failed: {e}");
            eprintln!("[oauth] {msg}");
            msg
        })?;
    let status = resp.status();
    let body = resp.text().await.map_err(|e| e.to_string())?;
    eprintln!("[oauth] token endpoint status={status} body_len={}", body.len());
    let resp_json: serde_json::Value = serde_json::from_str(&body).map_err(|e| {
        let preview: String = body.chars().take(300).collect();
        let msg = format!("token JSON parse failed: {e}; body preview: {preview}");
        eprintln!("[oauth] {msg}");
        msg
    })?;

    let token = resp_json["access_token"].as_str().ok_or_else(|| {
        let preview: String = body.chars().take(300).collect();
        let msg = format!("No access_token in Foursquare response. body preview: {preview}");
        eprintln!("[oauth] {msg}");
        msg
    })?.to_string();
    eprintln!("[oauth] access_token received (len={})", token.len());

    tokio::task::spawn_blocking(move || keychain::store_token(&token))
        .await.map_err(|e| {
            let msg = format!("store_token join failed: {e}");
            eprintln!("[oauth] {msg}");
            msg
        })??;
    eprintln!("[oauth] start_oauth completed");
    Ok(())
}

#[tauri::command]
pub async fn sign_out(pool: State<'_, DbPool>) -> Result<(), String> {
    // Delete keychain token first — if DB fails, user is still logged out
    tokio::task::spawn_blocking(keychain::delete_token)
        .await.map_err(|e| e.to_string())??;

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
    sqlx::query("DELETE FROM checkins")
        .execute(&mut *tx).await.map_err(|e| e.to_string())?;
    sqlx::query("UPDATE sync_state SET last_sync_at=NULL,total_fetched=0,bulk_load_complete=0 WHERE id=1")
        .execute(&mut *tx).await.map_err(|e| e.to_string())?;
    tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}
