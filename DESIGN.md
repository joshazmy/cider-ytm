# Yapel — Native E2E and Cider-4 Visual Coherence

Status: **approved specification**
Date: 2026-08-21
Mode: **redesign-overhaul** — visual hierarchy, layout, typography, color, and component styling may change; routes, product behavior, persistence, permissions, integrations, and accessible workflows remain contractual unless an exception below is explicitly approved.

This is the only authoritative design artifact. It specifies an original Yapel implementation informed by current Cider 4's public high-level layout grammar. It does not authorize copying Cider source, assets, names, icons, text, or proprietary feature claims.

## Decision card

- **Outcome:** A dark, art-led desktop music workbench with stable opaque navigation rails, a fluid center canvas, a contained glass transport, large media heroes, and a focused immersive lyrics mode, proven through the real Linux Tauri/WebKitGTK path.
- **System:** Atmospheric genre; Workbench macrostructure; IBM Plex Sans chrome plus Outfit for large media display; blue-black paper, warm-white ink, one desaturated rose accent; restrained motion.
- **Changed surfaces:** Shell/Home, Search/typeahead, album/playlist, immersive/lyrics, Queue/now-playing rail, and Settings. `HomeHero.svelte`, `QueuePanel.svelte`, and `LyricsPanel.svelte` are required implementation owners.
- **Behavioral exceptions:** Listen Together becomes globally reachable; “Crossfade” becomes “Fade between tracks”; the player moves inside the center region; Queue/Lyrics are overlays below 1100px; a non-null CSP replaces the current null policy.
- **Preserved contracts:** Routes, session/auth boundaries, playback and queue verbs, library writes, storage keys, manual sidebar preference, Settings values, Last.fm/Discord/MPRIS/tray behavior, mini-player, command palette, error recovery, and existing user data.
- **Primary risks:** Narrow-center crowding at 1100px, blur cost, menu/overlay clipping, focus loss during recomposition, and CSP breakage. Exact geometry, keyboard behavior, reduced motion, runtime smoke, and immutable review gate the work.
- **Baseline evidence:** Current source at `74f6eee`; existing Yapel website screenshots; current public Cider 4 interface/immersive/artist screenshots; current app checks and native evidence captured by Build.
- **Open manual actions:** None before Build. Linux visual judgment is required before READY. Windows/macOS remain explicitly unverified.

## System

- **Genre:** atmospheric — music artwork supplies the environment while opaque chrome preserves legibility and orientation.
- **Macrostructure:** Workbench — persistent navigation · fluid content canvas · conditional inspector rail · center-contained transport. Immersive is a deliberate split-studio mode, not a second navigation system.
- **Type:** Outfit Variable for media heroes and active lyric display + IBM Plex Sans Variable for all chrome, body, metadata, forms, and tables. Native mono stack only for debug-like identifiers if already present. Maximum three families; no italic display heads.
- **Palette:** paper `#0b0b0f` · raised paper `#141318` · active plate `#211e25` · ink `#f4f1f6` · muted ink `#aaa4b0` · accent `#e16b8d` · danger `#f07178`. Contrast targets are WCAG AA minimum: ink/paper 17.55:1, muted/paper 8.09:1, accent/paper 6.26:1, ink/raised 16.51:1, muted/raised 7.61:1. User-selected themes remain supported, but the factory dark evidence uses these tokens.
- **Accent hierarchy:** Solid rose is limited to active seek/volume fill, current/selected markers, focus affordance where white is unsuitable, and intentional favorite/session state. Solid accent should remain below roughly 5% of any evidence frame. Artwork-derived color may occupy the center only as a low-opacity ambient wash under a dark contrast scrim.
- **Spacing:** 4pt base: `1=4`, `2=8`, `3=12`, `4=16`, `5=20`, `6=24`, `8=32`, `10=40`, `12=48`, `16=64`, `20=80`. Chrome alignment follows the 4pt grid; optical corrections may move icons 1px.
- **Radius:** 6px compact controls, 10px fields/plates, 14px cards/panels, 18px transport and major art. Avoid one radius everywhere.
- **Elevation/material:** Opaque side rails; center canvas may use one artwork wash. Glass is reserved for the transport and immersive lyric plate: tinted translucent fill, 1px white/12% inset edge, 24–32px blur, one background-hued shadow. Content rows use paper shifts or hairlines, not floating cards.
- **Motion:** restrained. Hover/press feedback 120ms; popover/dialog opacity + 8px transform 160ms; transport/overlay entrance 180–220ms; artwork crossfade 240ms. Animate transform/opacity/color only. `prefers-reduced-motion: reduce` removes movement and smooth scrolling and reduces fades to a direct cut/80ms opacity; the E2E/manual run exercises it.
- **Control states:** default · hover · focus-visible · active · disabled · loading · error · success are specified below. Focus appears immediately as a 2px warm-white ring with 2px offset (rose only when white lacks separation). Interactive hit targets are at least 44×44px; visual glyphs may remain 16–20px.
- **Bans:** pure black; purple/blue AI gradients; gradient text; filled gradient pills; copied Cider assets/branding; all-caps meta-label wallpaper; centered full-window hero soup; nested cards; thick colored card stripes; generic three-card grids; mixed icon libraries; emoji UI icons; `transition: all`; universal hover scaling; animated layout dimensions; blur on every surface; giant radii; shadow craters; fake lossless/Atmos/BPM/genre claims; hidden focus; click-only divs; disabled zoom; screenshot-only acceptance.

