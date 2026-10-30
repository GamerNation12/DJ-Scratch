#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use std::sync::OnceLock;
use tauri::WindowEvent;

static APP_HANDLE: OnceLock<tauri::AppHandle> = OnceLock::new();

fn main() {
  tauri::Builder::default()
    .setup(|app| {
      let handle = app.handle().clone();
      APP_HANDLE.set(handle).ok();
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      commands::save_token,
      commands::get_token,
      commands::clear_token,
      commands::api_request_sync,
    ])
    .on_window_event(|window, event| {
      if matches!(event, WindowEvent::Destroyed) {
        std::process::exit(0);
      }
    })
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_fs::init())
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

pub fn app_handle() -> Option<&'static tauri::AppHandle> {
  APP_HANDLE.get()
}
