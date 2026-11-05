use gpui::{Entity, SharedString};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

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
}

impl AppState {
    pub fn new() -> Self {
        Self {
            token: None,
            user: None,
            is_admin: false,
            messages: Vec::new(),
            status: "open".to_string(),
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
