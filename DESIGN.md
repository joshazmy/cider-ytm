# Yapel — desk overhaul (2026-08-16)

Mode: **redesign-overhaul**. Six Grok 4.6 extra-high auditors (3 UI + 3 feature) + live Cider screenshot on HDMI-A-1 + GitHub `joshazmy/cider-ytm@07c3a45`. Functional contracts stay. No product implementation in this file.

Live Cider on this machine is a **three-column catalog desk** (sidebar · numbered playlist · always-on now-playing rail), not a full-bleed album island. Yapel at 1223×687 is an empty Library sentence plus a floating toolbar. That inversion is the cheap feeling.

## System
- Genre: atmospheric — late-night music desk; the collection is the page, the track tints it.
- Macrostructure: **Workbench** (primary) — sidebar · catalog · inspector rail · docked transport. Split studio is a *mode* (Ctrl+P lyrics), not the default desk.
- Type: Outfit (lyrics / playlist heroes only) + IBM Plex Sans (all chrome). No Inter, no Outfit on the word “Library”.
- Palette: paper oklch(0.12 0.012 250) / ink oklch(0.97 0.004 250) / accent oklch(0.68 0.195 8) — factory default **rose**, never blue. Seek and volume are this accent. AA+ on body.
- Spacing: 4pt. Playlist row pitch **58px** (54px plate + 4px gap). Sidebar 240px. Rail ≥250px from 1100px width.
- Motion: restrained (transform/opacity only). `prefers-reduced-motion: reduce` cuts fly-ins. Ban `transition: all`.
- Control states: default · hover · focus-visible · active · disabled · loading · error · success. Transport cluster: focus-visible ring-0 (bar is not a focus trap). Playlist row: hover plate + playing plate + play glyph replaces the index.
- Bans: max-width islands; 18/50 drop-shadow craters; update toast / Limusic OTA; factory blue sliders; Outfit page titles; sun/moon in the library tree; fake Atmos / BPM / genre chips; Cider trade dress names; white 28px play FAB; two mini-player buttons.

## Current-state baseline
| Surface | Contract now | Evidence | Disposition |
|---|---|---|---|
| Routes | `/` redirected to `/library`; album/artist/playlist/search exist | `+layout.svelte`, GitHub tree | **change** land: Home when signed out empty library is a void |
| Nav | Library/Albums/Artists/Explore/Settings | `Sidebar.svelte` | **change** Settings+account to foot; search always first |
| Auth | Titlebar Sign in; playlists hidden unsigned | grim 1223×687; `AccountMenu` | **change** account to rail foot; unsigned still a tree |
| Player bar | 3-col, hairline seek, elapsed/total | VISUAL.md `0:07 / 7:02` | **preserve** structure; **fix** color, dock, clock-on-row |
| Rail | `hidden xl:flex` (1280) | 1223 window has no rail | **fix** show at 1100px |
| Updates | browser only, no banner | Settings About | **preserve** |
| Forms / analytics / SEO / i18n | N/A desktop | — | N/A |
| A11y | aria-labels on transport | source | **preserve**; add body Sign-in control |
| Integrations | Last.fm/Discord in Settings | Last.fm keys missing on host | **preserve** placement; keys are ops not UI |

## Intentional exceptions
- Do not self-install updates. Open `https://github.com/joshazmy/cider-ytm/releases`.
- Do not invent BPM or genre chips (no field in `SongItem`). Honest rail: source playlist, N of M, like, explicit.
- Do not auto-open split-studio on every play (`openPlayer()`). Default desk is catalog + rail. Ctrl+P / bar chevron / rail card opens lyrics.
- Do not copy Cider names (Mojave, Spectrum-Deck) or claim Atmos/lossless/256-guaranteed.
- Factory theme is rose even if a stale localStorage `blue` exists — first-run and “reset desk” use rose. Users may still pick blue in Settings.

