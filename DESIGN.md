# Yapel — desk chrome

Mode: **redesign-overhaul** (screenshot as negative reference: centered island + “Update now v0.4.6” card). Functional contracts stay: play/pause, Queue/Lyrics, letter-tile hide, Ctrl+P, Open-in-OS-browser.

## System
- Genre: atmospheric — late-night music desk; the track is the page.
- Macrostructure: Split studio (immersive) + three-column transport (desk bar). No max-width island in a black void.
- Type: Outfit (display/lyrics) + IBM Plex Sans (UI).
- Palette: paper oklch(0.12 0.012 250) / ink oklch(0.97 0.004 250) / accent oklch(0.68 0.195 8); AA+ on body text.
- Spacing: 4pt.
- Motion: restrained (transform/opacity only); `prefers-reduced-motion: reduce` cuts fly-ins.
- Control states: default · hover · focus-visible (ring on the control only) · active · disabled · loading · error · success (N/A for art plate).
- Bans: max-width islands in a black void; update toast over the cover; in-app install of upstream Limusic; Cider trade dress names; fake Atmos; `transition: all`; purple/blue AI gradients; Inter/system-only type.

## Current-state baseline
- Routes: overlay on any page when `np.open`; sidebar + titlebar + player bar remain.
- Auth: sign-in stays in titlebar.
- Update: Tauri plugin still listed, but UI must never call `check()` against SimoHypers/limusic.
- Responsive: player bar 3-column from `minWidth` 900; <md immersive lyrics only.
- A11y: art button has play/pause label; transport buttons keep `aria-label`.
- Forms / analytics / SEO / localization: N/A (local desktop, no public site).
- Integrations: Last.fm / Discord stay in Settings; they already use `xdg-open`.

## Intentional exceptions
- Updates never self-install. Settings “Check for updates” / “Open in browser” opens `https://github.com/joshazmy/cider-ytm/releases` via `open_in_browser` (http(s) only). Reason: installing Limusic 0.4.6 would overwrite this fork.
- No launch banner. A card that says “v0.4.6” is the wrong product.
- Player time is `elapsed / total` (Cider desk), not `elapsed / −remaining`. Total falls back to catalog `now.duration` / queue duration when mpv reports 0 (paused restore).
- Now-playing rail card opens immersive lyrics; it does **not** toggle play.

## Screens
- Immersive: left column ~46% width, square art `max-h: 100vh-11rem`. Right column flex-1: tab pills, lyrics/queue fill height.
- Player bar (desk): hairline seek on top; left = art + title/artist/album + bitrate; center = like · prev · play · next · lyrics + clock; right = volume · add · shuffle · repeat · mini · queue · menu · expand.
- Library rail: distinct glyphs (library / album / artist / home). Search first.

## Taste audit
1–4, 17, 24: single rose accent, tinted paper, no gradient CTA. 2/8/23: Outfit + IBM Plex Sans. 5/19: ghost + filled play, focus-visible ring-0 on transport cluster (bar is not a focus trap). 11/15: no island hero, no dual CTA on a toast. 18: no `transition: all`. Kept: frosted bar (desk-glass) — atmospheric depth, not a nested card.

## Acceptance
- No “Update available — v0.4.6” card.
- “Open in browser” uses `open_in_browser` (http(s) only) and `xdg-open`.
- Restored paused track shows a real total (not `-0:00`).
- Transport cluster is optically centered, not packed left of the seek.
- Commands: `cargo test -p limusic-app browser_urls_must_be_http --lib`; `node --experimental-strip-types ui/src/lib/clock.check.ts`; `cd ui && pnpm exec svelte-check`.
