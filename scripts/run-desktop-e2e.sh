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

# Give CI a private DBus and display. A developer session can reuse its existing X display while
# still getting an isolated DBus. The inner invocation is marked so this wrapper runs only once.
if [[ "${YAPEL_E2E_SESSION:-0}" != "1" ]]; then
	if [[ -n "${DISPLAY:-}" ]]; then
		if command -v dbus-run-session >/dev/null 2>&1; then
			exec dbus-run-session -- env YAPEL_E2E_SESSION=1 "$script_path" "$@"
		fi
		exec env YAPEL_E2E_SESSION=1 "$script_path" "$@"
	fi
	if command -v dbus-run-session >/dev/null 2>&1 && command -v xvfb-run >/dev/null 2>&1; then
		exec dbus-run-session -- xvfb-run -a -s "-screen 0 1440x900x24" \
			env YAPEL_E2E_SESSION=1 "$script_path" "$@"
	fi
	printf 'error: desktop E2E requires an active X display or dbus-run-session plus xvfb-run\n' >&2
	exit 2
fi

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
	elif [[ -x /home/jhondoe/.cargo/bin/cargo ]]; then
		cargo_bin=/home/jhondoe/.cargo/bin/cargo
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

artifact_dir="$(realpath -m "$artifact_arg")"
repo_abs="$(realpath "$repo_root")"
user_home="${HOME:-}"
if [[ "$artifact_dir" == "/" || "$artifact_dir" == "$repo_abs" || -n "$user_home" && "$artifact_dir" == "$(realpath "$user_home")" ]]; then
	printf 'error: refusing unsafe desktop E2E artifact directory: %s\n' "$artifact_dir" >&2
	exit 2
fi
mkdir -p "$artifact_dir"

temp_parent="${TMPDIR:-/tmp}"
temp_root="$(mktemp -d "$temp_parent/yapel-native-e2e.XXXXXX")"
driver_pid=""
driver_raw="$temp_root/tauri-driver.raw.log"
test_raw="$temp_root/desktop-e2e.raw.log"
runner_raw="$temp_root/runner.raw.log"

redact_log() {
	local source_file="$1"
	local destination_file="$2"
	if [[ -f "$source_file" ]]; then
		sed -E \
			-e 's/((authorization|cookie|session_cookie|token)["=: ]+)[^ ,;"[:space:]]+/\1[REDACTED]/Ig' \
			-e 's#(https?://)[^/@[:space:]]+@#\1[REDACTED]@#g' \
			"$source_file" > "$destination_file"
	fi
}

cleanup() {
	local exit_code=$?
	trap - EXIT INT TERM
	if [[ -n "$driver_pid" ]] && kill -0 "$driver_pid" 2>/dev/null; then
		kill -TERM -- "-$driver_pid" 2>/dev/null || true
		for _ in {1..30}; do
			kill -0 "$driver_pid" 2>/dev/null || break
			sleep 0.1
		done
		if kill -0 "$driver_pid" 2>/dev/null; then
			kill -KILL -- "-$driver_pid" 2>/dev/null || true
		fi
	fi
	redact_log "$runner_raw" "$artifact_dir/runner.log"
	redact_log "$driver_raw" "$artifact_dir/tauri-driver.log"
	redact_log "$test_raw" "$artifact_dir/desktop-e2e.log"
	case "$temp_root" in
		"$temp_parent"/yapel-native-e2e.*) rm -rf -- "$temp_root" ;;
		*) printf 'warning: refusing to remove unexpected temporary path: %s\n' "$temp_root" >&2 ;;
	esac
	exit "$exit_code"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

xdg_data="$temp_root/xdg-data"
xdg_config="$temp_root/xdg-config"
xdg_cache="$temp_root/xdg-cache"
xdg_runtime="$temp_root/xdg-runtime"
mkdir -p "$xdg_data" "$xdg_config" "$xdg_cache" "$xdg_runtime"
chmod 700 "$xdg_runtime"

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
	elif [[ -x /tmp/cider-ytm-tauri-driver/bin/tauri-driver ]]; then
		tauri_driver=/tmp/cider-ytm-tauri-driver/bin/tauri-driver
	else
		printf 'error: tauri-driver 2.0.6 is required (set YAPEL_E2E_TAURI_DRIVER)\n' >&2
		exit 2
	fi
fi
if [[ ! -x "$tauri_driver" ]]; then
	printf 'error: tauri-driver is not executable: %s\n' "$tauri_driver" >&2
	exit 2
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
	printf 'tauri-driver=%s (expected 2.0.6)\n' "$tauri_driver"
	printf 'webkit-driver=%s\n' "$webkit_source"
	printf 'node=%s\n' "$(node --version)"
	printf 'pnpm=%s\n' "$(pnpm --version)"
	printf 'cargo=%s\n' "$($cargo_bin --version)"
	printf 'display=%s\n' "${DISPLAY:-unset}"
	printf 'xdg-data=disposable\n'
} > "$runner_raw"

export XDG_DATA_HOME="$xdg_data"
export XDG_CONFIG_HOME="$xdg_config"
export XDG_CACHE_HOME="$xdg_cache"
export XDG_RUNTIME_DIR="$xdg_runtime"
export GDK_BACKEND=x11
unset WAYLAND_DISPLAY
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
for _ in {1..150}; do
	if ! kill -0 "$driver_pid" 2>/dev/null; then
		break
	fi
	if curl --noproxy '*' --fail --silent --max-time 1 "http://127.0.0.1:$driver_port/status" >/dev/null; then
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
exit "$test_exit"