## Screens
- **Desk (default):** sidebar 240px (search well, collection, playlist tree, account foot) · catalog (playlist/album/library songs) · now-playing rail from 1100px · docked bar under the catalog+rail, not a floating island.
- **Playlist / Songs:** 58px pitch; 28px index; 40×40 art; title+album; persistent like + explicit; artist; duration; menu. Playing row: index → play glyph, stronger plate.
- **Library empty:** no 24px Outfit title. Two lines + Sign in + Add local folder. Signed-in empty is the same panel, not a shorter sentence.
- **Home / Explore:** keep HomeHero. Do not redirect first launch to an empty Library.
- **Immersive (mode):** full-bleed cover (Cider player view). Title/artist/bitrate on the plate. Lyrics overlay on the right. Largest still first (`maxresdefault` / 1600px). Covers sidebar. Desk bar stays.
- **Rail:** Now Playing card (art, title, artist, like) + “Playing Next · 2 of N · from {source}” + compact queue. Toolbar: shuffle/repeat/clear if those verbs already exist. No fake BPM.
- **Bar:** 64px flush dock (no glass crater). Seek under the title only. Center: like · prev · **36px filled SVG play / two-bar pause** · next · lyrics · clock. Right: mute · volume · mini · queue · ⋮. **Immersive = cover** (hover chevron). No whole-bar click, no shuffle/repeat on the dock. Art decode 48px.
- **Home chips:** one row, no overlay scrollbar, fade-mask the clipped tail.
- **Sign-in:** OS browser (xdg-open) + import Zen/Firefox `cookies.sqlite`. No in-app Google webview.
- **Settings:** Themes stays a product tab. Playback: Speed 1.15, Dry/DimiSco, fade, EQ, sleep — hardware/stream-client dumps go under an Advanced disclosure.

## Taste audit
1,3,17,24: factory rose, not blue; accent only on seek/selection/like. 2,8,23: Outfit off chrome titles. 4: tinted paper stays. 5,19: playing-row + hover plates. 6: Library empty becomes a panel with a control. 11,16: dock the bar; no nested cards. 15: no centered hero soup on Library. 18: delete `transition-all` on `button.svelte`. Kept: desk-glass blur (atmospheric), playlist rose pill.

## Build slices (after this Design is approved — not done in Design)
1. Factory rose + 4px rose seek/volume (`theme.svelte.ts` fallback `'rose'`; rose token `oklch(0.68 0.195 8)`; `.range`).
2. Rail at `min-[1100px]:flex`; header “2 of N from {source}”.
3. Dock bar (less shadow/radius/inset); clock on transport row; one mini; play 24px.
4. Sidebar: visible search well; selected fill; unsigned Playlists + Sign in; account at foot; Settings out of the library list.
5. Library empty panel + stop landing on it; playlist `TrackRow` 58×40, show like+explicit (stop `hideRating` on playlists).
6. MPRIS length on restore (`media.rs` / snapshot); persist last itag so the bitrate chip survives relaunch.
7. Wash: larger thumb, less scrim, honor `artworkBackground` on the desk.

## Acceptance
- Factory desk seek/volume are rose, not `oklch(0.49 0.22 264)`.
- Default 1100×860 window shows the now-playing rail when something is playing.
- Playlist page shows ≥ like + explicit + numbered rows at ~58px pitch.
- Library empty has a Sign-in control in the body.
- Clock stays `elapsed / total` with catalog fallback.
- No Limusic v0.4.6 banner; updates still `xdg-open` GitHub releases.
- Commands: `node --experimental-strip-types ui/src/lib/clock.check.ts`; `cd ui && pnpm exec svelte-check`; `cargo test -p limusic-app browser_urls_must_be_http --lib`.
- Proof: grim of class `Yapel` at ≥1100px next to Cider on HDMI — rail visible, rose seek, no empty “Library” billboard.

## Out of scope (do not build)
Atmos, lossless, MKLite, MusicKit, ciderPPE, Cider Remote, Marketplace, AirPlay, iCloud, Apple Sing, Chromecast, Spotify import, fake BPM/genre, Cider trade dress.
