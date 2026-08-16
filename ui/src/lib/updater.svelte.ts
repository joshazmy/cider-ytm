// Updates never self-install. The Tauri updater endpoint used to point at upstream Limusic
// (v0.4.6), which would overwrite this fork. Every "update" action opens the Yapel releases page
// in the OS browser instead.
import { toast } from './player.svelte';
import { openInBrowser } from './api';

/** Yapel releases — never install upstream Limusic over this fork. */
export const UPDATE_PAGE = 'https://github.com/joshazmy/cider-ytm/releases';

export const updateState = $state({
	available: null as { version: string } | null,
	checking: false,
	installing: false
});

/** Startup used to poll Limusic latest.json. That banner is a product lie — stay silent. */
export async function checkForUpdatesQuiet() {
	updateState.available = null;
}

/** Settings > About: open the real browser. Do not download or install anything. */
export async function checkForUpdatesInteractive(): Promise<{ message: string; error: boolean }> {
	updateState.checking = true;
	try {
		await openInBrowser(UPDATE_PAGE);
		return { message: 'Opened releases in your browser', error: false };
	} catch (e) {
		return { message: String(e), error: true };
	} finally {
		updateState.checking = false;
	}
}

/** Open the release page in the user's default browser (xdg-open). */
export async function openUpdateInBrowser() {
	try {
		await openInBrowser(UPDATE_PAGE);
	} catch (e) {
		toast.error(String(e));
	}
}
