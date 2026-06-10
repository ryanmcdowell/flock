use crate::keychain;
use reqwest::Client;
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct UserResp { response: UserWrapper }
#[derive(Deserialize)]
struct UserWrapper { user: RawUser }

#[derive(Deserialize)]
struct RawUser {
    #[serde(rename = "firstName")]
    first_name: Option<String>,
    #[serde(rename = "lastName")]
    last_name: Option<String>,
    photo: Option<RawPhoto>,
}

#[derive(Deserialize)]
struct RawPhoto {
    prefix: String,
    suffix: String,
}

#[derive(Serialize, Deserialize)]
pub struct UserProfile {
    pub name: String,
    pub photo_url: Option<String>,
}

#[tauri::command]
pub async fn fetch_user_profile() -> Result<UserProfile, String> {
    let token = tokio::task::spawn_blocking(keychain::get_token)
        .await
        .map_err(|e| e.to_string())??
        .ok_or("Not authenticated")?;

    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .get("https://api.foursquare.com/v2/users/self")
        .query(&[("oauth_token", token.as_str()), ("v", "20240101")])
        .send().await.map_err(|e| e.to_string())?;
    let status = resp.status();
    let body = resp.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        let preview: String = body.chars().take(200).collect();
        return Err(format!("Foursquare /users/self {status}: {preview}"));
    }
    let parsed: UserResp = serde_json::from_str(&body).map_err(|e| e.to_string())?;
    let user = parsed.response.user;
    let name = match (user.first_name, user.last_name) {
        (Some(f), Some(l)) => format!("{f} {l}"),
        (Some(f), None) => f,
        (None, Some(l)) => l,
        (None, None) => "Foursquare user".to_string(),
    };
    let photo_url = user.photo.map(|p| format!("{}128x128{}", p.prefix, p.suffix));
    Ok(UserProfile { name, photo_url })
}
