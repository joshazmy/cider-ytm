# Handoff — native E2E and Cider-4 visual coherence

> Current-host continuity state for Codex, Claude, and opencode. Verify every claim against
> runtime output, tests, source, and Git before continuing.

## Goal
Finish an original-Yapel, Cider-4-informed desktop UI; prove it through a retry-free real
Tauri/WebKitGTK native journey; pass immutable Ten-Star Check; push a private PR; wait for required
GitHub checks; and merge only the unchanged READY SHA. No deploy, release, signing, or publication.

## Current state
The five final UI/accessibility blockers are fixed and re-proven on the real native path. Frontend,
Rust, and a retry-free 2-test WebDriver journey with 12 required screenshots all pass. The task is
still **not READY or merged**: the implementation remains dirty until the scoped commit, then
immutable Check must run over `74f6eee..HEAD`.

The attested Plan digest is unchanged:
`33781f3985edd3b2922942eadd87b51cb64d826131cc5706747ae03237fc8a8d`.
Never edit approved-plan artifacts directly.

## Decisions
- Preserve Yapel identity; borrow only high-level music-player layout grammar. Do not copy Cider
  branding, assets, source, or unsupported feature claims.
- Linux/WebKitGTK is the only fully validated platform for this task.
- Use the real Tauri application, real WebKitWebDriver/tauri-driver, disposable XDG/SQLite state,
  closed outbound proxy, no browser surrogate, no mocked IPC, no retry, and no arbitrary sleep.
- Deterministic fixture rows may cover queue, a disposable local folder/media item, lyrics cache,
  and play history; production schemas/profiles remain untouched.
- Native 200% zoom is tested through `zoomHotkeysEnabled` and only
  `core:webview:allow-set-webview-zoom`.
- Evidence lives under ignored `artifacts/desktop-e2e/`, is per-run, hashed, redaction-scanned,
  and uploaded in CI with missing-file failure.
- Hero geometry uses a 0/1 `100vw` step at 1240px instead of min-width media queries because the
  production CSS optimizer rewrites those queries into ranges that WebKitGTK can mis-apply.
- Player compact composition starts at a 960px center container so a 1440×900 expanded desk
  (~883px center) cannot overlap time/volume/actions.
- Josh explicitly authorized autonomous product choices plus commit, private branch push, PR,
  required-check wait, and merge of the exact READY SHA. No deploy/release is authorized.

## Files changed
Current product/harness scope is 32 paths:
- CI/evidence: `.github/workflows/checks.yml`, `.gitignore`,
  `scripts/run-desktop-e2e.sh`, `docs/TESTING.md`.
- Native policy: `src-tauri/tauri.conf.json`,
  `src-tauri/capabilities/default.json`.
- Native test: `ui/e2e/desktop.e2e.mjs`, `ui/e2e/fixtures/seed.sql`.
- Shell/theme/routes: `ui/src/routes/+layout.svelte`, `+page.svelte`, `layout.css`,
  `album/[id]/+page.svelte`, `playlist/[id]/+page.svelte`, `search/+page.svelte`,
  `ui/src/lib/theme.svelte.ts`.
- UI components: HomeHero, LyricsPanel, LyricsView, NowPlaying, NowPlayingRail, PlayerBar,
  QueueList, QueuePanel, SearchSuggest, SettingsDialog, Sidebar, Titlebar, TrackFilter, TrackMenu,
  TrackRow, and the shared button primitive.
- Continuity: this handoff. Ten-Star internal lock/attestation markers remain helper-owned.

## Verification
Completed successfully before this handoff:
- `pnpm --dir ui test:unit`: 11 passed, 0 failed.
- `pnpm --dir ui check`: 0 errors, 0 warnings.
- `pnpm --dir ui build`: production build passed.
- `/home/jhondoe/.cargo/bin/cargo fmt --all --check`: passed.
- `/home/jhondoe/.cargo/bin/cargo test -p innertube -p player -p listen-protocol`:
  67 passed, 0 failed.
- `bash -n scripts/run-desktop-e2e.sh`, `node --check ui/e2e/desktop.e2e.mjs`,
  both Tauri JSON parses, and `git diff --check`: passed.
- Native command passed without retry:
  `YAPEL_E2E_CARGO=/home/jhondoe/.cargo/bin/cargo
  YAPEL_E2E_SQLITE=/home/linuxbrew/.linuxbrew/bin/sqlite3
  YAPEL_E2E_TAURI_CLI=/home/jhondoe/.cargo/bin/cargo-tauri
  YAPEL_E2E_TAURI_DRIVER=/tmp/cider-ytm-tauri-driver/bin/tauri-driver
  YAPEL_E2E_XVFB_RUN=/tmp/cider-ytm-xvfb/root/usr/bin/xvfb-run
  ./scripts/run-desktop-e2e.sh --build --artifacts artifacts/desktop-e2e`.
- Green evidence:
  `artifacts/desktop-e2e/run-20260822T034852Z-349283/manifest.json`, status passed,
  exit 0, 12 PNGs + 3 logs, each SHA-256 recorded. Logs were redaction-scanned.
- Native assertions now also cover 1241 hero sizing, 1440 player non-overlap, 44px
  seek/volume/sleep/lyrics/queue-clear targets, immersive column flow, and un-nested
  immersive play/credits.
- Canonical Plan remains attested at
  `FULL_PLAN_SHA256=33781f3985edd3b2922942eadd87b51cb64d826131cc5706747ae03237fc8a8d`.

## Git state
- Worktree: `/home/jhondoe/orca/cider-ytm.worktrees/native-e2e-and-cider-4-visual-coherence`
- Branch: `task/native-e2e-and-cider-4-visual-coherence`
- Base: `74f6eee5044824dbd159bf5775702fff6f61d1b9`
- HEAD: `c7a5cb539c007b61ec90c6463bb4a4181670224b`
- Existing task commits: 3 (`7ec44b8`, `334685e`, `c7a5cb5`).
- Tree: dirty with the scoped product/harness changes and this handoff; artifacts are ignored.
- Remote: private `https://github.com/joshazmy/cider-ytm`; nothing from this branch is pushed.
- Required identity: Joshua James <jothantranston@pm.me>.
- Lock owner: `a205180c-7ec1-4552-8119-87af13df57ee`; takeover provenance is helper-recorded.
  Do not delete `.brain/task.lock`.

## Known problems
1. No immutable Check, READY marker, commit of the current implementation, push, PR, CI result,
   or merge has happened.
2. Disposable `/tmp/cider-ytm-tauri-driver` and `/tmp/cider-ytm-xvfb` were recreated this session
   and are not part of the repository.

## Next action
1. Stage only explicit scoped paths, commit with the required identity, and make the tree clean
   except helper lock files.
2. Run Ten-Star preflight and immutable security/acceptance review over `74f6eee..HEAD`; require
   `ten-star-gate ready`.
3. Push the exact READY SHA, open the private PR, wait for all independent GitHub checks, verify the
   PR head is unchanged, merge it, and record the merged SHA. Do not deploy or release.
