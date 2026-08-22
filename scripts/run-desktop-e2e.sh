#!/usr/bin/env bash
set -euo pipefail

# Arch does not package WebKitWebDriver with webkit2gtk. When this file is invoked through the
# temporary symlink below, run the driver from the already-installed GNOME Flatpak runtime with its
# own loader. This is intentionally unsandboxed: the driver must launch the host-built Yapel binary,
# and invoking the loader directly avoids passing a runtime LD_LIBRARY_PATH to that child.
if [[ "${0##*/}" == "yapel-webkit-webdriver" ]]; then
	flatpak_runtime="${YAPEL_E2E_FLATPAK_RUNTIME:-org.gnome.Platform//50}"
	flatpak_root="$(flatpak info --show-location "$flatpak_runtime")/files"
	exec \
		"$flatpak_root/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2" \
		--library-path "$flatpak_root/lib/x86_64-linux-gnu:$flatpak_root/lib" \
		"$flatpak_root/bin/WebKitWebDriver" \
		"$@"
fi

script_path="$(realpath "${BASH_SOURCE[0]}")"
repo_root="$(dirname "$(dirname "$script_path")")"

# Use a private DBus and Xvfb even inside a developer desktop: compositor scaling/tiling makes CSS
# viewport measurements non-deterministic. Host display reuse requires an explicit diagnostic
# opt-in. The inner invocation is marked so this wrapper runs only once.
if [[ "${YAPEL_E2E_SESSION:-0}" != "1" ]]; then
	xvfb_runner=""
	xvfb_path=""
	if [[ -n "${YAPEL_E2E_XVFB_RUN:-}" ]]; then
		if [[ ! -x "$YAPEL_E2E_XVFB_RUN" ]]; then
			printf 'error: YAPEL_E2E_XVFB_RUN is not executable: %s\n' "$YAPEL_E2E_XVFB_RUN" >&2
			exit 2
		fi
		xvfb_runner="$YAPEL_E2E_XVFB_RUN"
		xvfb_path="$(dirname "$xvfb_runner")"
	elif command -v xvfb-run >/dev/null 2>&1; then
		xvfb_runner="$(command -v xvfb-run)"
	fi
	if [[ -n "$xvfb_runner" ]] && command -v dbus-run-session >/dev/null 2>&1; then
		exec dbus-run-session -- env -u WAYLAND_DISPLAY \
			PATH="${xvfb_path:+$xvfb_path:}$PATH" \
			"$xvfb_runner" -a -s "-screen 0 1440x900x24" \
			env YAPEL_E2E_SESSION=1 "$script_path" "$@"
	fi
	if [[ "${YAPEL_E2E_ALLOW_HOST_DISPLAY:-0}" == "1" && -n "${DISPLAY:-}" ]]; then
		if command -v dbus-run-session >/dev/null 2>&1; then
			exec dbus-run-session -- env YAPEL_E2E_SESSION=1 "$script_path" "$@"
		fi
		exec env YAPEL_E2E_SESSION=1 "$script_path" "$@"
	fi
	printf 'error: desktop E2E requires dbus-run-session plus xvfb-run (or YAPEL_E2E_XVFB_RUN)\n' >&2
	exit 2
fi

# Evidence and disposable profiles may contain local paths or application state. Keep every file
# private even when the caller has a permissive shell umask.
umask 077

usage() {
	printf 'Usage: %s [--build] [--app PATH] [--artifacts PATH]\n' "${0##*/}" >&2
}