## Source references and borrowed traits

| Reference | Trait intentionally studied | Boundary |
|---|---|---|
| Current Cider 4 public interface, `https://cider.sh/` and `https://cider.sh/changelogs/4.0.0` | Stable opaque outer rails surrounding an art-derived center; transport contained within the center; strong album/artist hierarchy | Translate the layout grammar using Yapel components/tokens/content; copy no source, assets, labels, or exact trade dress |
| Current Cider 4 public immersive screenshot | Left visual anchor with right lyric focus and a low transport | Recompose Yapel's existing Now Playing/lyrics behavior; no Apple-only features or artwork |
| Current Cider 4 public artist screenshot | Large art-backed hero with metadata/actions integrated into the canvas | Use only metadata Yapel already owns; no fabricated concerts, genres, or metrics |
| Existing Yapel `website/src/assets/screen-*.webp` | Honest current product breadth: playlist, lyrics, artist, Listen Together | Preserve capabilities while replacing the older thin/full-width-bar presentation |
| Current repository at approved base | Existing rose palette, responsive sidebar, semantic controls, queue/lyrics/Settings stores | Source/runtime behavior outranks screenshots when they conflict |

No new logo, generated hero, stock image, video, WebGL, or decorative bitmap is required. Media comes from the user's existing local/remote library artwork through current thumbnail helpers. Letter tiles and existing icon fallbacks remain the no-art fallback. Hugeicons remains the one interface icon family.

## Current-state baseline and disposition

