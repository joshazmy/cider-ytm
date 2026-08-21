# Handoff — restore responsive sidebar and verify real desktop journey

> The one shared cross-CLI memory surface for this task worktree (Codex, Claude, and
> opencode all read + write this file). Overwrite it so it always reflects **NOW** — it
> is state, not a log. Real decisions append to `.brain/decisions.md`; dead ends to
> `.brain/tried.md`.
>
> **Incoming agent: verify before you trust.** Everything below is a *lead, not a verdict*.
> Re-run the verification commands and re-check the git state yourself before building on
> any claim here (see the AGENTS.md source-of-truth hierarchy: code+tests > git > this).

## Goal
Restore Yapel's responsive sidebar: 64px below 1024px, 240px at/above 1024px when expanded,
with the stored large-screen manual collapse preference preserved. Prove the final local commit
through the real Tauri WebView, source-blind desktop acceptance, and immutable-range review.

## Current state
The approved Design addendum and scoped `Sidebar.svelte` implementation are committed. An initial
immutable review caught the compact account menu using the wrong titlebar anchor; the implementation
now keeps compact controls icon-only while using the existing bottom-left/above `foot` anchor. Locked
frontend dependencies were installed offline without changing the lockfile. The feature-worktree
Vite server and existing same-base Tauri debug binary are running. Source-aware native preflight
passed at 900, 1023, 1024, and 1100px; fresh source-blind acceptance and repeat immutable review remain.

## Decisions
- Use CSS breakpoint utilities only, so automatic narrow layout cannot overwrite persisted
  `ui.sidebarCollapsed` state.
- Reuse both existing `AccountMenu` variants: compact below `lg`, foot at/above `lg`.
- Use the existing `foot` placement for compact sidebar account triggers too; wrapper selectors hide
  only the label/chevron so the popup opens above and inside the left viewport edge.
- Do not add Playwright, fixtures, dependencies, CI, native changes, or unrelated UI polish.
- Park locally after READY; GitHub push/PR/merge/deploy are not authorized.

## Files changed
- `.brain/.gitignore` — ignores volatile Ten-Star boundary state.
- `.brain/handoff.archlinux.md` — this current-host continuity record.
- `DESIGN.md` — approved redesign-preserve responsive sidebar contract and acceptance matrix.
- `ui/src/lib/components/Sidebar.svelte` — base 64px rail, `lg:` wide expansion/visibility/alignment,
  and responsive account variants.

## Verification
- Pre-fix real Tauri at 900×620: screenshot and visual inspection showed a ~240px wide sidebar with
  wide labels; this reproduced the failure.
- `node --experimental-strip-types ui/src/lib/*.check.ts`: 11/11 files exited 0 (one Node
  experimental localStorage warning; no failed assertion).
- `cd ui && pnpm check`: `svelte-check found 0 errors and 0 warnings`.
- `cd ui && pnpm build`: Vite 8.1.3 production build completed and adapter-static wrote `build`.
- `git diff --check`: exited 0.
- Source-aware real Tauri preflight: Hyprland confirmed 1023×620 exposed the compact Search link and
  no Collapse control; 1024×620 exposed Collapse and wide Playlists. At 1100×860, manual collapse
  exposed Expand, remained collapsed after 900→1100, then expansion remained expanded after the
  same resize cycle.
- Review-fix preflight at 900×620: compact account trigger opened an accessible menu with Close and
  account actions; compositor screenshot confirmed the full 288px panel remained above and inside
  the window. The menu then closed through its labeled action.

## Git state
- Branch: `task/restore-responsive-sidebar-and-verify-real-desktop-journey`
- HEAD SHA: `dc46416` before the review correction; the commit containing this record adds only the
  scoped compact-account anchor correction plus this handoff update
- Base SHA (review boundary): `824f6cfa0e2db51c57fd9aaa46dddd4bea8b353a`  <!-- also in .brain/ten-star/base-sha -->
- Tree: clean after the correction commit · Commits since base: 4
- Pushed: NO — local park explicitly approved; GitHub delivery not authorized
- Reviewed HEAD: pending immutable Check

## Known problems
Cargo/rustc are absent from PATH, so Rust tests and a native rebuild were not run. This UI-only task
uses the existing debug binary built from the same base repository and the exact feature-worktree
Vite UI. The persisted YTM session is expired, but local navigation, account controls, queue, and
now-playing chrome remain available for safe acceptance. Orca's accessibility tree works; its own
window bitmap is black under this compositor, so Hyprland-sized `grim` captures provide visual proof.

## Next action
Run a fresh source-blind real-desktop journey on the exact clean final HEAD, then perform immutable
base-range review, record runnable acceptance evidence, and require `ten-star-gate ready` before
`task-finish` and local parking.
