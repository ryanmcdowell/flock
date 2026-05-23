use crate::{db::DbPool, models::CheckIn};
use tauri::State;

pub(crate) async fn save_checkins_inner(pool: &DbPool, checkins: &[CheckIn]) -> Result<(), String> {
    for c in checkins {
        sqlx::query(
            "INSERT OR REPLACE INTO checkins
             (id,venue_id,venue_name,venue_address,venue_city,venue_country,
              venue_category,lat,lng,checked_in_at,note,swarm_url)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
        )
        .bind(&c.id).bind(&c.venue_id).bind(&c.venue_name).bind(&c.venue_address)
        .bind(&c.venue_city).bind(&c.venue_country).bind(&c.venue_category)
        .bind(c.lat).bind(c.lng).bind(c.checked_in_at).bind(&c.note).bind(&c.swarm_url)
        .execute(pool).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub(crate) async fn get_checkins_inner(pool: &DbPool) -> Result<Vec<CheckIn>, String> {
    sqlx::query_as::<_, CheckIn>(
        "SELECT id,venue_id,venue_name,venue_address,venue_city,venue_country,
                venue_category,lat,lng,checked_in_at,note,swarm_url
         FROM checkins ORDER BY checked_in_at DESC"
    )
    .fetch_all(pool).await.map_err(|e| e.to_string())
}

pub(crate) async fn clear_checkins_inner(pool: &DbPool) -> Result<(), String> {
    sqlx::query("DELETE FROM checkins").execute(pool).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_checkins(pool: State<'_, DbPool>) -> Result<Vec<CheckIn>, String> {
    get_checkins_inner(&pool).await
}

#[tauri::command]
pub async fn save_checkins(checkins: Vec<CheckIn>, pool: State<'_, DbPool>) -> Result<(), String> {
    save_checkins_inner(&pool, &checkins).await
}

#[tauri::command]
pub async fn clear_checkins(pool: State<'_, DbPool>) -> Result<(), String> {
    clear_checkins_inner(&pool).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_pool;
    use tempfile::tempdir;

    fn make(id: &str, city: &str) -> CheckIn {
        CheckIn {
            id: id.to_string(), venue_id: Some("v1".to_string()),
            venue_name: "Place".to_string(), venue_address: None,
            venue_city: Some(city.to_string()), venue_country: None,
            venue_category: None, lat: Some(37.7), lng: Some(-122.4),
            checked_in_at: 1_000_000, note: None, swarm_url: None,
        }
    }

    #[tokio::test]
    async fn test_save_and_get() {
        let dir = tempdir().unwrap();
        let pool = init_pool(&dir.path().join("t.db")).await.unwrap();
        save_checkins_inner(&pool, &[make("a", "SF"), make("b", "NYC")]).await.unwrap();
        let result = get_checkins_inner(&pool).await.unwrap();
        assert_eq!(result.len(), 2);
    }

    #[tokio::test]
    async fn test_save_idempotent() {
        let dir = tempdir().unwrap();
        let pool = init_pool(&dir.path().join("t.db")).await.unwrap();
        let c = make("dup", "SF");
        save_checkins_inner(&pool, &[c.clone()]).await.unwrap();
        save_checkins_inner(&pool, &[c]).await.unwrap();
        assert_eq!(get_checkins_inner(&pool).await.unwrap().len(), 1);
    }

    #[tokio::test]
    async fn test_clear() {
        let dir = tempdir().unwrap();
        let pool = init_pool(&dir.path().join("t.db")).await.unwrap();
        save_checkins_inner(&pool, &[make("x", "SF")]).await.unwrap();
        clear_checkins_inner(&pool).await.unwrap();
        assert_eq!(get_checkins_inner(&pool).await.unwrap().len(), 0);
    }
}