| Area | Current contract and evidence | Known issue / redesign disposition |
|---|---|---|
| Routes/navigation | `/`, `/library`, `/search`, album, artist, playlist, list and search-more routes; `Sidebar.svelte` preserves destinations and active state | Preserve destinations/history. Recompose chrome only. Home remains the primary personalized route unless the stored start-page preference explicitly selects Library. |
| Forms/recovery | Search form/typeahead, playlist rename/create/delete confirmation, Settings controls, account actions; error state/toast paths exist | Preserve validation, pending guards, native form semantics, and retry/close recovery. Restyle without swallowing errors. |
| Auth/permissions | Account menu and external Google sign-in/import flow; authenticated writes remain guarded | Preserve external-browser sign-in and all permission boundaries. Do not sign in or use credentials in E2E. |
| Integrations | Last.fm, Discord RPC, Listen Together, MPRIS, tray, mini-player, update browser path | Preserve behavior. Globalize only the Listen Together trigger; do not expose hidden credentials or turn integrations on automatically. |
| Analytics/consent | No product analytics/consent surface in the desktop SPA | N/A because no analytics is added. Network-dependent assertions are excluded. |
| SEO | Static desktop SPA with SSR disabled; no public content indexing contract | N/A for this desktop slice. Preserve `svelte:head` favicon/title behavior. |
| Accessibility | Many native buttons/links/labels, transport aria names, Search combobox/listbox, dialog primitives, keyboard shortcuts | Preserve semantics; fix compact targets, visible focus, focus entry/return, Escape dismissal, hidden duplicate variants, and in-viewport overlays. |
| Localization | Current UI literals are English; no localization framework | Preserve language scope. The only changed literal is approved: “Fade between tracks.” |
| Responsive behavior | Sidebar is forced 64px below 1024 and manual 64/240 from 1024; rail begins at 1100; current overlays use mixed `lg` assumptions | Preserve sidebar state exactly. Normalize Queue/Lyrics to the separate 1100 rail contract and prove seven exact viewports. |
| Performance | Svelte static SPA, lazy artwork/thumb helpers, existing background blur, no WebGL | Keep DOM/data flow. Limit live blur layers to center wash + transport/active immersive plate; no new runtime dependency for styling. |
| Adjacent surfaces | Mini-player, command palette, add-to-playlist, channel picker, account menu, toasts, local music, track menus | Preserve and regression-test representative entry/close paths. They inherit tokens but are not structurally redesigned. |

## Intentional exceptions to the baseline

1. Move the desktop player from a window-spanning footer into the center-region stack so it never crosses the sidebar or inspector rail.
2. Make Listen Together available from the global titlebar/action cluster on every major route while retaining the existing modal and state.
3. Rename only the visible/accessibility copy “Crossfade” to “Fade between tracks”; retain the `fade_secs` setting key and behavior.
4. Keep `NowPlayingRail` hidden through 1099px and track-conditionally visible from 1100px. Below 1100px, Queue and Lyrics are center overlays rather than pseudo-docked columns.
5. Replace null CSP with the approved least-privilege policy after native feasibility proves IPC/assets.
6. Enlarge album/playlist/Home hierarchy and adopt original atmospheric treatments across the six approved surfaces. Routes, payloads, and product verbs do not change.
7. Dark-only evidence is intentional. Existing theme selection remains functional, but no light/preset visual parity claim is made.

## Global shell and responsive geometry

### Region model

The native window is a 44px titlebar over one flex row. That row contains Sidebar, a `min-width:0` center region, and optional Now Playing rail. The center owns its page scroller, transient overlays, and player. When a track exists, center content reserves 88px bottom space so the 72px transport plus 8px margins never obscures the final row.

| Window width | Sidebar | Center | Now Playing rail | Queue/Lyrics |
|---|---:|---|---:|---|
| 900–1023 | forced 64px | remaining width; no horizontal root scroll | hidden | modal overlay inside center, max 360px / 88% center width |
| 1024–1099 | remembered 240px expanded or 64px collapsed | remaining width | hidden | modal overlay inside center |
| 1100–1439 with track | remembered 240/64px | flexible, minimum 500px | `clamp(272px, 22vw, 320px)` | rail owns upcoming queue; explicit Queue/Lyrics actions may still open focused center overlay |
| 1440+ with track | remembered 240/64px | fluid | `clamp(288px, 22vw, 340px)` | rail + focused overlay behavior |
| Any width without track | same sidebar contract | fills all non-sidebar space | absent | unavailable/empty behavior remains explicit |

Exact contracts:

- `<1024px`: sidebar bounding width is 64px regardless of stored preference; wide-only nodes are not displayed or tabbable.
- `>=1024px`: manual expanded/collapsed widths are exactly 240px/64px. Resize below 1024 never writes the stored choice; returning restores it.
- `1099px`: expanded sidebar is 240px and rail is absent.
- `1100px` and `1101px`: expanded sidebar is 240px and rail is present only with a track.
- Root and body `scrollWidth <= innerWidth` at 900, 1023, 1024, 1099, 1100, 1101, and 1440.
- Sidebar, center, player, rail, dialogs, menus, and overlays may touch shared boundaries but their DOM rectangles must not overlap unintentionally.