build_app=0
app_path=""
artifact_arg=".brain/ten-star/desktop-e2e"
while (($#)); do
	case "$1" in
		--build)
			build_app=1
			shift
			;;
		--app)
			[[ $# -ge 2 ]] || { usage; exit 2; }
			app_path="$2"
			shift 2
			;;
		--artifacts)
			[[ $# -ge 2 ]] || { usage; exit 2; }
			artifact_arg="$2"
			shift 2
			;;
		-h|--help)
			usage
			exit 0
			;;
		*)
			printf 'error: unknown desktop E2E argument: %s\n' "$1" >&2
			usage
			exit 2
			;;
	esac
done

require_command() {
	if ! command -v "$1" >/dev/null 2>&1; then
		printf 'error: desktop E2E requires %s\n' "$1" >&2
		exit 2
	fi
}

require_command node
require_command pnpm
require_command curl
require_command setsid

cargo_bin="${YAPEL_E2E_CARGO:-}"
if [[ -z "$cargo_bin" ]]; then
	if command -v cargo >/dev/null 2>&1; then
		cargo_bin="$(command -v cargo)"
	else
		printf 'error: desktop E2E requires cargo (or YAPEL_E2E_CARGO)\n' >&2
		exit 2
	fi
fi

sqlite_bin="${YAPEL_E2E_SQLITE:-}"
if [[ -z "$sqlite_bin" ]]; then
	if command -v sqlite3 >/dev/null 2>&1; then
		sqlite_bin="$(command -v sqlite3)"
	else
		printf 'error: desktop E2E requires sqlite3 (or YAPEL_E2E_SQLITE)\n' >&2
		exit 2
	fi
fi

tauri_cli="${YAPEL_E2E_TAURI_CLI:-}"
if [[ -z "$tauri_cli" ]]; then
	if command -v tauri >/dev/null 2>&1; then
		tauri_cli="$(command -v tauri)"
	elif [[ -x "$(dirname "$cargo_bin")/cargo-tauri" ]]; then
		tauri_cli="$(dirname "$cargo_bin")/cargo-tauri"
	fi
fi

artifact_root="$(realpath -m "$artifact_arg")"
repo_abs="$(realpath "$repo_root")"
user_home="${HOME:-}"
if [[ "$artifact_root" == "/" || "$artifact_root" == "$repo_abs" || -n "$user_home" && "$artifact_root" == "$(realpath "$user_home")" ]]; then
	printf 'error: refusing unsafe desktop E2E artifact directory: %s\n' "$artifact_root" >&2
	exit 2
fi
run_stamp="$(date -u +%Y%m%dT%H%M%SZ)"
artifact_dir="$artifact_root/run-$run_stamp-$$"
mkdir -p "$artifact_dir"

temp_parent="${TMPDIR:-/tmp}"
temp_root="$(mktemp -d "$temp_parent/yapel-native-e2e.XXXXXX")"
driver_pid=""
driver_raw="$temp_root/tauri-driver.raw.log"
test_raw="$temp_root/desktop-e2e.raw.log"
runner_raw="$temp_root/runner.raw.log"

redact_stream() {
	sed -E \
		-e 's/([Aa]uthorization:[[:space:]]*).*/\1[REDACTED]/' \
		-e 's/([Pp]roxy-[Aa]uthorization:[[:space:]]*).*/\1[REDACTED]/' \
		-e 's/([Cc]ookie:[[:space:]]*).*/\1[REDACTED]/' \
		-e 's/([Ss]et-[Cc]ookie:[[:space:]]*).*/\1[REDACTED]/' \
		-e 's/((session_cookie|access_token|refresh_token|token|cookie)["=: ]+)[^ ,;"[:space:]]+/\1[REDACTED]/Ig' \
		-e 's#(https?://)[^/@[:space:]]+@#\1[REDACTED]@#g'
}

redact_log() {
	local source_file="$1"
	local destination_file="$2"
	if [[ -f "$source_file" ]]; then
		redact_stream < "$source_file" > "$destination_file"
	fi
}

redaction_probe="$(printf '%s\n' \
	'Authorization: Bearer test-bearer-payload' \
	'Cookie: sid=test-cookie-value; follow=test-follow-on-cookie' \
	'session_cookie=test-session-value token=test-token-value' \
	'https://test-user:test-password@example.invalid/private' | redact_stream)"
case "$redaction_probe" in
	*test-bearer-payload*|*test-cookie-value*|*test-follow-on-cookie*|*test-session-value*|*test-token-value*|*test-password*)
		printf 'error: desktop E2E log redaction self-test failed\n' >&2
		exit 2
		;;
