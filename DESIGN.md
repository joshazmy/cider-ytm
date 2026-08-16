# Yapel — immersive now-playing

Mode: **redesign-overhaul** (screenshot as negative reference). Functional contracts stay: play/pause on art, Queue/Lyrics tabs, enlarge lyrics, letter-tile hide, Ctrl+P.

## System
- Genre: atmospheric — late-night music desk; the track is the page.
- Macrostructure: Split studio — cover left, lyrics/queue right; no centered island.
- Type: Outfit (display/lyrics) + IBM Plex Sans (UI).
- Palette: paper oklch(0.12 0.012 250) / ink oklch(0.97 0.004 250) / accent oklch(0.68 0.195 8); AA+ on body text.
- Spacing: 4pt (p-8 / gap-0, lyrics start at top).
- Motion: restrained (transform/opacity only); `prefers-reduced-motion: reduce` cuts fly-ins.
- Control states: default · hover · focus-visible (ring on the control only) · active · disabled · loading · error · success (N/A for art plate).
- Bans: max-width islands in a black void; update toast over the cover; in-app install of upstream Limusic; Cider trade dress names; fake Atmos.

## Current-state baseline (now-playing)
- Routes: overlay on any page when `np.open`; sidebar + titlebar + player bar remain.
- Auth: sign-in stays in titlebar.
- Update banner: was fixed over the cover and called Tauri self-update (upstream v0.4.6).
- Responsive: <md lyrics only; md+ two columns.
- A11y: art button has play/pause label.

## Intentional exceptions
- Update no longer self-installs. It opens `https://github.com/joshazmy/cider-ytm/releases` in the OS browser (`xdg-open`). Reason: installing Limusic 0.4.6 would overwrite this fork.
- Banner moves to top-right under the titlebar so it cannot sit on the artwork.

## Screens
- Immersive: left column ~46% width, square art `max-h: 100vh-11rem`, fill the column. Right column flex-1: tab pills at top, lyrics/queue fill remaining height from the top (not a 26rem stub).
- Player bar: unchanged transport contract.

## Acceptance
- No large empty field around a small cover on a 1920-wide window.
- Lyrics column uses remaining width and height.
- “Open in browser” uses `open_in_browser` (http(s) only).
- Commands: `cargo test -p limusic-app open_in_browser --lib` / `browser_urls_must_be_http`; `cd ui && pnpm exec svelte-check`.
