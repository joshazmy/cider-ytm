# Handoff — native E2E and Cider-4 visual coherence

> Current-host continuity state for Codex, Claude, and opencode. Verify every claim against
> runtime output, tests, source, and Git before continuing.

## Goal
Finish an original-Yapel, Cider-4-informed desktop UI; prove it through a retry-free real
Tauri/WebKitGTK native journey; pass immutable Ten-Star Check; push a private PR; wait for required
GitHub checks; and merge only the unchanged READY SHA. No deploy, release, signing, or publication.

## Current state
The visual/harness implementation was READY at `4d92e9e` and opened as private PR #2. GitHub native
E2E, frontend, and rustfmt passed on that SHA. Pure Rust tests failed linking `-lmpv` because the
job never installed `libmpv-dev`. That CI gap is now fixed in the working tree and invalidates the
previous review; Check must rerun on the new HEAD.

The attested Plan digest is unchanged:
`33781f3985edd3b2922942eadd87b51cb64d826131cc5706747ae03237fc8a8d`.
Never edit approved-plan artifacts directly.

## Decisions
- Preserve Yapel identity; borrow only high-level music-player layout grammar. Do not copy Cider
  branding, assets, source, or unsupported feature claims.
- Linux/WebKitGTK is the only fully validated platform for this task.
- Use the real Tauri application, real WebKitWebDriver/tauri-driver, disposable XDG/SQLite state,
  closed outbound proxy, no browser surrogate, no mocked IPC, no retry, and no arbitrary sleep.
- Native 200% zoom is tested through `zoomHotkeysEnabled` and only
  `core:webview:allow-set-webview-zoom`.
- The CI Pure Rust tests job must install `libmpv-dev` and `pkg-config` because `-p player` links
  libmpv. Do not drop player from that job to paper over a missing library.
- Josh authorized commit, private push, PR, required-check wait, and merge of the exact READY SHA.
  No deploy/release is authorized.

## Files changed
Product/harness scope plus the rust-tests link-deps fix:
- CI/docs: `.github/workflows/checks.yml`, `docs/TESTING.md`
- Prior implementation remains in range from `74f6eee`
- Continuity: this handoff

## Verification
Previous SHA `4d92e9e` proven locally and on GitHub native E2E. This handoff lands before the
replacement Check. Re-run fmt, unit, svelte-check, build, selected Rust tests, `git diff --check`,
and one niced native E2E, then `ten-star-gate ready` on the new HEAD.

## Git state
- Worktree: `/home/jhondoe/orca/cider-ytm.worktrees/native-e2e-and-cider-4-visual-coherence`
- Branch: `task/native-e2e-and-cider-4-visual-coherence`
- Base: `74f6eee5044824dbd159bf5775702fff6f61d1b9`
- Previous READY (invalidated by this edit): `4d92e9ea54ca528a93e5f21616f8d12e8aaca499`
- Remote: private `https://github.com/joshazmy/cider-ytm`; PR #2 is open and will move with HEAD
- Required identity: Joshua James <jothantranston@pm.me>

## Known problems
1. Previous READY evidence is stale the moment this handoff/CI fix is committed.
2. Disposable `/tmp/cider-ytm-tauri-driver` and `/tmp/cider-ytm-xvfb` are host-local.

## Next action
1. Commit this CI/docs/handoff fix.
2. Rerun complete Check on the new HEAD; require `ten-star-gate ready`.
3. Push the exact new READY SHA, wait for all independent GitHub checks, verify PR head, merge.
   Do not deploy or release.
