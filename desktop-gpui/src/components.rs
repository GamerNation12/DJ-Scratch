use gpui::{
    div, text, FontWeight, IntoElement, Px, Render, SharedString, Size, Styled, View, ViewContext,
    WindowContext,
};
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};

use crate::app::AppState;
use crate::{ActiveTab, Tab};

pub struct SidebarView {
    active_tab: Entity<ActiveTab>,
}

impl SidebarView {
    pub fn new(active_tab: Entity<ActiveTab>, cx: &mut WindowContext) -> View<Self> {
        cx.new_view(|_| Self { active_tab })
    }
}

impl Render for SidebarView {
    fn render(&mut self, cx: &mut ViewContext<Self>) -> impl IntoElement {
        let tab = cx.read(self.active_tab).0;
        div()
            .id("sidebar")
            .size(Size::px(90.0), Size::percent(100.0))
            .bg("#111113")
            .border_right(px(1.0))
            .border_color("rgba(255,255,255,0.10)")
            .child(
                div()
                    .flex()
                    .flex_dir(FlexDirection::Column)
                    .gap(px(16.0))
                    .p(px(12.0))
                    .child(text("DJ Scratch").font_weight(FontWeight::BOLD).text_size(px(18.0)))
                    .child(nav_item("Dashboard", Tab::Dashboard, tab))
                    .child(nav_item("Leaderboard", Tab::Leaderboard, tab))
                    .child(nav_item("Friends", Tab::Friends, tab))
                    .child(nav_item("Tools", Tab::Tools, tab))
                    .child(nav_item("Support", Tab::Support, tab))
                    .child(nav_item("Admin", Tab::Admin, tab))
                    .child(nav_item("Settings", Tab::Settings, tab)),
            )
    }
}

fn nav_item(label: &str, tab_id: Tab, active: Tab) -> impl IntoElement {
    let active = active == tab_id;
    div()
        .flex()
        .items_center()
        .gap(px(8.0))
        .p(px(10.0))
        .px(px(8.0))
        .hover_bg("rgba(255,255,255,0.05)")
        .cond(active, |el| {
            el.bg("rgba(99,102,241,0.15)")
                .border_right(px(3.0))
                .border_color("#6366f1")
                .text_color("#6366f1")
        })
        .child(text(label).font_weight(FontWeight::SEMI_BOLD).text_size(px(13.0)))
}

pub struct MainContentView {
    app_state: Entity<AppState>,
    active_tab: Entity<ActiveTab>,
}

impl MainContentView {
    pub fn new(
        app_state: Entity<AppState>,
        active_tab: Entity<ActiveTab>,
        cx: &mut WindowContext,
    ) -> View<Self> {
        cx.new_view(|_| Self { app_state, active_tab })
    }
}

impl Render for MainContentView {
    fn render(&mut self, cx: &mut ViewContext<Self>) -> impl IntoElement {
        let tab = cx.read(self.active_tab).0;
        div()
            .id("main-content")
            .flex()
            .flex_dir(FlexDirection::Column)
            .size(Size::percent(100.0), Size::percent(100.0))
            .child(match tab {
                Tab::Dashboard => DashboardView::new(self.app_state.clone(), cx).into_any_element(),
                Tab::Leaderboard => LeaderboardView::new().into_any_element(),
                Tab::Friends => FriendsView::new().into_any_element(),
                Tab::Tools => ToolsView::new().into_any_element(),
                Tab::Support => SupportView::new().into_any_element(),
                Tab::Admin => AdminView::new().into_any_element(),
                Tab::Settings => SettingsView::new().into_any_element(),
            })
    }
}

fn page_container() -> impl IntoElement {
    div().p(px(16.0)).gap(px(16.0))
}

struct DashboardView {
    app_state: Entity<AppState>,
}

impl DashboardView {
    fn new(app_state: Entity<AppState>, cx: &mut WindowContext) -> View<Self> {
        cx.new_view(|_| Self { app_state })
    }
}