### Chrome

- **Titlebar:** 44px, off-black/96%, 1px lower hairline. Back/forward on the left; a global 44px Listen Together button and existing status/account/window actions on the right. Drag region excludes every interactive control. Window controls remain native-looking rectangles, not pills.
- **Sidebar:** opaque `#0b0b0f`, one right hairline, 12px horizontal rhythm, 44px nav/search/account targets. Expanded search is a 40px field; active destination uses an ink/8% plate and 2px rose marker, never a full accent fill. Playlists scroll independently. Compact mode keeps semantic tooltips/labels.
- **Center canvas:** base `#0b0b0f`; artwork wash is `cover`, enlarged, desaturated slightly, blurred 28–40px, capped near 34% opacity, and covered by a top-to-bottom/directional paper scrim that protects AA text. When art is absent, use two subtle neutral radial blooms, not a blue/purple gradient.
- **Rail:** opaque `#0b0b0f` with left hairline. Header, current-track plate, queue count/source, and upcoming list align on 12/16px gutters. No fake BPM/genre/quality facts.
- **Player:** 72px center-contained glass slab, 12px horizontal and 8px bottom inset, 18px radius. Seek spans the top interior. Left is 48px art + title/artist; center is transport; right is volume and secondary actions. At center widths below 680px, lower-priority secondary actions move to the existing overflow/menu; art, title, previous/play/next, time/seek, volume, Queue, and Lyrics remain reachable.

## Surface specifications

### 1. Shell and Home

- `HomeHero.svelte` **must change**. Job: orient the user and provide the strongest current listening/recommendation anchor without becoming a marketing hero.
- Hero is 240–340px depending on center height, left-aligned, with one art focal area, a dark directional scrim, one display heading (32–52px), one supporting line, and at most two primary actions. No eyebrow + title + lede + CTA stack.
- Home action row includes Refresh and Listen Together, but the latter is also globally present. The global action is authoritative for route reachability.
- Personalized chips are a single 40px row with fade mask and keyboard scroll; shelves use density changes/hairline separators rather than nested cards.
- Loading keeps geometry with skeleton art/text/rows. Signed-out or offline empty state uses a compact explanatory panel with real Sign in/Add local folder actions already supported. Error uses the existing retry state; it does not masquerade as an empty personalized feed.

### 2. Search and typeahead

- Search page opens on a 48px field, max 720px, aligned to the center gutter. Results preserve current categories and actions.
- `SearchSuggest.svelte` keeps `role=combobox`, listbox ownership, `aria-expanded`, ArrowUp/Down, Enter selection, bare Enter submit, Escape close, and focus retention. The panel is 360–560px but capped to the center viewport and flips/anchors so all edges remain visible.
- Top result is a larger first row, not a colored badge/card. Selected/hover row uses the active paper plate plus a slim rose marker. Remove the all-caps “Top result” pill treatment.
- At 900px, suggestions never escape the center or sit under the sidebar/player. Short/long queries truncate safely. Loading uses four stable skeleton rows; empty says no quick matches; error allows the full search submit/retry path.

### 3. Album and playlist

- Above 1240px window width, hero is a two-column composition: 220–280px square art left and metadata/actions right over a minimum 320px art-led backdrop. At 1240px and below, it stacks into a compact 152–184px art/metadata composition so the center remains usable beside the rail. Long titles wrap to at most three lines; actions wrap as a group without clipping.
- Display title is Outfit 36–56px/0.98 with tight tracking; metadata is IBM Plex 13–15px. Artwork is 14–18px radius with a quiet 1px edge, never a shadow crater.
- Preserve Play, Shuffle, queue, playlist edit/delete confirmation, add-to-library/playlist, sorting/filtering, explicit markers, continuation, and local-track behavior.
- Track list is a flat 52–58px rhythm with index/play state, 40px art, title/artist, truthful metadata, duration in tabular figures, favorite/explicit/menu actions, visible keyboard focus, and no card-in-card styling.
- Loading mirrors hero/list geometry. Empty playlist owns one clear action if available. Partial continuation warnings and failures remain visible and recoverable.

