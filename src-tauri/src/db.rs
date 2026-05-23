use sqlx::{sqlite::{SqliteConnectOptions, SqlitePool}, Pool, Sqlite};
use std::{path::Path, str::FromStr};

pub type DbPool = Pool<Sqlite>;

pub async fn init_pool(db_path: &Path) -> Result<DbPool, sqlx::Error> {
    let url = format!("sqlite:{}", db_path.display());
    let options = SqliteConnectOptions::from_str(&url)?
        .create_if_missing(true)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal);
    let pool = SqlitePool::connect_with(options).await?;
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .map_err(|e| sqlx::Error::Configuration(e.to_string().into()))?;
    Ok(pool)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_init_creates_schema() {
        let dir = tempdir().unwrap();
        let pool = init_pool(&dir.path().join("test.db")).await.unwrap();

        // sync_state seeded with 1 row
        let (sync_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM sync_state")
            .fetch_one(&pool).await.unwrap();
        assert_eq!(sync_count, 1);

        // preferences seeded with 1 row and correct default
        let (map_zoom,): (i64,) = sqlx::query_as("SELECT map_zoom FROM preferences WHERE id=1")
            .fetch_one(&pool).await.unwrap();
        assert_eq!(map_zoom, 3);

        // checkins table exists (empty)
        let (checkin_count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM checkins")
            .fetch_one(&pool).await.unwrap();
        assert_eq!(checkin_count, 0);
    }
}