impl Render for DashboardView {
    fn render(&mut self, cx: &mut ViewContext<Self>) -> impl IntoElement {
        let app_state = cx.read(self.app_state);
        let is_building = app_state.is_building;
        div()
            .id("dashboard")
            .p(px(16.0))
            .gap(px(16.0))
            .child(text("DJ Scratch Builder").font_weight(FontWeight::BOLD).text_size(px(26.0)))
            .child(text("Build and release DJ Scratch desktop + mobile").text_color("rgba(255,255,255,0.5)"))
            .child(
                div()
                    .flex()
                    .flex_dir(FlexDirection::Column)
                    .gap(px(12.0))
                    .child(
                        div()
                            .flex()
                            .items_center()
                            .gap(px(8.0))
                            .p(px(14.0))
                            .px(px(16.0))
                            .border(px(1.0))
                            .border_color("rgba(255,255,255,0.10)")
                            .rounded(px(12.0))
                            .hover_bg("rgba(255,255,255,0.05)")
                            .cond(is_building, |el| el.bg("rgba(99,102,241,0.15)").border_color("#6366f1"))
                            .disabled(is_building)
                            .on_click(move |_, cx| {
                                let app_state = self.app_state.clone();
                                
                                // Mark building
                                let _ = app_state.update(|s, _cx| {
                                    s.is_building = true;
                                    s.add_log("=== DJ Scratch Build & Release ===".to_string());
                                });

                                // Find repo root from exe location
                                let exe_path = std::env::current_exe().unwrap_or_default();
                                let repo_root = exe_path
                                    .parent()
                                    .unwrap_or(std::path::Path::new("."))
                                    .parent()
                                    .unwrap_or(std::path::Path::new("."))
                                    .to_path_buf();
                                let script = repo_root.join("build-all.ps1");

                                let _ = app_state.update(|s, _cx| {
                                    s.add_log(format!("Running: {} -Release", script.display()));
                                });

                                // Run the build script on a background thread
                                let app_state_clone = app_state.clone();
                                std::thread::spawn(move || {
                                    let mut cmd = Command::new("powershell");
                                    cmd.arg("-ExecutionPolicy")
                                        .arg("Bypass")
                                        .arg("-File")
                                        .arg(&script)
                                        .arg("-Release")
                                        .stdout(Stdio::piped())
                                        .stderr(Stdio::piped());

                                    if let Ok(mut child) = cmd.spawn() {
                                        if let Some(stdout) = child.stdout.take() {
                                            let reader = BufReader::new(stdout);
                                            for line in reader.lines() {
                                                if let Ok(line) = line {
                                                    let line_clone = line.clone();
                                                    let _ = app_state_clone.update(|s, _cx| {
                                                        s.add_log(line_clone);
                                                    });
                                                }
                                            }
                                        }
                                        let _ = child.wait();
                                    }

                                    let _ = app_state_clone.update(|s, _cx| {
                                        s.add_log("=== Build & Release Complete ===".to_string());
                                        s.is_building = false;
                                    });
                                });
                            })
                            .child(
                                div()
                                    .flex()
                                    .items_center()
                                    .gap(px(8.0))
                                    .child(if is_building {
                                        div()
                                            .w(px(16.0))
                                            .h(px(16.0))
                                            .border(px(2.0))
                                            .border_color("rgba(99,102,241,0.3)")
                                            .border_top_color("#6366f1")
                                            .rounded(px(8.0))
                                    } else {
                                        text("🚀").font_size(px(16.0))
                                    })
                                    .child(text(if is_building { "Building & Releasing…" } else { "Build & Release" })
                                        .font_weight(FontWeight::BOLD)
                                        .text_size(px(14.0))
                                        .cond(is_building, |el| el.text_color("#6366f1")))
                            ),
                    )
            )
    }
}

struct LeaderboardView;

impl Render for LeaderboardView {
    fn render(&mut self, _cx: &mut ViewContext<Self>) -> impl IntoElement {
        page_container()
            .child(text("Leaderboard").font_weight(FontWeight::BOLD).text_size(px(26.0)))
    }
}

struct FriendsView;

impl Render for FriendsView {
    fn render(&mut self, _cx: &mut ViewContext<Self>) -> impl IntoElement {
        page_container()
            .child(text("Friends").font_weight(FontWeight::BOLD).text_size(px(26.0)))
    }
}

struct ToolsView;

impl Render for ToolsView {
    fn render(&mut self, _cx: &mut ViewContext<Self>) -> impl IntoElement {
        page_container()
            .child(text("Tools").font_weight(FontWeight::BOLD).text_size(px(26.0)))
    }
}

struct SupportView;

impl Render for SupportView {
    fn render(&mut self, _cx: &mut ViewContext<Self>) -> impl IntoElement {
        page_container()
            .child(text("Support Chat").font_weight(FontWeight::BOLD).text_size(px(26.0)))
    }
}

struct AdminView;

impl Render for AdminView {
    fn render(&mut self, _cx: &mut ViewContext<Self>) -> impl IntoElement {
        page_container()
            .child(text("Admin").font_weight(FontWeight::BOLD).text_size(px(26.0)))
    }
}

struct SettingsView;

impl Render for SettingsView {
    fn render(&mut self, _cx: &mut ViewContext<Self>) -> impl IntoElement {
        page_container()
            .child(text("Settings").font_weight(FontWeight::BOLD).text_size(px(26.0)))
    }
}

pub struct LogPanel {
    logs: Vec<String>,
}

impl LogPanel {
    pub fn new(logs: Vec<String>) -> Self {
        Self { logs }
    }
}

impl Render for LogPanel {
    fn render(&mut self, _cx: &mut ViewContext<Self>) -> impl IntoElement {
        div()
            .id("log-panel")
            .h(px(200.0))
            .border_top(px(1.0))
            .border_color("rgba(255,255,255,0.10)")
            .bg("#0a0a0c")
            .overflow_auto()
            .p(px(12.0))
            .child(
                div()
                    .flex()
                    .flex_dir(FlexDirection::Column)
                    .gap(px(4.0))
                    .children(self.logs.iter().map(|line| {
                        text(line.clone())
                            .font_size(px(11.0))
                            .font_family("Consolas, monospace")
                            .text_color("rgba(255,255,255,0.7)")
                            .into_any_element()
                    }))
            )
    }
}