### 4. Immersive and Lyrics

- `NowPlaying.svelte` remains a labeled dialog-like mode with Escape and focus entry/return. It covers the desk chrome but stays above the center-contained player.
- At 1100px+, use a 48/52 split: left artwork/metadata focal plane; right queue-or-lyrics plate. At narrower widths, artwork becomes the background/upper focal layer and one readable panel occupies the available center; no side-by-side squeeze.
- Artwork uses the largest available existing thumbnail, a dark red/neutral ambient wash, and a static fallback. No WebGL or generated media.
- Active lyric uses Outfit 30–44px, high contrast, max 18–22 words per visual line; surrounding lines step down in contrast, not blur. Unsynced/loading/error/edit/source states remain readable and actionable.
- Lyrics and Queue tab buttons are 44px, semantic, and expose selected state. Reduced motion cuts lyric scroll animation to immediate positioning.

### 5. Queue and Now Playing rail

- `QueuePanel.svelte` and `LyricsPanel.svelte` **must change** to share the 1100px contract and center-overlay geometry. Below 1100px, each opens with a dismissible scrim inside the center; max width 360px and max 88% of center. When both states are requested, the most recent focused panel is visible; do not squeeze two 320px panels side by side.
- Panel header is 52px with title, count/source where truthful, and 44px close/expand action. Focus enters the panel, Escape closes, and focus returns to its trigger.
- Queue rows expose current/upcoming state, title/artist, source when present, and accessible remove/reorder actions. The E2E-removable upcoming item has a stable semantic name. Reorder remains keyboard-operable where current behavior supports it.
- At 1100px+, `NowPlayingRail` is an inspector with current track, `N of M`, source, autoplay/clear when available, and the existing upcoming queue. It is absent without a track. It does not invent statistics.
- Empty queue, loading lyrics, unavailable lyrics, and failed mutation states have distinct copy and recovery.

### 6. Settings

- Dialog is `min(920px, 92vw)` by at most 86vh, centered, with an opaque raised-paper body and one backdrop. Desktop uses a 184px left tab rail and content pane; at constrained height/width the tabs become a horizontal scrollable strip. No nested cards for every setting.
- Tab and section hierarchy: IBM Plex 13px tabs, 20–24px section titles, 14px labels, 12px descriptions; 1px separators and density shifts group settings.
- Visible/accessibility label is **“Fade between tracks”**. Existing `fade_secs` key, switch behavior, supported value, async persistence, and restart behavior remain unchanged.
- General, Look/Themes, Playback, Data, and About remain present. Last.fm/Discord/audio/quality/tray/autostart/data clearing preserve guards and recovery.
- Dialog receives focus, traps it only while modal, closes with Escape/close control, and returns focus. Error and success use text/toast plus semantic state; color is never the only signal.

## Component interaction states

| Control family | Default | Hover | Focus-visible | Active/selected | Disabled | Loading | Error | Success |
|---|---|---|---|---|---|---|---|---|
| Navigation/link | muted ink, transparent | ink + paper plate | immediate 2px ring | active plate + rose marker / `aria-current` | muted 45%, no activation | N/A: navigation is synchronous | route/load error appears in page recovery, not link | N/A: destination state is active |
| Icon/transport button | 44px hit, muted glyph | raised plate + ink | immediate ring | 0.97 press scale; `aria-pressed` + rose glyph where stateful | 35% opacity | spinner/pulse only for an owned async action, name preserved | destructive text/icon + message | check/state text or toast, not color alone |
| Primary async button | ink on rose or paper inverse | luminance shift only | ring + offset | 0.98 press scale | 45%, cursor blocked | stable width, spinner + verb | inline reason/toast and retry | concise confirmation/toast |
| Text/search field | raised paper + 1px edge | stronger edge | 2px ring | caret/selection uses accent | 45%, value readable | adjacent stable skeleton/status | `aria-invalid`, message, destructive edge | optional confirmation text; no decorative green-only state |
| Row/option | transparent/paper shift | active paper plate | inset ring, never clipped | `aria-selected`, marker/check | 45% if action unavailable | row skeleton preserves columns | row-level retry/message | persisted/playing state visible semantically |
| Slider/switch | neutral track, 44px hit | brighter track | ring on thumb/control | rose fill + semantic value | 35%, value readable | pending value locked and announced | rollback + message | persisted value reflected; toast only when current pattern uses it |
| Popover/dialog | closed/inert | N/A | focus enters first meaningful control | open state exposed on trigger | trigger disabled when unavailable | skeleton/content status | recoverable message, Escape/close stays functional | success does not auto-close if user needs result |

