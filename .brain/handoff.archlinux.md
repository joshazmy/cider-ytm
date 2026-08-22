# Handoff — native E2E and Cider-4 visual coherence

> Current-host continuity state for Codex, Claude, and opencode. Verify every claim against
> runtime output, tests, source, and Git before continuing.

## Goal
Prove the compiled Tauri/WebKitGTK app through a retry-free whole-app native journey.
Linux/WebKitGTK only. No live Google account, no deploy, no release.

## Current state
PR #2 is merged. READY SHA `8024ee5dbbf2969d9735999c2aa9a6b9598baa3a` is an ancestor of
`origin/master` via merge `b21d051ca8ee39394bca84d1f924418fd497cb8f`.

This commit adds the post-merge whole-app surface walk on the real desktop path. Latest
green local run before commit: `artifacts/desktop-e2e/run-20260822T050608Z-2637439` — 2/2,
53.6s, already-built debug binary (no `--build`). Local artifact directories are disposable
and were cleaned after that proof.

The attested Plan digest is unchanged:
`33781f3985edd3b2922942eadd87b51cb64d826131cc5706747ae03237fc8a8d`.
Never edit approved-plan artifacts directly.

## Decisions
- Preserve Yapel identity; borrow only high-level music-player layout grammar.
- Real Tauri app, WebKitWebDriver/tauri-driver, disposable XDG/SQLite, closed outbound proxy,
  no mocked IPC, no retry, no arbitrary sleep.
- Expanded sidebar Search is a field, not `a[href="/search"]`. Reach `/search` via a temporary
  in-page deep link (or the collapsed-rail icon at `<1024`).
- Settings keeps the last tab while the dialog stays mounted. Reduce motion lives on General.
- Library Local **Play all** / **Shuffle** exist on the nested songs view. Do not click Play
  all if a later assertion still needs the seeded Deterministic Upcoming row.
- One niced native E2E at a time. Do not set `YAPEL_E2E_ALLOW_HOST_DISPLAY`.

## Files in this follow-up
- `ui/e2e/desktop.e2e.mjs` — whole-app surface tour inside the seeded journey
- `docs/TESTING.md` — journey coverage
- this handoff

## Verification
```
export PATH="/tmp/cider-ytm-xvfb/root/usr/bin:$PATH"
export YAPEL_E2E_CARGO=/home/jhondoe/.cargo/bin/cargo
export YAPEL_E2E_SQLITE=/home/linuxbrew/.linuxbrew/bin/sqlite3
export YAPEL_E2E_TAURI_CLI=/home/jhondoe/.cargo/bin/cargo-tauri
export YAPEL_E2E_TAURI_DRIVER=/tmp/cider-ytm-tauri-driver/bin/tauri-driver
export YAPEL_E2E_XVFB_RUN=/tmp/cider-ytm-xvfb/root/usr/bin/xvfb-run
APP=/tmp/cursor-sandbox-cache/ca675b0de3e290c62be734de78de36b5/cargo-target/debug/Yapel
nice -n 15 ionice -c3 ./scripts/run-desktop-e2e.sh --app "$APP" --artifacts artifacts/desktop-e2e
```
Result: pass 2 / fail 0.

## Git state
- Worktree: `/home/jhondoe/orca/cider-ytm.worktrees/native-e2e-and-cider-4-visual-coherence`
- Branch: `task/native-e2e-and-cider-4-visual-coherence`
- Remote: private `https://github.com/joshazmy/cider-ytm`
- Required identity: Joshua James <jothantranston@pm.me>
- No deploy/release

## Known problems
1. Disposable `/tmp/cider-ytm-tauri-driver` and `/tmp/cider-ytm-xvfb` are host-local.
2. No signed-in YouTube Music, Windows, or macOS coverage.

## Next action
Push this follow-up and open a PR into `master`. Do not deploy.