esac

write_manifest() {
	local exit_code="$1"
	local status="failed"
	if [[ "$exit_code" == "0" ]]; then status="passed"; fi
	YAPEL_E2E_MANIFEST_DIR="$artifact_dir" \
	YAPEL_E2E_MANIFEST_STATUS="$status" \
	YAPEL_E2E_MANIFEST_EXIT="$exit_code" \
		node --input-type=module -e '
			import { createHash } from "node:crypto";
			import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
			import path from "node:path";
			const dir = process.env.YAPEL_E2E_MANIFEST_DIR;
			const files = readdirSync(dir)
				.filter((name) => name !== "manifest.json" && statSync(path.join(dir, name)).isFile())
				.sort()
				.map((name) => {
					const data = readFileSync(path.join(dir, name));
					return { name, bytes: data.length, sha256: createHash("sha256").update(data).digest("hex") };
				});
			writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({
				schemaVersion: 1,
				status: process.env.YAPEL_E2E_MANIFEST_STATUS,
				exitCode: Number(process.env.YAPEL_E2E_MANIFEST_EXIT),
				generatedAt: new Date().toISOString(),
				files
			}, null, 2) + "\n");
		'
}

cleanup() {
	local exit_code=$?
	local manifest_exit=0
	trap - EXIT INT TERM
	if [[ -n "$driver_pid" ]] && kill -0 -- "-$driver_pid" 2>/dev/null; then
		kill -TERM -- "-$driver_pid" 2>/dev/null || true
		for _ in {1..30}; do
			kill -0 -- "-$driver_pid" 2>/dev/null || break
			sleep 0.1
		done
		if kill -0 -- "-$driver_pid" 2>/dev/null; then
				kill -KILL -- "-$driver_pid" 2>/dev/null || true
			fi
		fi
	if [[ -n "$driver_pid" ]]; then
		wait "$driver_pid" 2>/dev/null || true
	fi
	redact_log "$runner_raw" "$artifact_dir/runner.log"
	redact_log "$driver_raw" "$artifact_dir/tauri-driver.log"
	redact_log "$test_raw" "$artifact_dir/desktop-e2e.log"
	if ! write_manifest "$exit_code"; then
		manifest_exit=1
		printf 'error: could not write desktop E2E evidence manifest\n' >&2
	fi
	case "$temp_root" in
		"$temp_parent"/yapel-native-e2e.*) rm -rf -- "$temp_root" ;;
		*) printf 'warning: refusing to remove unexpected temporary path: %s\n' "$temp_root" >&2 ;;
	esac
	if ((exit_code == 0 && manifest_exit != 0)); then exit_code=$manifest_exit; fi
	exit "$exit_code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

xdg_data="$temp_root/xdg-data"
xdg_config="$temp_root/xdg-config"
xdg_cache="$temp_root/xdg-cache"
xdg_runtime="$temp_root/xdg-runtime"
runtime_home="$temp_root/home"
desktop_runtime="${XDG_RUNTIME_DIR:-}"
desktop_wayland="${WAYLAND_DISPLAY:-}"
mkdir -p "$xdg_data" "$xdg_config" "$xdg_cache" "$xdg_runtime" "$runtime_home"
chmod 700 "$xdg_runtime" "$runtime_home"

if ((build_app)); then
	if [[ -z "$tauri_cli" || ! -x "$tauri_cli" ]]; then
		printf 'error: --build requires Tauri CLI 2 (set YAPEL_E2E_TAURI_CLI)\n' >&2
		exit 2
	fi
	(
		cd "$repo_root"
		PATH="$(dirname "$cargo_bin"):$PATH" \
			RUST_MIN_STACK="${RUST_MIN_STACK:-16777216}" \
			CARGO_BUILD_JOBS="${CARGO_BUILD_JOBS:-2}" \
			"$tauri_cli" build --debug --no-bundle
	)
