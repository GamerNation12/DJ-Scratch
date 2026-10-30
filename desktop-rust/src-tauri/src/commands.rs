use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::path::PathBuf;

const STORAGE_FILE: &str = "dj-scratch/token.json";

#[derive(Debug, Serialize, Deserialize)]
struct TokenStore {
  token: Option<String>,
}

fn storage_path() -> Option<PathBuf> {
  env::var_os("APPDATA").map(|p| PathBuf::from(p).join(STORAGE_FILE))
}

fn load_store() -> TokenStore {
  match storage_path() {
    None => TokenStore { token: None },
    Some(path) => match fs::read_to_string(&path) {
      Ok(s) => serde_json::from_str(&s).unwrap_or(TokenStore { token: None }),
      Err(_) => TokenStore { token: None },
    },
  }
}

fn save_store(store: &TokenStore) {
  if let Some(path) = storage_path() {
    if let Some(parent) = path.parent() {
      let _ = fs::create_dir_all(parent);
    }
    if let Ok(s) = serde_json::to_string_pretty(store) {
      let _ = fs::write(&path, s);
    }
  }
}

#[tauri::command]
pub fn save_token(token: String) {
  let mut store = load_store();
  store.token = Some(token);
  save_store(&store);
}

#[tauri::command]
pub fn get_token() -> Option<String> {
  load_store().token
}

#[tauri::command]
pub fn clear_token() {
  let mut store = load_store();
  store.token = None;
  save_store(&store);
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiRequest {
  path: String,
  method: Option<String>,
  body: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiResponse {
  status: u16,
  body: serde_json::Value,
}

#[tauri::command]
pub fn api_request_sync(req: ApiRequest) -> Result<ApiResponse, String> {
  let client = reqwest::blocking::Client::builder()
    .timeout(std::time::Duration::from_secs(15))
    .build()
    .map_err(|e| e.to_string())?;

  let base = std::env::var("API_BASE").unwrap_or_else(|_| "https://api.djscratch.app".to_string());
  let url = format!("{}{}", base, req.path);

  let method = match req.method.as_deref() {
    None | Some("GET") => reqwest::Method::GET,
    Some("POST") => reqwest::Method::POST,
    Some("PUT") => reqwest::Method::PUT,
    Some("DELETE") => reqwest::Method::DELETE,
    Some(_) => reqwest::Method::GET,
  };

  let mut request = client.request(method, &url);

  if let Some(token) = load_store().token {
    request = request.bearer_auth(&token);
  }

  if let Some(body) = req.body {
    request = request.json(&body);
  }

  let response = request.send().map_err(|e| e.to_string())?;
  let status = response.status().as_u16();
  let body: serde_json::Value = response.json().map_err(|e| e.to_string())?;

  Ok(ApiResponse { status, body })
}
