use keyring::Entry;

const SERVICE: &str = "swarm-viewer";
const USER: &str = "access-token";

pub fn store_token(token: &str) -> Result<(), String> {
    eprintln!("[keychain] store_token: token len={}", token.len());
    let entry = Entry::new(SERVICE, USER).map_err(|e| {
        let msg = format!("Entry::new failed: {e}");
        eprintln!("[keychain] {msg}");
        msg
    })?;
    entry.set_password(token).map_err(|e| {
        let msg = format!("set_password failed: {e}");
        eprintln!("[keychain] {msg}");
        msg
    })?;
    eprintln!("[keychain] store_token: stored OK");
    Ok(())
}

pub fn get_token() -> Result<Option<String>, String> {
    eprintln!("[keychain] get_token: calling Entry::new");
    let entry = Entry::new(SERVICE, USER).map_err(|e| {
        let msg = format!("Entry::new failed: {e}");
        eprintln!("[keychain] {msg}");
        msg
    })?;
    eprintln!("[keychain] get_token: calling get_password");
    match entry.get_password() {
        Ok(t) => {
            eprintln!("[keychain] get_token: got token len={}", t.len());
            Ok(Some(t))
        }
        Err(keyring::Error::NoEntry) => {
            eprintln!("[keychain] get_token: NoEntry");
            Ok(None)
        }
        Err(e) => {
            let msg = format!("get_password failed: {e}");
            eprintln!("[keychain] {msg}");
            Err(msg)
        }
    }
}

pub fn delete_token() -> Result<(), String> {
    match Entry::new(SERVICE, USER).map_err(|e| e.to_string())?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
