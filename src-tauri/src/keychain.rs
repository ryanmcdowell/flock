use keyring::Entry;

const SERVICE: &str = "swarm-viewer";
const USER: &str = "access-token";

pub fn store_token(token: &str) -> Result<(), String> {
    Entry::new(SERVICE, USER).map_err(|e| e.to_string())?
        .set_password(token).map_err(|e| e.to_string())
}

pub fn get_token() -> Result<Option<String>, String> {
    match Entry::new(SERVICE, USER).map_err(|e| e.to_string())?.get_password() {
        Ok(t) => Ok(Some(t)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub fn delete_token() -> Result<(), String> {
    match Entry::new(SERVICE, USER).map_err(|e| e.to_string())?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
