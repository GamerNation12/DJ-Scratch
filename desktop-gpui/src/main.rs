#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use anyhow::Result;
use gpui::{
    App, View, WindowContext, AppContext, Entity, Render, SharedString, px, div, text, FontWeight,
    Size, FlexDirection, WindowOptions,
};

mod app;
mod components;

use app::AppState;
use components::*;

fn main() -> Result<()> {
    App::new().run(|cx| {
        cx.activate(true);
        cx.open_window(WindowOptions::default(), |cx| {
            cx.new_view(|_| AppView::new(cx))
        })?;
        Ok(())
    })
}

struct AppView {
    app_state: Entity<AppState>,
    active_tab: Entity<ActiveTab>,
}

impl AppView {
    fn new(cx: &mut WindowContext) -> Self {
        let app_state = cx.new_entity(|_| AppState::new());
        let active_tab = cx.new_entity(|_| ActiveTab::new(Tab::Dashboard));

        Self {
            app_state,
            active_tab,
        }
    }
}

impl Render for AppView {
    fn render(&mut self, cx: &mut WindowContext) -> impl IntoElement {
        let tab = cx.read(self.active_tab).0;
        div()
            .id("app")
            .size(Size::percent(100.0), Size::percent(100.0))
            .bg("#09090b")
            .child(
                div()
                    .flex()
                    .flex_dir(FlexDirection::Row)
                    .size(Size::percent(100.0), Size::percent(100.0))
                    .child(SidebarView::new(self.active_tab.clone(), cx))
                    .child(
                        div()
                            .flex()
                            .flex_dir(FlexDirection::Column)
                            .size(Size::percent(100.0), Size::percent(100.0))
                            .child(match tab {
                                Tab::Dashboard => DashboardView::new(self.app_state.clone(), cx).into_any_element(),
                                Tab::Leaderboard => LeaderboardView::new(),
                                Tab::Friends => FriendsView::new(),
                                Tab::Tools => ToolsView::new(),
                                Tab::Support => SupportView::new(),
                                Tab::Admin => AdminView::new(),
                                Tab::Settings => SettingsView::new(),
                            })
                            .child(LogPanel::new(cx.read(self.app_state).logs.clone())),
                    ),
            )
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Tab {
    Dashboard,
    Leaderboard,
    Friends,
    Tools,
    Support,
    Admin,
    Settings,
}

impl Tab {
    fn label(&self) -> SharedString {
        match self {
            Tab::Dashboard => "Dashboard".into(),
            Tab::Leaderboard => "Leaderboard".into(),
            Tab::Friends => "Friends".into(),
            Tab::Tools => "Tools".into(),
            Tab::Support => "Support".into(),
            Tab::Admin => "Admin".into(),
            Tab::Settings => "Settings".into(),
        }
    }
}

struct ActiveTab(Tab);

impl ActiveTab {
    fn new(tab: Tab) -> Self {
        Self(tab)
    }
}

impl Default for ActiveTab {
    fn default() -> Self {
        Self(Tab::Dashboard)
    }
}

struct App;

impl gpui::App for App {
    type State = ();
}
