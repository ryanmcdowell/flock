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
        let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM sync_state")
            .fetch_one(&pool).await.unwrap();
        assert_eq!(count, 1);
    }
}
