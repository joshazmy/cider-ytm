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
The approved Design addendum and scoped `Sidebar.svelte` implementation are committed. Locked
frontend dependencies were installed offline in the worktree without changing the lockfile. The
feature-worktree Vite server is running on 127.0.0.1:5183 and the existing same-base Tauri debug
binary is attached to it. Source-aware native preflight passed at 900, 1023, 1024, and 1100px;
fresh source-blind acceptance and immutable review remain.

## Decisions
- Use CSS breakpoint utilities only, so automatic narrow layout cannot overwrite persisted
  `ui.sidebarCollapsed` state.
- Reuse both existing `AccountMenu` variants: compact below `lg`, foot at/above `lg`.
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

## Git state
- Branch: `task/restore-responsive-sidebar-and-verify-real-desktop-journey`
- HEAD SHA: product tip `d0df3bd`; the handoff-only commit containing this record follows it
- Base SHA (review boundary): `824f6cfa0e2db51c57fd9aaa46dddd4bea8b353a`  <!-- also in .brain/ten-star/base-sha -->
- Tree: clean after the handoff commit · Commits since base: 3
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
