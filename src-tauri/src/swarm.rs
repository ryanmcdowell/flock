use crate::models::CheckIn;
use reqwest::Client;
use serde::Deserialize;

#[derive(Deserialize)]
struct ApiResponse { response: CheckinsWrapper }
#[derive(Deserialize)]
struct CheckinsWrapper { checkins: CheckinPage }
#[derive(Deserialize)]
struct CheckinPage { count: u32, items: Vec<RawCheckIn> }

#[derive(Deserialize)]
pub struct RawCheckIn {
    pub id: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    pub shout: Option<String>,
    pub venue: Option<RawVenue>,
}

#[derive(Deserialize)]
pub struct RawVenue {
    pub id: String,
    pub name: String,
    pub location: Option<RawLocation>,
    pub categories: Option<Vec<RawCategory>>,
}

#[derive(Deserialize)]
pub struct RawLocation {
    pub address: Option<String>,
    pub city: Option<String>,
    pub country: Option<String>,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
}

#[derive(Deserialize)]
pub struct RawCategory { pub name: String }

pub fn raw_to_checkin(raw: RawCheckIn) -> CheckIn {
    let loc = raw.venue.as_ref().and_then(|v| v.location.as_ref());
    CheckIn {
        id: raw.id.clone(),
        venue_id: raw.venue.as_ref().map(|v| v.id.clone()),
        venue_name: raw.venue.as_ref().map(|v| v.name.clone()).unwrap_or_else(|| "Unknown Venue".into()),
        venue_address: loc.and_then(|l| l.address.clone()),
        venue_city: loc.and_then(|l| l.city.clone()),
        venue_country: loc.and_then(|l| l.country.clone()),
        venue_category: raw.venue.as_ref()
            .and_then(|v| v.categories.as_ref())
            .and_then(|c| c.first())
            .map(|c| c.name.clone()),
        lat: loc.and_then(|l| l.lat),
        lng: loc.and_then(|l| l.lng),
        checked_in_at: raw.created_at,
        note: raw.shout,
        swarm_url: Some(format!("https://www.swarmapp.com/checkin/{}", raw.id)),
    }
}

pub async fn fetch_page(
    client: &Client, token: &str, limit: u32, offset: u32, after: Option<i64>,
) -> Result<(Vec<CheckIn>, u32), String> {
    let mut params = vec![
        ("oauth_token", token.to_string()),
        ("v", "20240101".into()),
        ("limit", limit.to_string()),
        ("offset", offset.to_string()),
        ("sort", "newestfirst".into()),
    ];
    if let Some(ts) = after {
        params.push(("afterTimestamp", ts.to_string()));
    }
    eprintln!("[swarm] GET /v2/users/self/checkins limit={limit} offset={offset} after={after:?}");
    let resp = client
        .get("https://api.foursquare.com/v2/users/self/checkins")
        .query(&params).send().await.map_err(|e| {
            let msg = format!("HTTP send: {e}");
            eprintln!("[swarm] {msg}");
            msg
        })?;
    let status = resp.status();
    eprintln!("[swarm] response status={status}");
    if status == 429 { return Err("rate_limited".into()); }
    let body = resp.text().await.map_err(|e| {
        let msg = format!("read body: {e}");
        eprintln!("[swarm] {msg}");
        msg
    })?;
    if !status.is_success() {
        let preview: String = body.chars().take(300).collect();
        eprintln!("[swarm] non-2xx body preview: {preview}");
        return Err(format!("Foursquare API {status}: {preview}"));
    }
    let api: ApiResponse = serde_json::from_str(&body).map_err(|e| {
        let preview: String = body.chars().take(300).collect();
        let msg = format!("JSON parse: {e}; body preview: {preview}");
        eprintln!("[swarm] {msg}");
        msg
    })?;
    let total = api.response.checkins.count;
    let items_len = api.response.checkins.items.len();
    eprintln!("[swarm] parsed count={total} items={items_len}");
    let items = api.response.checkins.items.into_iter().map(raw_to_checkin).collect();
    Ok((items, total))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_maps_fields() {
        let raw = RawCheckIn {
            id: "abc".into(), created_at: 1_609_459_200,
            shout: Some("Great!".into()),
            venue: Some(RawVenue {
                id: "v1".into(), name: "Blue Bottle".into(),
                location: Some(RawLocation {
                    address: Some("300 Webster".into()),
                    city: Some("San Francisco".into()),
                    country: Some("US".into()),
                    lat: Some(37.77), lng: Some(-122.41),
                }),
                categories: Some(vec![RawCategory { name: "Coffee Shop".into() }]),
            }),
        };
        let c = raw_to_checkin(raw);
        assert_eq!(c.id, "abc");
        assert_eq!(c.venue_name, "Blue Bottle");
        assert_eq!(c.venue_city.as_deref(), Some("San Francisco"));
        assert_eq!(c.venue_category.as_deref(), Some("Coffee Shop"));
        assert_eq!(c.note.as_deref(), Some("Great!"));
        assert!(c.swarm_url.as_deref().unwrap().contains("abc"));
    }

    #[test]
    fn test_missing_venue() {
        let raw = RawCheckIn { id: "x".into(), created_at: 1, shout: None, venue: None };
        let c = raw_to_checkin(raw);
        assert_eq!(c.venue_name, "Unknown Venue");
        assert!(c.venue_city.is_none());
    }
}
