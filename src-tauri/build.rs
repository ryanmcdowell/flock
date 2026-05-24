use std::{fs, path::PathBuf};

fn main() {
    load_dotenv();
    tauri_build::build()
}

fn load_dotenv() {
    let Some(path) = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|p| p.join(".env"))
    else {
        return;
    };
    println!("cargo:rerun-if-changed={}", path.display());
    let Ok(contents) = fs::read_to_string(&path) else { return };
    for line in contents.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let Some((key, value)) = line.split_once('=') else { continue };
        let key = key.trim();
        let value = value.trim().trim_matches('"').trim_matches('\'');
        if std::env::var_os(key).is_none() {
            println!("cargo:rustc-env={}={}", key, value);
        }
    }
}