fi

if [[ -z "$app_path" ]]; then
	target_dir="$($cargo_bin metadata --format-version 1 --no-deps --manifest-path "$repo_root/Cargo.toml" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).target_directory))')"
	app_path="$target_dir/debug/Yapel"
fi
app_path="$(realpath -m "$app_path")"
if [[ ! -x "$app_path" ]]; then
	printf 'error: native debug executable is missing or not executable: %s\n' "$app_path" >&2
	exit 2
fi

tauri_driver="${YAPEL_E2E_TAURI_DRIVER:-}"
if [[ -z "$tauri_driver" ]]; then
	if command -v tauri-driver >/dev/null 2>&1; then
		tauri_driver="$(command -v tauri-driver)"
	else
		printf 'error: tauri-driver 2.0.6 is required (set YAPEL_E2E_TAURI_DRIVER)\n' >&2
		exit 2
	fi
fi
if [[ ! -x "$tauri_driver" ]]; then
	printf 'error: tauri-driver is not executable: %s\n' "$tauri_driver" >&2
	exit 2
fi

app_sha256="$(sha256sum "$app_path" | awk '{print $1}')"
tauri_driver_sha256="$(sha256sum "$tauri_driver" | awk '{print $1}')"
tauri_driver_manifest="$(dirname "$(dirname "$tauri_driver")")/.crates.toml"
tauri_driver_version=""
if [[ -f "$tauri_driver_manifest" ]]; then
	tauri_driver_version="$(sed -n -E 's/^"tauri-driver ([^ ]+).*/\1/p' "$tauri_driver_manifest" | head -n 1)"
fi

webkit_driver="${YAPEL_E2E_WEBKIT_DRIVER:-}"
webkit_source="explicit"
if [[ -z "$webkit_driver" ]] && command -v WebKitWebDriver >/dev/null 2>&1; then
	webkit_driver="$(command -v WebKitWebDriver)"
	webkit_source="host"
fi
if [[ -z "$webkit_driver" ]] && command -v flatpak >/dev/null 2>&1 && flatpak info "${YAPEL_E2E_FLATPAK_RUNTIME:-org.gnome.Platform//50}" >/dev/null 2>&1; then
	webkit_driver="$temp_root/yapel-webkit-webdriver"
	ln -s "$script_path" "$webkit_driver"
	webkit_source="flatpak-runtime-loader"
fi
if [[ -z "$webkit_driver" || ! -x "$webkit_driver" ]]; then
	printf 'error: WebKitWebDriver is required (set YAPEL_E2E_WEBKIT_DRIVER)\n' >&2
	exit 2
fi

free_port() {
	node -e 'const net=require("node:net");const s=net.createServer();s.unref();s.listen(0,"127.0.0.1",()=>{process.stdout.write(String(s.address().port));s.close();});'
}
driver_port="$(free_port)"
native_port="$(free_port)"
if [[ "$driver_port" == "$native_port" ]]; then
	native_port="$(free_port)"
fi

{
	printf 'app=%s\n' "$app_path"
	printf 'app-sha256=%s\n' "$app_sha256"
	printf 'tauri-driver=%s\n' "$tauri_driver"
	printf 'tauri-driver-version=%s\n' "${tauri_driver_version:-unknown}"
	printf 'tauri-driver-sha256=%s\n' "$tauri_driver_sha256"
	printf 'webkit-driver=%s\n' "$webkit_source"
	printf 'node=%s\n' "$(node --version)"
	printf 'pnpm=%s\n' "$(pnpm --version)"
	printf 'cargo=%s\n' "$($cargo_bin --version)"
	printf 'git-sha=%s\n' "$(git -C "$repo_root" rev-parse HEAD)"
	printf 'display=%s\n' "${DISPLAY:-unset}"
	printf 'xdg-data=disposable\n'
	printf 'database=xdg-data/com.joshazmy.yapel/limusic.sqlite\n'
	printf 'evidence-run=%s\n' "$(basename "$artifact_dir")"
} > "$runner_raw"

