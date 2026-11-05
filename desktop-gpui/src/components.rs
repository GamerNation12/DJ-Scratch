use gpui::{
    div, text, FontWeight, IntoElement, Px, Render, SharedString, Size, Styled, View, ViewContext,
    WindowContext,
};

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
                Tab::Dashboard => DashboardView::render(),
                Tab::Leaderboard => LeaderboardView::render(),
                Tab::Friends => FriendsView::render(),
                Tab::Tools => ToolsView::render(),
                Tab::Support => SupportView::render(),
                Tab::Admin => AdminView::render(),
                Tab::Settings => SettingsView::render(),
            })
    }
}

fn page_container() -> impl IntoElement {
    div().p(px(16.0)).gap(px(16.0))
}

struct DashboardView;
impl Render for DashboardView {
    fn render(&mut self, _cx: &mut ViewContext<Self>) -> impl IntoElement {
        page_container()
            .child(text("Dashboard").font_weight(FontWeight::BOLD).text_size(px(26.0)))
            .child(text("Welcome back.").text_color("rgba(255,255,255,0.5)"))
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
