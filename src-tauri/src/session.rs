//! Login webview (context/15 Path A). Opens a visible Google sign-in window with a spoofed desktop
//! UA, watches for the redirect back to music.youtube.com, captures the resulting cookies, and
//! feeds them through the **same** sign-in path as cookie-paste (`AppState::sign_in`).
//!
//! Persistent (non-incognito) on purpose: the webview keeps its own Google session, so a later
//! re-login is one click with no password/paste — the real fix for KI-2 (cookie staleness), where
//! Google's short-lived `__Secure-*SIDTS` cookies rotate and a pasted cookie eventually stops
//! authenticating.

use std::sync::Arc;
use std::time::Duration;

use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::state::{AppState, SignInOutcome};

const LOGIN_LABEL: &str = "login";

/// WebKitGTK is a WebKit engine, so a macOS Safari UA is the most internally-consistent spoof and
/// the least likely to trip Google's "this browser may not be secure" block. **Tune here** if
/// Google rejects it — this is the fragile part (context/15 Path A).
const LOGIN_UA: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 \
                        (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15";

/// Google sign-in with `continue` back to YTM, so a successful login redirects to music.youtube.com
/// (our completion signal).
const LOGIN_URL: &str =
    "https://accounts.google.com/ServiceLogin?service=youtube&continue=https://music.youtube.com/";

/// Open the login webview. Returns immediately; sign-in completes asynchronously (the UI learns via
/// the `auth-changed` event, or `login-error` on failure).
#[allow(dead_code)]
pub fn open_login(app: AppHandle, state: Arc<AppState>) {
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<()>();

    // When the webview lands on music.youtube.com, capture cookies + sign in. Runs off the
    // event-handler thread because `cookies_for_url` can deadlock when called synchronously there.
    {
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            while rx.recv().await.is_some() {
                // The redirect that lands us here sets the youtube cookies; they may appear a beat
                // after the page finishes, so poll briefly.
                for _ in 0..6 {
                    let cookie = read_login_cookies(&app);
                    if innertube::cookie_sapisid(&cookie).is_some() {
                        match state.sign_in(cookie).await {
                            Ok(SignInOutcome::Complete) => {
                                let _ = app.emit("login-done", ());
                            }
                            // The authenticated cookie is saved, but the account remains
                            // deliberately unfinished until the main-window picker selects a
                            // server-issued delegated identity.
                            Ok(SignInOutcome::SelectionRequired) => {}
                            Err(e) => {
                                let _ = app.emit("login-error", e);
                            }
                        }
                        close_login(&app);
                        return;
                    }
                    tokio::time::sleep(Duration::from_millis(500)).await;
                }
                // Landed on music.youtube.com but not authenticated yet — keep watching.
            }
        });
    }

    // Window creation must happen on the main thread (GTK).
    let app2 = app.clone();
    let dispatched = app.run_on_main_thread(move || {
        // Reclaim the label if a prior login window is still around.
        if let Some(w) = app2.get_webview_window(LOGIN_LABEL) {
            let _ = w.destroy();
        }
        let Ok(url) = tauri::Url::parse(LOGIN_URL) else { return };
        let res = WebviewWindowBuilder::new(&app2, LOGIN_LABEL, WebviewUrl::External(url))
            .title("Sign in to YouTube Music")
            .inner_size(480.0, 720.0)
            .user_agent(LOGIN_UA)
            .on_page_load(move |_w, payload| {
                if matches!(payload.event(), PageLoadEvent::Finished)
                    && payload.url().host_str() == Some("music.youtube.com")
                {
                    let _ = tx.send(());
                }
            })
            .build();
        if let Err(e) = res {
            let _ = app2.emit("login-error", format!("Couldn't open the sign-in window: {e}"));
        }
    });
    if let Err(e) = dispatched {
        let _ = app.emit("login-error", format!("Couldn't open the sign-in window: {e}"));
    }
}

/// Merge the youtube-domain cookies into a `Cookie` header string. Reads the platform cookie store
/// (HttpOnly + secure included), matching what a browser sends to music.youtube.com.
fn read_login_cookies(app: &AppHandle) -> String {
    let Some(wv) = app.get_webview_window(LOGIN_LABEL) else { return String::new() };
    let mut jar = std::collections::BTreeMap::new();
    for base in ["https://music.youtube.com", "https://www.youtube.com"] {
        if let Ok(url) = tauri::Url::parse(base) {
            if let Ok(cookies) = wv.cookies_for_url(url) {
                for c in cookies {
                    jar.insert(c.name().to_string(), c.value().to_string());
                }
            }
        }
    }
    jar.into_iter().map(|(k, v)| format!("{k}={v}")).collect::<Vec<_>>().join("; ")
}

