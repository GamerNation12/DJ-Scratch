use discord_rpc::{Client, Discord};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

static DISCORD_CLIENT: Mutex<Option<thread::JoinHandle<()>>> = Mutex::new(None);

pub fn init_rpc() {
  let client_id = "1521582398188290049";
  let _ = client_id;

  let handle = thread::spawn(move || {
    let mut client = match Client::new(client_id) {
      Ok(c) => c,
      Err(e) => {
        eprintln!("Failed to create Discord RPC client: {}", e);
        return;
      }
    };

    if let Err(e) = client.start() {
      eprintln!("Failed to start Discord RPC: {}", e);
      return;
    }

    loop {
      if let Err(e) = client.run_callbacks() {
        eprintln!("Discord RPC callback error: {}", e);
        break;
      }
      thread::sleep(Duration::from_secs(15));
    }
  });

  *DISCORD_CLIENT.lock().unwrap() = Some(handle);
}

pub fn set_activity(label: Option<String>) {
  // Discord RPC activity update would go here
  // The discord-rpc crate v4 API may differ; this is a placeholder
  let _ = label;
}

pub fn shutdown_rpc() {
  if let Some(handle) = DISCORD_CLIENT.lock().unwrap().take() {
    let _ = handle.join();
  }
}