Pure links and synchronous toggles mark loading/error/success N/A because they do not own asynchronous work; page/store owners surface those states. No invisible duplicate responsive control remains tabbable.

## Content, edge, and accessibility rules

- Short, long, empty, loading, error, disabled, signed-out, offline, no-art, no-track, and partial-continuation states must preserve region geometry and the primary recovery path.
- User/media strings wrap or truncate by role; never shrink below 12px. Hero titles max three lines; track and rail titles one line; dialog errors wrap freely.
- All custom controls are semantic `button`, `a`, `input`, or established dialog primitives. No click-only `div`.
- Tab order follows visual order. Enter/Space activate native controls; Arrow keys operate Search/listbox and current roving widgets; Escape closes the topmost transient layer; close returns focus to the invoker.
- Zoom remains enabled. At 200% effective scaling, content may scroll inside its owned center/dialog region but root horizontal overflow and inaccessible controls are forbidden.
- Focus rings are not animated or clipped. Tooltips supplement but never replace accessible names.
- Time/duration/count values use tabular figures. Live status uses polite announcements only where current semantics warrant it; avoid noisy lyric announcements.
- Artwork is decorative when adjacent text names the media (`alt=""`); unique content images receive truthful alt only if they are not otherwise labeled.

## Taste-quality audit

| Item(s) | Baseline hit | Design resolution |
|---|---|---|
| 1, 3, 17, 24 | Theme presets and art can create multi-accent/gradient dominance | Factory evidence locks one rose accent; artwork wash is ambient and scrimmed; no gradient text/pills; accent footprint stays restrained |
| 2, 8, 23 | Multiple bundled fonts and small current heroes flatten hierarchy | IBM Plex owns chrome; Outfit only large media/lyrics; two families; hero scale/line rules are exact |
| 4 | Current immersive uses pure black | Replace visible paper with tinted blue-black; retain black only inside media scrims where it is compositing, not the exposed surface token |
| 5, 19 | Some compact icon/menu/rail controls lack complete visible states | 44px targets and the full state matrix are binding; immediate focus rings and semantic pressed/current states |
| 6 | Loading exists, but empty/error treatments vary by surface | Each of six surfaces now specifies loading, empty/error, and recovery behavior |
| 7 | Durations/counts can use proportional figures | Player, track, queue, and metadata numbers use tabular figures |
| 9, 10 | Current uppercase “Top result”/metadata treatments can read as meta-labels | Sentence case, sparse labels, truthful product copy, no clichés/exclamations |
| 11, 16 | Current rounded panels can become nested-card stacks | Flatten lists; use paper shifts/hairlines; reserve raised plates for selection/current state |
| 12, 21 | Existing Hugeicons is coherent | Keep Hugeicons only; no emoji or second icon library |
| 13 | Current pages often center compact heroes | Heroes become deliberately asymmetric; optical alignment allowed |
| 14 | Current outer chrome can feel transparent/flat | Opaque rails + one directional art wash + one material player establish depth |
| 15 | Home could become a centered full-height marketing hero | Home hero is left-aligned, bounded to 240–340px, and limited to title/support/two actions |
| 18 | Source contains broad transition utilities | Build removes `transition: all`/generic transition use in touched surfaces and animates only named properties |
| 20 | Equal whitespace currently carries much section rhythm | Use hairlines, paper shifts, hero-to-list density changes, and active plates |
| 22 | Generic marketing rhythm is inapplicable | Named Workbench macrostructure is binding |