fn close_login(app: &AppHandle) {
    let app2 = app.clone();
    let _ = app.run_on_main_thread(move || {
        if let Some(w) = app2.get_webview_window(LOGIN_LABEL) {
            let _ = w.destroy();
        }
    });
}

/// Open Google sign-in in the user's real browser (xdg-open). Polls Firefox/Zen cookie DBs
/// until SAPISID appears, then signs in. Never opens the in-app login webview.
pub fn open_login_browser(app: AppHandle, state: Arc<AppState>) {
    if let Err(e) = crate::lastfm::open_browser(LOGIN_URL) {
        let _ = app.emit("login-error", e);
        return;
    }
    let _ = app.emit("login-browser-opened", ());
    tauri::async_runtime::spawn(async move {
        for _ in 0..150 {
            tokio::time::sleep(Duration::from_secs(2)).await;
            let Some(cookie) = import_youtube_cookies() else { continue };
            match state.sign_in(cookie).await {
                Ok(SignInOutcome::Complete) => {
                    let _ = app.emit("login-done", ());
                    return;
                }
                Ok(SignInOutcome::SelectionRequired) => return,
                Err(_) => {}
            }
        }
        let _ = app.emit(
            "login-error",
            "Sign-in timed out. Finish Google in your browser, then use Settings → Import from browser.",
        );
    });
}

/// One-shot: read YouTube cookies from the newest Firefox/Zen profile and sign in.
pub async fn import_login_from_browser(state: Arc<AppState>) -> Result<SignInOutcome, String> {
    let cookie = import_youtube_cookies().ok_or_else(|| {
        "No YouTube session in Zen/Firefox yet. Sign in at music.youtube.com in your browser first."
            .to_string()
    })?;
    state.sign_in(cookie).await
}

fn firefox_cookie_dbs() -> Vec<std::path::PathBuf> {
    let Some(home) = std::env::var_os("HOME") else { return Vec::new() };
    let home = std::path::PathBuf::from(home);
    let roots = [
        home.join(".zen"),
        home.join(".mozilla/firefox"),
        home.join(".var/app/app.zen_browser.zen/.zen"),
        home.join(".librewolf"),
    ];
    let mut out = Vec::new();
    for root in roots {
        let Ok(entries) = std::fs::read_dir(&root) else { continue };
        for ent in entries.flatten() {
            let db = ent.path().join("cookies.sqlite");
            if db.is_file() {
                out.push(db);
            }
        }
    }
    out.sort_by_key(|p| std::fs::metadata(p).and_then(|m| m.modified()).ok());
    out.reverse();
    out
}

fn cookies_from_firefox_db(path: &std::path::Path) -> Option<String> {
    let tmp = std::env::temp_dir().join(format!(
        "yapel-cookies-{}.sqlite",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    ));
    std::fs::copy(path, &tmp).ok()?;
    let conn = rusqlite::Connection::open(&tmp).ok()?;
    let mut stmt = conn
        .prepare(
            "SELECT name, value FROM moz_cookies WHERE host LIKE '%youtube.com' OR host LIKE '%google.com'",
        )
        .ok()?;
    let rows = stmt
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .ok()?;
    let mut jar = std::collections::BTreeMap::new();
    for row in rows.flatten() {
        if !row.0.is_empty() && !row.1.is_empty() {
            jar.insert(row.0, row.1);
        }
    }
    let _ = std::fs::remove_file(&tmp);
    if !jar.contains_key("SAPISID") && !jar.keys().any(|k| k.ends_with("SAPISID")) {
        return None;
    }
    Some(jar.into_iter().map(|(k, v)| format!("{k}={v}")).collect::<Vec<_>>().join("; "))
}

pub(crate) fn import_youtube_cookies() -> Option<String> {
    for db in firefox_cookie_dbs() {
        if let Some(cookie) = cookies_from_firefox_db(&db) {
            return Some(cookie);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn firefox_db_yields_sapisid_header() {
        let dir = std::env::temp_dir().join(format!("yapel-ff-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        let db = dir.join("cookies.sqlite");
        {
            let conn = rusqlite::Connection::open(&db).unwrap();
            conn.execute_batch(
                "CREATE TABLE moz_cookies (name TEXT, value TEXT, host TEXT);
                 INSERT INTO moz_cookies VALUES ('SAPISID', 'unit-test', '.youtube.com');
                 INSERT INTO moz_cookies VALUES ('LOGIN_INFO', 'x', '.youtube.com');",
            )
            .unwrap();
        }
        let header = cookies_from_firefox_db(&db).expect("sapisid");
        assert!(header.contains("SAPISID=unit-test"), "header must carry SAPISID");
        let _ = std::fs::remove_dir_all(&dir);
    }
}
