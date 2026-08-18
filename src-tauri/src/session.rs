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

/// Google account chooser, then YTM. `continue` is percent-encoded so a desktop opener
/// cannot scrape a nested `https://music.youtube.com/` and open that instead of Google.
/// `AccountChooser` + `passive=false` so an existing Zen Google session cannot skip the
/// form and dump the user on the YTM home page (old `ServiceLogin?continue=https://…`).
pub const GOOGLE_LOGIN_URL: &str =
    "https://accounts.google.com/AccountChooser?continue=https%3A%2F%2Fmusic.youtube.com%2F&hl=en&passive=false&service=youtube";

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
        let Ok(url) = tauri::Url::parse(GOOGLE_LOGIN_URL) else { return };
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
    if let Err(e) = crate::lastfm::open_browser(GOOGLE_LOGIN_URL) {
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
        "No YouTube session in Zen/Firefox yet. Finish Google sign-in in your browser first."
            .to_string()
    })?;
    state.sign_in(cookie).await
}

fn firefox_profile_roots() -> Vec<std::path::PathBuf> {
    let Some(home) = std::env::var_os("HOME") else { return Vec::new() };
    let home = std::path::PathBuf::from(home);
    vec![
        home.join(".zen"),
        home.join(".mozilla/firefox"),
        home.join(".var/app/app.zen_browser.zen/.zen"),
        home.join(".librewolf"),
    ]
}

/// `Default=` in profiles.ini is either `1`/`0` on a `[Profile]` or a directory name on `[Install]`.
fn profiles_ini_default_dirs(root: &std::path::Path) -> Vec<std::path::PathBuf> {
    let Ok(text) = std::fs::read_to_string(root.join("profiles.ini")) else {
        return Vec::new();
    };
    text.lines()
        .filter_map(|line| {
            let value = line.trim().strip_prefix("Default=")?;
            if value == "0" || value == "1" || value.is_empty() {
                None
            } else {
                Some(root.join(value))
            }
        })
        .collect()
}

fn firefox_cookie_dbs() -> Vec<std::path::PathBuf> {
    let mut preferred = Vec::new();
    let mut rest = Vec::new();
    for root in firefox_profile_roots() {
        let defaults = profiles_ini_default_dirs(&root);
        let Ok(entries) = std::fs::read_dir(&root) else { continue };
        for ent in entries.flatten() {
            let dir = ent.path();
            let db = dir.join("cookies.sqlite");
            if !db.is_file() {
                continue;
            }
            if defaults.iter().any(|d| d == &dir) {
                preferred.push(db);
            } else {
                rest.push(db);
            }
        }
    }
    rest.sort_by_key(|p| std::fs::metadata(p).and_then(|m| m.modified()).ok());
    rest.reverse();
    preferred.extend(rest);
    preferred
}

fn youtube_cookie_host(host: &str) -> bool {
    let host = host.trim_start_matches('.');
    host == "youtube.com" || host.ends_with(".youtube.com")
}