export XDG_DATA_HOME="$xdg_data"
export XDG_CONFIG_HOME="$xdg_config"
export XDG_CACHE_HOME="$xdg_cache"
export XDG_RUNTIME_DIR="$xdg_runtime"
export HOME="$runtime_home"
# Do not expose the desktop application or WebDriver children to caller credentials or agent IPC.
unset SSH_AUTH_SOCK GITHUB_TOKEN GH_TOKEN OPENAI_API_KEY ANTHROPIC_API_KEY GOOGLE_API_KEY
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN NPM_TOKEN NODE_AUTH_TOKEN
unset CARGO_REGISTRIES_CRATES_IO_TOKEN
if [[ -n "$desktop_runtime" && -n "$desktop_wayland" && -S "$desktop_runtime/$desktop_wayland" ]]; then
	ln -s "$desktop_runtime/$desktop_wayland" "$xdg_runtime/$desktop_wayland"
	export WAYLAND_DISPLAY="$desktop_wayland"
	export GDK_BACKEND=wayland
else
	export GDK_BACKEND=x11
	unset WAYLAND_DISPLAY
fi
export WEBKIT_DISABLE_COMPOSITING_MODE=1
export HTTP_PROXY=http://127.0.0.1:9
export HTTPS_PROXY=http://127.0.0.1:9
export ALL_PROXY=http://127.0.0.1:9
export http_proxy="$HTTP_PROXY"
export https_proxy="$HTTPS_PROXY"
export all_proxy="$ALL_PROXY"
export NO_PROXY=127.0.0.1,localhost
export no_proxy="$NO_PROXY"

setsid "$tauri_driver" \
	--port "$driver_port" \
	--native-port "$native_port" \
	--native-host 127.0.0.1 \
	--native-driver "$webkit_driver" \
	> "$driver_raw" 2>&1 &
driver_pid=$!

ready=0
for _ in {1..100}; do
	if ! kill -0 "$driver_pid" 2>/dev/null; then
		break
	fi
	if curl --noproxy '*' --fail --silent --connect-timeout 0.05 --max-time 0.05 "http://127.0.0.1:$driver_port/status" >/dev/null; then
		ready=1
		break
	fi
	sleep 0.1
done
if ((ready == 0)); then
	printf 'error: tauri-driver did not become ready within 15 seconds\n' >&2
	exit 1
fi

set +e
(
	cd "$repo_root"
	YAPEL_E2E_APP_PATH="$app_path" \
	YAPEL_E2E_DRIVER_URL="http://127.0.0.1:$driver_port" \
	YAPEL_E2E_DATA_HOME="$xdg_data" \
	YAPEL_E2E_SQLITE="$sqlite_bin" \
	YAPEL_E2E_ARTIFACT_DIR="$artifact_dir" \
		pnpm --dir ui test:e2e:desktop
) > "$test_raw" 2>&1
test_exit=$?
set -e

redact_log "$test_raw" "$artifact_dir/desktop-e2e.log"
cat "$artifact_dir/desktop-e2e.log"
required_screenshots=(
	01-home-900x620.png
	02-queue-1023x620.png
	03-shell-1024-expanded.png
	04-shell-1024-collapsed.png
	05-overlay-1099x860.png
	06-rail-1100x860.png
	07-resize-1101x860.png
	08-playlist-1440x900.png
	09-immersive-1440x900.png
	10-search-1024x620.png
	11-settings-900x620.png
	12-restart-persistence.png
)
if ((test_exit == 0)); then
	for screenshot in "${required_screenshots[@]}"; do
		if [[ ! -s "$artifact_dir/$screenshot" ]]; then
			printf 'error: required desktop E2E evidence is missing: %s\n' "$screenshot" >&2
			test_exit=1
		fi
	done
fi
printf 'desktop E2E evidence: %s\n' "$artifact_dir"
exit "$test_exit"
