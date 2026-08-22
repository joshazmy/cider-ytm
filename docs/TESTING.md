# Testing Yapel

## What the native lane proves

The desktop end-to-end test runs the compiled Tauri application on Linux with WebKitGTK. It uses
the real Tauri IPC bridge, production migrations, and a real SQLite database in disposable XDG
directories. It does not use a browser mock, a fake player bridge, a live Google account,
credentials, or required public-network responses.

The pinned CI toolchain is Node 24, pnpm 11, Rust 1.97.0, Tauri CLI 2.11.4,
`tauri-driver` 2.0.6, Selenium WebDriver 4.47.0, and WebKitGTK 4.1.

## Ubuntu 24.04 prerequisites

```bash
sudo apt-get update
sudo apt-get install -y --no-install-recommends \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  libssl-dev \
  libdbus-1-dev \
  libmpv-dev \
  webkit2gtk-driver \
  xvfb \
  xauth \
  dbus-daemon \
  sqlite3 \
  util-linux \
  curl
```

`webkit2gtk-driver` provides `WebKitWebDriver`; `xvfb` provides `xvfb-run`;
`dbus-daemon` provides `dbus-run-session`; and `util-linux` provides `setsid`. On Arch, where the
WebKitGTK package does not currently include WebKitWebDriver, the runner can use the driver and
loader from an already-installed GNOME Flatpak runtime. It never installs or changes host packages.

## Fast checks

From the repository root:

```bash
pnpm --dir ui install --frozen-lockfile
cargo fmt --all --check
pnpm --dir ui test:unit
pnpm --dir ui check
pnpm --dir ui build
cargo test -p innertube -p player -p listen-protocol
git diff --check
```

`test:unit` invokes Node's built-in test runner over `src/lib/*.check.ts` and currently reports 11
passing checks. `cargo test -p player` links `libmpv`; install `libmpv-dev` and `pkg-config` first.
The CI Pure Rust tests job installs those packages for the same reason.

## Install the native tools without changing the repository

Use a disposable local tool root:

```bash
YAPEL_E2E_TOOLS="$(mktemp -d)"
npm install --prefix "$YAPEL_E2E_TOOLS/tauri-cli" @tauri-apps/cli@2.11.4
cargo install tauri-driver \
  --version 2.0.6 \
  --locked \
  --root "$YAPEL_E2E_TOOLS/tauri-driver"
```

Then run the complete native journey:

```bash
YAPEL_E2E_TAURI_CLI="$YAPEL_E2E_TOOLS/tauri-cli/node_modules/.bin/tauri" \
YAPEL_E2E_TAURI_DRIVER="$YAPEL_E2E_TOOLS/tauri-driver/bin/tauri-driver" \
./scripts/run-desktop-e2e.sh \
  --build \
  --artifacts artifacts/desktop-e2e
```

The runner accepts:

- `--build` to build a debug, no-bundle Tauri executable before testing;
- `--app PATH` to drive a specific existing executable; and
- `--artifacts PATH` to choose the evidence directory.

Tool paths can be overridden with `YAPEL_E2E_CARGO`, `YAPEL_E2E_SQLITE`,
`YAPEL_E2E_TAURI_CLI`, `YAPEL_E2E_TAURI_DRIVER`, and `YAPEL_E2E_WEBKIT_DRIVER`.
Set `YAPEL_E2E_XVFB_RUN` to an executable `xvfb-run` outside `PATH` when using a disposable
package extraction. Host-display reuse is intentionally disabled unless
`YAPEL_E2E_ALLOW_HOST_DISPLAY=1` is set because compositor scaling invalidates exact geometry.

## Isolation and lifecycle

The runner creates a disposable home plus `XDG_DATA_HOME`, `XDG_CONFIG_HOME`, `XDG_CACHE_HOME`, and
`XDG_RUNTIME_DIR` roots, and removes common credential/agent variables from runtime children. It
starts a private DBus session and isolated Xvfb display, routes proxy-aware outbound HTTP through a
closed proxy while exempting localhost, resolves exactly one application executable, and owns the
driver/app process group so cleanup is bounded. This proxy setup is deterministic offline coverage,
not kernel-level network isolation. A first native launch runs production migrations. The fixture
then inserts two inert `LOCAL:` queue records plus deterministic local-folder, lyrics-cache, and play-
history state needed for the album, lyrics, and On Repeat journeys; every later mutation is performed
through the UI. Readiness polling is bounded, and the test has no automatic retry or arbitrary sleeps.

The journey covers:

- native Tauri handshake, bundled assets, IPC, exact CSP policy, and a runtime blocked-resource probe;
- cold queue restore from real SQLite state;
- Home, Library, and Search navigation;
- offline Search combobox/listbox keyboard behavior, including 200% effective-scale containment;
- exact 900, 1023, 1024, 1099, 1100, 1101, and 1440 CSS viewport geometry;
- remembered 64/240px sidebar behavior and the 1100px rail boundary;
- Queue/Lyrics focus entry, mutual exclusion, Escape, and focus return;
- center-contained player controls and immersive-player focus behavior;
- Settings semantics and the real 5-second fade default;
- UI-only queue removal and an 8-second fade update; and
- a full native restart proving that both mutations persisted without reseeding.

## Evidence and failures

Each invocation creates a fresh `run-<UTC timestamp>-<pid>` directory beneath the requested artifact
root. It contains `runner.log`, `tauri-driver.log`, `desktop-e2e.log`, a SHA-256 `manifest.json`, and
the exact numbered PNG milestones. CI uploads it even when the job fails and retains it for 14 days. Logs are redacted
for authorization, cookie, session, and token-shaped values. Do not add credentials, a live account,
or production profile data to a fixture. Screenshots and logs aid review; semantic and geometry
assertions determine pass or fail.

Common failures:

- **Missing driver:** install `webkit2gtk-driver` or set `YAPEL_E2E_WEBKIT_DRIVER`.
- **Missing display/DBus/SQLite:** install `xvfb`, `xauth`, `dbus-daemon`, and `sqlite3`.
- **Driver readiness timeout:** inspect `tauri-driver.log` and verify driver versions before rerunning.
- **Missing executable:** use `--build` or pass the exact debug executable with `--app`.
- **Schema or restore failure:** `runner.log` records the sanitized disposable database path relative
  to `XDG_DATA_HOME`; change the
  fixture only when the production schema proves it stale.
- **Native-shell timeout:** inspect the failure screenshot, app log, CSP console output, and IPC
  availability. Do not replace the real path with a mock.

Reruns, retries, longer sleeps, and relaxed geometry are not accepted fixes for a deterministic
failure.

## Platform boundary

Automated and manual evidence in this phase covers Linux with WebKitGTK only. Windows and macOS
require separate manual verification. This evidence does not establish pixel-identical Cider
parity, generalized cross-platform visual parity, audible-quality claims, lossless audio, Atmos,
or Apple-service compatibility.
