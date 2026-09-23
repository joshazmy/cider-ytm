# Yapel

Linux desktop player for YouTube Music. Rust, Tauri 2, and libmpv — the UI is a SvelteKit app, and audio never goes through a bundled browser.

Yapel is a GPL fork of [Limusic](https://github.com/SimoHypers/limusic) by SimoHypers. The fork point is Limusic 0.4.5 (`cd1ca3f`). Modifications started on 2026-08-16: a desk layout (sidebar, catalog, now-playing rail, docked transport), sign-in through the system browser, and updates that open this repo’s releases page instead of installing upstream Limusic over the app.

Linux AppImage: [Yapel 0.5.0](https://github.com/joshazmy/cider-ytm/releases/download/v0.5.0/Yapel_0.5.0_amd64.AppImage). It needs glibc 2.39 or newer (Ubuntu 24.04+, Debian 13+, Fedora 40+, current Arch). Mark it executable and run it. Building from source is below.

## What works

- Search, Home, albums, artists, playlists, and the library
- Ad-free audio from YouTube’s stream URLs, through libmpv (gapless playback, on-disk cache, loudness normalization)
- Queue with radio continuation, restored across restarts
- Synced lyrics, plus lyrics you paste yourself
- Local audio files
- Google sign-in from Zen, Firefox, or LibreWolf, or by pasting a YouTube Cookie header
- Last.fm scrobbling and Discord Rich Presence
- MPRIS media keys on Linux, a system tray, and an optional mini player
- Listen Together: a small self-hosted WebSocket relay (`cargo run -p sync-server`)

Linux with WebKitGTK is the platform CI actually runs. Windows and macOS build notes are in [docs/BUILD-PLATFORMS.md](docs/BUILD-PLATFORMS.md). Those installers are not published from this repo.

## Sign in

Sign in opens Google in your default browser, then reads the YouTube cookies from a Zen, Firefox, or LibreWolf profile on this machine (including Flatpak Zen). Finish signing in at YouTube Music in that browser, then choose **I've signed in** if the app is still waiting.

Chrome and other browsers are not read from disk. In the account menu, paste the `Cookie` header from a `music.youtube.com` request. The paste has to include `SAPISID`.

Library playback still works without an account. Your playlists need a session.

## Build on Linux

Rust stable, Node, pnpm, and the Tauri CLI (`cargo install tauri-cli --version "^2"`).

Arch:

```bash
sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file openssl \
  appmenu-gtk-module libappindicator-gtk3 librsvg mpv
```

Fedora:

```bash
sudo dnf install mpv-libs mpv-libs-devel webkit2gtk4.1-devel \
  gcc gcc-c++ make openssl-devel librsvg2-devel
```

Then, from this repo:

```bash
pnpm --dir ui install
cargo tauri dev
```

`cargo tauri dev` runs the app with hot reload. A release binary without an installer:

```bash
pnpm --dir ui build
cargo build --release -p limusic-app --bin Yapel
```

The binary is `target/release/Yapel`. It still needs libmpv and WebKitGTK on the machine.

`cargo tauri build` produces installers and expects `TAURI_SIGNING_PRIVATE_KEY` because updater artifacts are turned on. That key is not in the repo, and this fork does not publish signed updates. Use the commands above to run it.

Last.fm is optional. Create a key at [last.fm/api/account/create](https://www.last.fm/api/account/create) and put it in `src-tauri/lastfm.keys` (gitignored):

```
LIMUSIC_LASTFM_API_KEY=your_key
LIMUSIC_LASTFM_API_SECRET=your_secret
```

Without that file the app still runs. The Last.fm control reports that it is not configured.

## Development

```bash
cargo fmt --all
cargo test -p innertube -p player -p listen-protocol
pnpm --dir ui check
```

`cargo test -p player` links libmpv. The native desktop journey is described in [docs/TESTING.md](docs/TESTING.md).

House style for UI changes is in [CONTRIBUTING.md](CONTRIBUTING.md).

## How playback reaches YouTube

A Rust crate speaks YouTube’s InnerTube API and falls back across several client identities. Stream URLs are unwrapped in a hidden webview (signature cipher, `n` parameter, BotGuard). The Svelte UI only talks to the Rust core over Tauri commands.

## Disclaimer

Yapel is not affiliated with, funded, authorized, endorsed by, or in any way associated with YouTube, Google LLC, or any of their affiliates.

All trademarks, service marks, and intellectual property rights referenced here belong to their respective owners. Yapel is not Cider and not Limusic’s official release channel.

## License

[GPL-3.0](LICENSE), the same license as Limusic. This fork’s changes are under that license too.
