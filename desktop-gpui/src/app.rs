use gpui::{Entity, SharedString};
use serde::{Deserialize, Serialize};
use std::sync::atomic::AtomicBool;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct JwtUser {
    pub id: String,
    pub name: String,
    pub avatar: Option<String>,
    pub image: Option<String>,
}

#[derive(Clone, Debug)]
pub struct ChatBubble {
    pub id: String,
    pub mine: bool,
    pub text: String,
    pub at: String,
}

pub struct AppState {
    pub token: Option<String>,
    pub user: Option<JwtUser>,
    pub is_admin: bool,
    pub messages: Vec<ChatBubble>,
    pub status: String,
    pub logs: Vec<String>,
    pub is_building: bool,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            token: None,
            user: None,
            is_admin: false,
            messages: Vec::new(),
            status: "open".to_string(),
            logs: Vec::new(),
            is_building: false,
        }
    }

    pub fn add_log(&mut self, line: String) {
        self.logs.push(line);
        if self.logs.len() > 500 {
            self.logs.remove(0);
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

pub struct AuthToken(pub Option<String>);

impl AuthToken {
    pub fn new(token: Option<String>) -> Self {
        Self(token)
    }
}