fn table_has_column(conn: &rusqlite::Connection, name: &str) -> bool {
    conn.prepare("PRAGMA table_info(moz_cookies)")
        .and_then(|mut stmt| {
            let rows = stmt.query_map([], |row| row.get::<_, String>(1))?;
            Ok(rows.flatten().any(|col| col == name))
        })
        .unwrap_or(false)
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
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&tmp, std::fs::Permissions::from_mode(0o600));
    }
    let wal = format!("{}-wal", path.display());
    let shm = format!("{}-shm", path.display());
    let tmp_wal = format!("{}-wal", tmp.display());
    let tmp_shm = format!("{}-shm", tmp.display());
    let _ = std::fs::copy(&wal, &tmp_wal);
    let _ = std::fs::copy(&shm, &tmp_shm);
    let result = (|| {
        let conn = rusqlite::Connection::open(&tmp).ok()?;
        let _ = conn.execute_batch("PRAGMA wal_checkpoint(PASSIVE);");
        // YTM only sends .youtube.com cookies. Mixing in .google.com SID/SAPISID overwrites
        // the YouTube values (same names) and SAPISIDHASH fails — Sign in then sits on Waiting.
        let has_oa = table_has_column(&conn, "originAttributes");
        let has_exp = table_has_column(&conn, "expiry");
        let sql = match (has_oa, has_exp) {
            (true, true) => {
                "SELECT name, value, host FROM moz_cookies
                 WHERE (host = '.youtube.com' OR host = 'youtube.com' OR host = 'music.youtube.com'
                        OR host LIKE '%.youtube.com')
                   AND IFNULL(originAttributes, '') = ''
                   AND (IFNULL(expiry, 0) = 0 OR expiry > strftime('%s','now'))"
            }
            _ => {
                "SELECT name, value, host FROM moz_cookies
                 WHERE host = '.youtube.com' OR host = 'youtube.com' OR host = 'music.youtube.com'
                    OR host LIKE '%.youtube.com'"
            }
        };
        let mut stmt = conn.prepare(sql).ok()?;
        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                ))
            })
            .ok()?;
        // name → (host rank, value). music.youtube.com beats .youtube.com if both exist.
        let mut jar: std::collections::BTreeMap<String, (u8, String)> =
            std::collections::BTreeMap::new();
        for row in rows.flatten() {
            let (name, value, host) = row;
            if name.is_empty() || value.is_empty() || !youtube_cookie_host(&host) {
                continue;
            }
            // YouTube stores dozens of `ST-*` request tokens (100KB+). Sending them as Cookie
            // blows past HTTP header limits and account_menu fails — Sign in then loops on Waiting.
            if name.starts_with("ST-") {
                continue;
            }
            let rank = if host.contains("music.youtube.com") { 2 } else { 1 };
            match jar.get(&name) {
                Some((old, _)) if *old >= rank => {}
                _ => {
                    jar.insert(name, (rank, value));
                }
            }
        }
        if !jar.contains_key("SAPISID") && !jar.keys().any(|k| k.ends_with("SAPISID")) {
            return None;
        }
        tracing::info!(
            profile = %path.display(),
            cookies = jar.len(),
            "imported unpartitioned youtube cookies"
        );
        Some(
            jar.into_iter()
                .map(|(k, (_, v))| format!("{k}={v}"))
                .collect::<Vec<_>>()
                .join("; "),
        )
    })();
    let _ = std::fs::remove_file(&tmp);
    let _ = std::fs::remove_file(&tmp_wal);
    let _ = std::fs::remove_file(&tmp_shm);
    result
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

    #[test]
    fn firefox_db_keeps_youtube_sapisid_not_google() {
        let dir = std::env::temp_dir().join(format!("yapel-ff-collide-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        let db = dir.join("cookies.sqlite");
        {
            let conn = rusqlite::Connection::open(&db).unwrap();
            conn.execute_batch(
                "CREATE TABLE moz_cookies (
                    name TEXT, value TEXT, host TEXT,
                    originAttributes TEXT DEFAULT '', expiry INTEGER DEFAULT 0
                 );
                 INSERT INTO moz_cookies (name, value, host) VALUES
                    ('SAPISID', 'google-sap', '.google.com'),
                    ('SAPISID', 'yt-sap', '.youtube.com'),
                    ('__Secure-3PAPISID', 'google-3p', '.google.com'),
                    ('__Secure-3PAPISID', 'yt-3p', '.youtube.com'),
                    ('SID', 'google-sid', '.google.com'),
                    ('SID', 'yt-sid', '.youtube.com'),
                    ('ST-huge', 'xxxxxxxx', '.youtube.com'),
                    ('VISITOR_INFO1_LIVE', 'part', '.youtube.com');
                 UPDATE moz_cookies SET originAttributes = '^partitionKey=x'
                    WHERE value = 'part';",
            )
            .unwrap();
        }
        let header = cookies_from_firefox_db(&db).expect("youtube sapisid");
        assert!(header.contains("SAPISID=yt-sap"), "{header}");
        assert!(!header.contains("google-sap"), "google SAPISID must not win");
        assert!(header.contains("__Secure-3PAPISID=yt-3p"), "{header}");
        assert!(header.contains("SID=yt-sid"), "{header}");
        assert!(!header.contains("google-sid"));
        assert!(!header.contains("part"), "partitioned cookies stay out");
        assert!(!header.contains("ST-huge"), "ST request tokens stay out");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    #[ignore]
    fn live_zen_import_has_youtube_sapisid() {
        let home = std::env::var_os("HOME").expect("HOME");
        let profile = std::path::PathBuf::from(home)
            .join(".var/app/app.zen_browser.zen/.zen/evg8svcv.Default (release)/cookies.sqlite");
        if !profile.is_file() {
            return;
        }
        let cookie = import_youtube_cookies().expect("zen youtube SAPISID should import");
        assert!(
            innertube::cookie_sapisid(&cookie).is_some(),
            "imported header must carry SAPISID"
        );
        assert!(
            cookie.len() < 8_192,
            "cookie header must stay under typical HTTP limits, got {}",
            cookie.len()
        );
        assert!(
            !cookie.split(';').any(|kv| kv.trim().starts_with("ST-")),
            "ST request tokens must not ship"
        );
    }

    #[test]
    fn profiles_ini_default_is_install_path_not_flag() {
        let dir = std::env::temp_dir().join(format!("yapel-ini-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        std::fs::write(
            dir.join("profiles.ini"),
            "[Profile0]\nName=Default (release)\nIsRelative=1\nPath=evg8svcv.Default (release)\nDefault=1\n\n[InstallX]\nDefault=evg8svcv.Default (release)\n",
        )
        .unwrap();
        let defaults = profiles_ini_default_dirs(&dir);
        assert_eq!(defaults, vec![dir.join("evg8svcv.Default (release)")]);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn google_login_is_account_chooser_not_ytm_home() {
        assert!(
            GOOGLE_LOGIN_URL.starts_with("https://accounts.google.com/"),
            "sign-in must open Google, not music.youtube.com"
        );
        assert!(
            !GOOGLE_LOGIN_URL.contains("https://music.youtube.com"),
            "continue must be encoded so openers cannot scrape a second https URL"
        );
        assert!(
            GOOGLE_LOGIN_URL.contains("continue=https%3A%2F%2Fmusic.youtube.com"),
            "after Google, land on YTM so we can import cookies"
        );
        assert!(
            GOOGLE_LOGIN_URL.contains("AccountChooser"),
            "ServiceLogin skips the form when Zen already has a Google session"
        );
    }
}