No audit hit is silently retained. The atmospheric exception permits a larger *soft artwork wash*, never a solid accent field.

## Acceptance poses and artifacts

Screenshots support manual judgment; semantic/geometry assertions determine pass/fail.

| Pose | Required state | Blocking assertions | Suggested artifact |
|---|---|---|---|
| A | Home, no track, 900×620 | sidebar 64; global Listen Together reachable; no root overflow; signed-out/offline state usable | `01-home-900x620.png` |
| B | Seeded track, 1023×620 | sidebar 64; rail hidden; player inside center; Queue overlay in bounds | `02-queue-1023x620.png` |
| C | Seeded track, 1024×620 expanded then collapsed | sidebar 240 then 64; manual state works; center/player stay usable | `03-shell-1024-expanded.png`, `04-shell-1024-collapsed.png` |
| D | Seeded track, 1099×860 expanded | sidebar 240; rail hidden; Queue/Lyrics overlay mode | `05-overlay-1099x860.png` |
| E | Seeded track, 1100×860 expanded | sidebar 240; rail visible; no player/rail/sidebar intersection | `06-rail-1100x860.png` |
| F | Seeded track, 1101×860 with resize cycles | expanded and collapsed preferences survive `<1024` and return; rail contract remains | `07-resize-1101x860.png` |
| G | Album or playlist, 1440×900 | large hero, flat track rhythm, center-contained player, fluid rail | `08-playlist-1440x900.png` |
| H | Immersive lyrics, 1440×900 | 48/52 composition, readable active lyric, Escape/focus return, reduced-motion behavior | `09-immersive-1440x900.png` |
| I | Search typeahead, 1024×620 | combobox/listbox keys, panel in viewport, loading/empty path | `10-search-1024x620.png` |
| J | Settings Playback, 900×620 | dialog/tabs in bounds, “Fade between tracks”, focus/Escape/return, persisted value | `11-settings-900x620.png` |

Manual review also checks visual balance, original Yapel identity, type character, artwork crop, density, selected/hover/focus differentiation, and the absence of copied Cider marks or unsupported claims. The report language is “Linux/WebKitGTK manually reviewed,” never “pixel-perfect,” “Cider parity,” or cross-platform validated.

## Build handoff and required verification

The System block, responsive region model, six surface specifications, full state matrix, taste resolutions, and acceptance poses are **acceptance criteria**, not inspiration. Build owns all implementation, native evidence, screenshot/accessibility loops, CSP, CI, and final handoff.

Required implementation owners confirmed by this Design:

- `HomeHero.svelte`: required for the approved Home hierarchy.
- `QueuePanel.svelte`: required for below-1100 center overlay and focus behavior.
- `LyricsPanel.svelte`: required for the same overlay contract.

Required commands from repository root after implementation:

```bash
/home/jhondoe/.cargo/bin/cargo fmt --all --check
pnpm --dir ui test:unit
pnpm --dir ui check
pnpm --dir ui build
/home/jhondoe/.cargo/bin/cargo test -p innertube -p player -p listen-protocol
./scripts/run-desktop-e2e.sh --build --artifacts artifacts/desktop-e2e
git diff --check
```

The native E2E must use real Tauri/WebKitGTK, disposable XDG/SQLite, one initial seed, UI-only post-seed mutations, a full restart without reseeding, bounded readiness, no test retry, no arbitrary sleep, and sanitized evidence. Linux is the only validated platform in this task.

## Out of scope

Light-theme redesign; Windows/macOS automation or claims; live Google/YTM account; remote-content assertions; lossless/Atmos/MusicKit/FairPlay/Cider plugins or marketplace; production schema migration; playback-engine replacement; public deployment/release/signing/publication; copied Cider source/assets/names/trade dress; AI-generated media; WebGL; fake metadata; screenshot-diff blocking.
