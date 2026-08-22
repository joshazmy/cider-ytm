import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { Builder, By, Key } from 'selenium-webdriver';

const appPath = process.env.YAPEL_E2E_APP_PATH;
const driverUrl = process.env.YAPEL_E2E_DRIVER_URL ?? 'http://127.0.0.1:4444';
const dataHome = process.env.YAPEL_E2E_DATA_HOME;
const sqlitePath = process.env.YAPEL_E2E_SQLITE;
const artifactDir = process.env.YAPEL_E2E_ARTIFACT_DIR;
const seedPath = new URL('./fixtures/seed.sql', import.meta.url);
const tauriConfigPath = new URL('../../src-tauri/tauri.conf.json', import.meta.url);
const capabilityPath = new URL('../../src-tauri/capabilities/default.json', import.meta.url);
const databasePath = dataHome
	? path.join(dataHome, 'com.joshazmy.yapel', 'limusic.sqlite')
	: undefined;
const localMediaPath = dataHome
	? path.join(dataHome, 'native-e2e-media', 'Native E2E Collection')
	: undefined;

const PRIMARY_NAV = 'aside[aria-label="Primary navigation"]';
const CENTER = '[data-center-region]';
const CENTER_XPATH = '//*[@data-center-region]';
const PLAYER = 'footer[aria-label="Player"]';
const RAIL = 'aside[aria-label="Now playing queue"]';
const GLOBAL_LISTEN = '[data-global-action="listen-together"]';
const REQUIRED_SCREENSHOTS = [
	'01-home-900x620.png',
	'02-queue-1023x620.png',
	'03-shell-1024-expanded.png',
	'04-shell-1024-collapsed.png',
	'05-overlay-1099x860.png',
	'06-rail-1100x860.png',
	'07-resize-1101x860.png',
	'08-playlist-1440x900.png',
	'09-immersive-1440x900.png',
	'10-search-1024x620.png',
	'11-settings-900x620.png',
	'12-restart-persistence.png'
];

async function openNativeSession() {
	return new Builder()
		.usingServer(driverUrl)
		.withCapabilities({
			browserName: 'wry',
			'tauri:options': { application: appPath }
		})
		.build();
}

async function capture(driver, name, required = true) {
	if (!artifactDir) {
		if (required) assert.fail(`YAPEL_E2E_ARTIFACT_DIR is required for ${name}`);
		return;
	}
	try {
		await mkdir(artifactDir, { recursive: true });
		await writeFile(path.join(artifactDir, `${name}.png`), await driver.takeScreenshot(), 'base64');
	} catch (error) {
		if (required) throw new Error(`could not capture required milestone ${name}: ${error.message}`);
		process.stderr.write(`warning: could not capture diagnostic ${name}: ${error.message}\n`);
	}
}

async function waitForNativeShell(driver) {
	try {
		await driver.wait(
			async () => {
				try {
					return (
						(await driver.executeScript('return document.readyState')) === 'complete' &&
						(await driver.executeScript('return Boolean(window.__TAURI_INTERNALS__)')) &&
						(await driver.executeScript('return document.body?.innerText.includes("Home") ?? false'))
					);
				} catch {
					return false;
				}
			},
			15_000,
			'native Tauri shell did not become ready'
		);
	} catch (error) {
			await capture(driver, 'failure-native-shell', false);
		const diagnostics = await driver.executeScript(`return {
			readyState: document.readyState,
			title: document.title,
			hasTauri: Boolean(window.__TAURI_INTERNALS__),
			bodyText: document.body?.innerText.slice(0, 500) ?? '',
			bodyHtml: document.body?.innerHTML.slice(0, 500) ?? ''
		}`);
		process.stderr.write(`native shell diagnostics: ${JSON.stringify(diagnostics)}\n`);
		throw error;
	}
}

async function waitForFile(file, timeoutMs = 10_000) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			await access(file);
			return;
		} catch (error) {
			if (error?.code !== 'ENOENT') throw error;
		}
		await new Promise((resolve) => setTimeout(resolve, 50));
	}
	assert.fail(`timed out waiting for native state file: ${file}`);
}

async function closeNativeSession(driver) {
	if (!driver) return;
	try {
		await driver.quit();
	} catch (error) {
		// The runner owns the full process group, so preserve the primary assertion failure while still
		// surfacing teardown diagnostics instead of replacing the useful stack with quit()'s error.
		process.stderr.write(`warning: native WebDriver teardown failed: ${error.message}\n`);
	}
}

async function anyDisplayed(driver, locator) {
	for (const element of await driver.findElements(locator)) {
		try {
			if (await element.isDisplayed()) return true;
		} catch {
			// A route transition can make a candidate stale; the next poll resolves a fresh list.
		}
	}
	return false;
}

async function displayed(driver, locator, label, timeoutMs = 10_000) {
	let found;
	await driver.wait(
		async () => {
			for (const element of await driver.findElements(locator)) {
				try {
					if (await element.isDisplayed()) {
						found = element;
						return true;
					}
				} catch {
					// Resolve a fresh element on the next condition poll.
				}
			}
			return false;
		},
		timeoutMs,
		`${label} did not become visible`
	);
	return found;
}

async function waitHidden(driver, locator, label, timeoutMs = 10_000) {
	await driver.wait(
		async () => !(await anyDisplayed(driver, locator)),
		timeoutMs,
		`${label} remained visible`
	);
}

async function setViewport(driver, width, height) {
	let requestedWidth = width;
	let requestedHeight = height;
	let actual;
	// WebDriver sets the outer native rectangle. Some compositors add a small border even to an
	// undecorated Tauri window, so compensate for that measured inset to obtain the contractual CSS
	// viewport. This is geometry calibration, not a test-case retry.
	for (let calibration = 0; calibration < 4; calibration++) {
		await driver.manage().window().setRect({ width: requestedWidth, height: requestedHeight });
		await driver.executeAsyncScript(`
			const done = arguments[arguments.length - 1];
			requestAnimationFrame(() => requestAnimationFrame(done));
		`);
		actual = await driver.executeScript(
			`return {
				width: window.innerWidth,
				height: window.innerHeight,
				outerWidth: window.outerWidth,
				outerHeight: window.outerHeight,
				devicePixelRatio: window.devicePixelRatio,
				screenWidth: screen.width,
				screenHeight: screen.height
			}`
		);
		if (actual.width === width && actual.height === height) return;
		requestedWidth += width - actual.width;
		requestedHeight += height - actual.height;
		if (requestedWidth < 900 || requestedHeight < 620) break;
	}
	assert.equal(actual.width, width, `native viewport did not settle at ${width}x${height}: ${JSON.stringify(actual)}`);
	assert.equal(actual.height, height, `native viewport did not settle at ${width}x${height}: ${JSON.stringify(actual)}`);
}

async function rect(driver, element) {
	return driver.executeScript(
		`const r = arguments[0].getBoundingClientRect();
		 return { left:r.left, top:r.top, right:r.right, bottom:r.bottom,
		          width:r.width, height:r.height };`,
		element
	);
}

function assertContained(inner, outer, label, tolerance = 1) {
	const detail = `${label}: inner=${JSON.stringify(inner)} outer=${JSON.stringify(outer)}`;
	assert.ok(inner.left >= outer.left - tolerance, `${label} escapes the left edge: ${detail}`);
	assert.ok(inner.top >= outer.top - tolerance, `${label} escapes the top edge: ${detail}`);
	assert.ok(inner.right <= outer.right + tolerance, `${label} escapes the right edge: ${detail}`);
	assert.ok(inner.bottom <= outer.bottom + tolerance, `${label} escapes the bottom edge: ${detail}`);
}

async function assertNoRootOverflow(driver) {
	const metrics = await driver.executeScript(`return {
		innerWidth: window.innerWidth,
		html: document.documentElement.scrollWidth,
		body: document.body.scrollWidth
	}`);
	assert.ok(metrics.html <= metrics.innerWidth, `html overflows: ${JSON.stringify(metrics)}`);
	assert.ok(metrics.body <= metrics.innerWidth, `body overflows: ${JSON.stringify(metrics)}`);
}

async function assertGlobalListenTogether(driver) {
	const button = await displayed(driver, By.css(GLOBAL_LISTEN), 'global Listen Together action');
	assert.equal(await button.getAttribute('aria-label'), 'Listen Together');
	const buttonRect = await rect(driver, button);
	assert.ok(buttonRect.width >= 44, 'global Listen Together target is narrower than 44px');
	assert.ok(buttonRect.height >= 44, 'global Listen Together target is shorter than 44px');
}

async function assertMinTarget(driver, locator, name) {
	const element = await displayed(driver, locator, name);
	const target = await rect(driver, element);
	assert.ok(
		target.width >= 44 && target.height >= 44,
		`${name} target is ${target.width}x${target.height}`
	);
	return element;
}

async function assertPlayerControlsDoNotOverlap(driver) {
	const overlaps = await driver.executeScript(`
		const player = document.querySelector('footer[aria-label="Player"]');
		const nodes = [...player.querySelectorAll('button, input[type="range"], [data-player-time]')]
			.filter((element) => {
				if (!element.offsetParent) return false;
				const style = getComputedStyle(element);
				return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0;
			});
		const boxes = nodes.map((element) => {
			const box = element.getBoundingClientRect();
			return {
				name: element.getAttribute('aria-label')
					|| (element.hasAttribute('data-player-time') ? 'elapsed/duration' : element.tagName),
				left: box.left,
				right: box.right,
				top: box.top,
				bottom: box.bottom,
				width: box.width,
				height: box.height
			};
		}).filter((box) => box.width > 1 && box.height > 1);
		const hits = [];
		for (let i = 0; i < boxes.length; i += 1) {
			for (let j = i + 1; j < boxes.length; j += 1) {
				const a = boxes[i];
				const b = boxes[j];
				const overlap = a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
				if (!overlap) continue;
				const contained =
					(a.left <= b.left + 0.5 && a.right >= b.right - 0.5 && a.top <= b.top + 0.5 && a.bottom >= b.bottom - 0.5) ||
					(b.left <= a.left + 0.5 && b.right >= a.right - 0.5 && b.top <= a.top + 0.5 && b.bottom >= a.bottom - 0.5);
				if (!contained) hits.push([a.name, b.name]);
			}
		}
		return hits;
	`);
	assert.deepEqual(overlaps, [], `player controls overlap: ${JSON.stringify(overlaps)}`);
}

async function exerciseGlobalListenTogetherKeyboard(driver) {
	const button = await displayed(driver, By.css(GLOBAL_LISTEN), 'global Listen Together action');
	await button.sendKeys(Key.ENTER);
	await displayed(
		driver,
		By.xpath("//*[@role='dialog']//*[normalize-space(.)='Listen Together']"),
		'Listen Together dialog from keyboard'
	);
	await closeDialogWithEscape(driver, button, 'Listen Together');
	const outline = parseFloat(await button.getCssValue('outline-width'));
	assert.ok(outline >= 2, `Listen Together focus ring is only ${outline}px`);
}

async function assertRuntimeCspBlock(driver) {
	const result = await driver.executeAsyncScript(`
		const done = arguments[arguments.length - 1];
		const source = 'https://e2e.invalid/yapel-csp-blocked.js';
		let finished = false;
		const script = document.createElement('script');
		const finish = (value) => {
			if (finished) return;
			finished = true;
			document.removeEventListener('securitypolicyviolation', onViolation);
			script.remove();
			done(value);
		};
		const onViolation = (event) => {
			if (event.blockedURI === source) {
				finish({
					blocked: true,
					directive: event.effectiveDirective,
					policy: event.originalPolicy
				});
			}
		};
		document.addEventListener('securitypolicyviolation', onViolation);
		script.src = source;
		script.onload = () => finish({ blocked: false, loaded: true });
		document.head.append(script);
		setTimeout(() => finish({ blocked: false, timedOut: true }), 2000);
	`);
	assert.equal(result.blocked, true, `runtime CSP did not block the probe: ${JSON.stringify(result)}`);
	assert.match(result.directive, /^script-src(?:-elem)?$/);
	assert.match(result.policy, /script-src 'self'/);
}

async function setWebviewZoom(driver, value) {
	const result = await driver.executeAsyncScript(
		`
		const value = arguments[0];
		const done = arguments[arguments.length - 1];
		const label = window.__TAURI_INTERNALS__?.metadata?.currentWebview?.label;
		window.__TAURI_INTERNALS__.invoke('plugin:webview|set_webview_zoom', { label, value })
			.then(() => requestAnimationFrame(() => requestAnimationFrame(() => done({
				ok: true,
				width: window.innerWidth,
				height: window.innerHeight
			}))))
			.catch((error) => done({ ok: false, error: String(error) }));
	`,
		value
	);
	assert.equal(result.ok, true, `could not set native webview zoom: ${JSON.stringify(result)}`);
	return result;
}

async function resetAnimationProbe(driver) {
	await driver.executeScript(`
		window.__yapelE2eAnimations = [];
		if (!window.__yapelE2eOriginalAnimate) {
			window.__yapelE2eOriginalAnimate = Element.prototype.animate;
			Element.prototype.animate = function(keyframes, options) {
				const duration = typeof options === 'number' ? options : Number(options?.duration ?? 0);
				window.__yapelE2eAnimations.push({
					duration,
					immersive: this.id === 'now-playing-dialog' || Boolean(this.closest?.('#now-playing-dialog')),
					queueRow: Boolean(this.closest?.('[data-row]'))
				});
				return window.__yapelE2eOriginalAnimate.call(this, keyframes, options);
			};
		}
	`);
}

async function assertShellGeometry(driver, { sidebarWidth, railVisible, playerVisible }) {
	await assertNoRootOverflow(driver);
	const nav = await displayed(driver, By.css(PRIMARY_NAV), 'primary navigation');
	const center = await displayed(driver, By.css(CENTER), 'center region');
	const navRect = await rect(driver, nav);
	const centerRect = await rect(driver, center);
	assert.ok(Math.abs(navRect.width - sidebarWidth) <= 0.5, `sidebar width ${navRect.width}, expected ${sidebarWidth}`);
	assert.ok(navRect.right <= centerRect.left + 1, 'sidebar overlaps center region');

	assert.equal(await anyDisplayed(driver, By.css(RAIL)), railVisible, 'Now Playing rail visibility mismatch');
	if (railVisible) {
		const rail = await displayed(driver, By.css(RAIL), 'Now Playing rail');
		const railRect = await rect(driver, rail);
		assert.ok(centerRect.right <= railRect.left + 1, 'center region overlaps Now Playing rail');
		const viewportWidth = await driver.executeScript('return window.innerWidth');
		const expectedRail = viewportWidth >= 1440
			? Math.min(340, Math.max(288, viewportWidth * 0.22))
			: Math.min(320, Math.max(272, viewportWidth * 0.22));
		assert.ok(
			Math.abs(railRect.width - expectedRail) <= 1,
			`rail width ${railRect.width}, expected ${expectedRail} at ${viewportWidth}px`
		);
	}

	assert.equal(await anyDisplayed(driver, By.css(PLAYER)), playerVisible, 'player visibility mismatch');
	if (playerVisible) {
		const player = await displayed(driver, By.css(PLAYER), 'player');
		const playerRect = await rect(driver, player);
		assertContained(playerRect, centerRect, 'player');
		assert.ok(playerRect.height >= 72, `player is only ${playerRect.height}px high`);
		for (const name of ['Play', 'Toggle queue', 'Toggle lyrics']) {
			const control = await displayed(driver, By.css(`${PLAYER} button[aria-label="${name}"]`), `${name} control`);
			const controlRect = await rect(driver, control);
			assert.ok(controlRect.width >= 44 && controlRect.height >= 44, `${name} target is below 44px`);
		}
	}
}

async function waitForPath(driver, pathname) {
	await driver.wait(
		async () => (await driver.executeScript('return location.pathname')) === pathname,
		10_000,
		`route did not reach ${pathname}`
	);
}

async function waitForPathPrefix(driver, prefix) {
	await driver.wait(
		async () => (await driver.executeScript('return location.pathname')).startsWith(prefix),
		10_000,
		`route did not begin with ${prefix}`
	);
}

async function clickNav(driver, href) {
	const link = await displayed(driver, By.css(`${PRIMARY_NAV} a[href="${href}"]`), `navigation link ${href}`);
	await link.click();
	await waitForPath(driver, href.split('?')[0]);
	if (href.includes('?')) {
		const search = href.slice(href.indexOf('?'));
		await driver.wait(
			async () => (await driver.executeScript('return location.search')) === search,
			10_000,
			`route did not keep query ${search}`
		);
	}
	await assertGlobalListenTogether(driver);
}

async function clickCenterTab(driver, name) {
	const tab = await displayed(
		driver,
		By.xpath(`${CENTER_XPATH}//*[@role='tab' and normalize-space(.)=${JSON.stringify(name)}]`),
		`${name} library tab`
	);
	await tab.click();
	await driver.wait(
		async () =>
			(await tab.getAttribute('aria-selected')) === 'true' ||
			(await tab.getAttribute('data-state')) === 'active',
		5_000,
		`${name} library tab did not select`
	);
}

async function visitDeepLink(driver, path, label) {
	await driver.executeScript(
		`
		const path = arguments[0];
		document.querySelector('[data-e2e-deeplink]')?.remove();
		const link = document.createElement('a');
		link.dataset.e2eDeeplink = '1';
		link.href = path;
		link.textContent = path;
		link.style.cssText = 'position:fixed;left:8px;top:8px;z-index:2147483647';
		document.body.append(link);
	`,
		path
	);
	const link = await displayed(driver, By.css('[data-e2e-deeplink]'), `${label} deep link`);
	await link.click();
	await driver.executeScript("document.querySelector('[data-e2e-deeplink]')?.remove()");
}

async function assertCenterUsable(driver, label) {
	const text = await driver.executeScript(
		'return document.querySelector("[data-center-region]")?.innerText ?? ""'
	);
	assert.ok(
		text.length > 12,
		`${label} center is empty: ${JSON.stringify(text).slice(0, 200)}`
	);
	await assertGlobalListenTogether(driver);
}

async function assertWholeAppSurfaces(driver) {
	await setViewport(driver, 1100, 860);
	await ensureSidebar(driver, true);

	const primary = [
		['/', 'Home'],
		['/library', 'Library'],
		['/library?tab=recent', 'Recently Played'],
		['/library?tab=songs', 'Songs'],
		['/playlist/VLLM', 'Liked Music'],
		['/library?tab=albums', 'Albums'],
		['/library?tab=artists', 'Artists']
	];
	for (const [href, label] of primary) {
		await clickNav(driver, href);
		await assertCenterUsable(driver, label);
		await capture(driver, `surface-${label.toLowerCase().replaceAll(' ', '-')}`, false);
	}
	// Expanded sidebar Search is a field, not an <a href="/search">.
	await visitDeepLink(driver, '/search', 'Search');
	await waitForPath(driver, '/search');
	await assertCenterUsable(driver, 'Search');
	await capture(driver, 'surface-search', false);

	await clickNav(driver, '/library');
	await displayed(driver, By.xpath(`${CENTER_XPATH}//h1[normalize-space(.)='Library']`), 'Library heading');
	for (const name of ['All', 'Songs', 'Recently Played', 'Playlists', 'Albums', 'Artists', 'Local']) {
		await clickCenterTab(driver, name);
		await assertCenterUsable(driver, `Library ${name}`);
	}
	await displayed(
		driver,
		By.xpath("//*[@role='button' and starts-with(@title, 'Native E2E Collection')]"),
		'Local tab fixture album'
	);
	const localSongs = await displayed(
		driver,
		By.xpath(`${CENTER_XPATH}//*[@role='tab' and starts-with(normalize-space(.), 'Songs (')]`),
		'Local songs view'
	);
	await localSongs.click();
	await displayed(driver, By.xpath(`${CENTER_XPATH}//button[normalize-space(.)='Play all']`), 'Local Play all');
	await displayed(driver, By.xpath(`${CENTER_XPATH}//button[normalize-space(.)='Shuffle']`), 'Local Shuffle');

	await visitDeepLink(driver, '/artist/e2e-offline', 'offline artist');
	await waitForPath(driver, '/artist/e2e-offline');
	await displayed(driver, By.xpath(`${CENTER_XPATH}//button[normalize-space(.)='Try again']`), 'artist recovery');

	await visitDeepLink(driver, '/search-more?q=offline&cat=songs', 'search-more');
	await waitForPath(driver, '/search-more');
	await displayed(driver, By.xpath(`${CENTER_XPATH}//button[normalize-space(.)='Try again']`), 'search-more recovery');

	await visitDeepLink(driver, '/list?id=FEmusic_charts&title=Charts', 'browse list');
	await waitForPath(driver, '/list');
	await displayed(driver, By.xpath(`${CENTER_XPATH}//button[normalize-space(.)='Try again']`), 'browse-list recovery');

	const settingsTrigger = await displayed(
		driver,
		By.css(`${PRIMARY_NAV} button[title="Settings"]`),
		'Settings trigger'
	);
	await settingsTrigger.click();
	await displayed(driver, By.css('[role="dialog"]'), 'Settings dialog');
	const settingsPanels = [
		['General', 'Watch history'],
		['Look', 'Preset'],
		['Playback', 'Speaker / IEM profile'],
		['Data', 'Clear caches'],
		['About', 'Desk keys']
	];
	for (const [name, marker] of settingsPanels) {
		const tab = await displayed(
			driver,
			By.xpath(`//div[@role='dialog']//button[@role='tab' and normalize-space(.)=${JSON.stringify(name)}]`),
			`${name} settings section`
		);
		await tab.click();
		await driver.wait(
			async () => (await tab.getAttribute('aria-selected')) === 'true',
			3_000,
			`${name} settings section did not select`
		);
		await displayed(
			driver,
			By.xpath(`//div[@role='dialog']//*[normalize-space(.)=${JSON.stringify(marker)}]`),
			`${name} settings content`
		);
	}
	// Settings keeps the last tab while the dialog stays mounted. Later Reduce motion lives on General.
	const generalTab = await displayed(
		driver,
		By.xpath("//div[@role='dialog']//button[@role='tab' and normalize-space(.)='General']"),
		'General settings section'
	);
	await generalTab.click();
	await driver.wait(
		async () => (await generalTab.getAttribute('aria-selected')) === 'true',
		3_000,
		'General settings section did not restore'
	);
	await closeDialogWithEscape(driver, settingsTrigger, 'Settings');
	await clickNav(driver, '/');
}

async function ensureSidebar(driver, expanded) {
	const wanted = expanded ? 'Expand sidebar' : 'Collapse sidebar';
	const candidates = await driver.findElements(By.css(`${PRIMARY_NAV} button[aria-label="${wanted}"]`));
	for (const candidate of candidates) {
		if (await candidate.isDisplayed()) {
			await candidate.click();
			break;
		}
	}
	const expected = expanded ? 'Collapse sidebar' : 'Expand sidebar';
	await displayed(driver, By.css(`${PRIMARY_NAV} button[aria-label="${expected}"]`), `${expected} control`);
}

async function openPanel(driver, kind) {
	const title = kind === 'queue' ? 'Queue' : 'Lyrics';
	const trigger = await displayed(driver, By.css(`${PLAYER} button[aria-label="Toggle ${kind}"]`), `${title} trigger`);
	await trigger.click();
	const panel = await displayed(driver, By.css(`[data-overlay-panel="${kind}"]`), `${title} overlay`);
	await driver.wait(
		async () => {
			const transform = await driver.executeScript('return getComputedStyle(arguments[0]).transform', panel);
			return transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)';
		},
		3_000,
		`${title} overlay transition did not settle`
	);
	assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
	assert.equal(
		await driver.executeScript('return arguments[0].contains(document.activeElement)', panel),
		true,
		`${title} overlay did not receive focus`
	);
	return { panel, trigger };
}

async function closePanelWithEscape(driver, kind, trigger) {
	await driver.actions({ async: true }).sendKeys(Key.ESCAPE).perform();
	await waitHidden(driver, By.css(`[data-overlay-panel="${kind}"]`), `${kind} overlay`);
	assert.equal(
		await driver.executeScript('return document.activeElement === arguments[0]', trigger),
		true,
		`${kind} overlay did not return focus to its trigger`
	);
}

async function openSettingsPlayback(driver) {
	const trigger = await displayed(driver, By.css(`${PRIMARY_NAV} button[title="Settings"]`), 'Settings trigger');
	await trigger.click();
	const dialog = await displayed(driver, By.css('[role="dialog"]'), 'Settings dialog');
	const playbackTab = await displayed(driver, By.xpath("//div[@role='dialog']//button[normalize-space(.)='Playback']"), 'Playback settings tab');
	await playbackTab.click();
	assert.equal(await playbackTab.getAttribute('tabindex'), '0');
	const settingsTablist = await driver.findElement(By.css('[role="dialog"] [role="tablist"][aria-label="Settings sections"]'));
	const tabOrientation = await settingsTablist.getAttribute('aria-orientation');
	assert.match(tabOrientation, /^(horizontal|vertical)$/);
	await playbackTab.sendKeys(tabOrientation === 'vertical' ? Key.ARROW_UP : Key.ARROW_LEFT);
	const lookTab = await displayed(
		driver,
		By.xpath("//div[@role='dialog']//button[@role='tab' and normalize-space(.)='Look']"),
		'Look settings tab'
	);
	assert.equal(await lookTab.getAttribute('aria-selected'), 'true');
	await lookTab.sendKeys(tabOrientation === 'vertical' ? Key.ARROW_DOWN : Key.ARROW_RIGHT);
	await driver.wait(
		async () => (await playbackTab.getAttribute('aria-selected')) === 'true',
		3_000,
		'Settings ArrowRight did not return to Playback'
	);
	await displayed(driver, By.xpath("//div[@role='dialog']//*[normalize-space(.)='Fade between tracks']"), 'Fade between tracks label');
	assert.equal(await anyDisplayed(driver, By.xpath("//div[@role='dialog']//*[normalize-space(.)='Crossfade']")), false);
	return { dialog, trigger };
}

async function closeDialogWithEscape(driver, trigger, name) {
	await driver.actions({ async: true }).sendKeys(Key.ESCAPE).perform();
	await waitHidden(driver, By.css('[role="dialog"]'), `${name} dialog`);
	assert.equal(
		await driver.executeScript('return document.activeElement === arguments[0]', trigger),
		true,
		`${name} dialog did not return focus to its trigger`
	);
}

test('Tauri CSP is non-null and least-privilege', async () => {
	const config = JSON.parse(await readFile(tauriConfigPath, 'utf8'));
	const capability = JSON.parse(await readFile(capabilityPath, 'utf8'));
	assert.equal(config.app?.windows?.[0]?.zoomHotkeysEnabled, true, 'native zoom hotkeys must remain enabled');
	assert.ok(
		capability.permissions.includes('core:webview:allow-set-webview-zoom'),
		'native zoom permission is missing'
	);
	const csp = config.app?.security?.csp;
	assert.equal(typeof csp, 'string', 'Tauri CSP must be a non-null policy string');
	const directives = new Map(
		csp
			.split(';')
			.map((part) => part.trim())
			.filter(Boolean)
			.map((part) => {
				const [name, ...sources] = part.split(/\s+/);
				return [name, sources];
			})
	);
	for (const name of [
		'default-src',
		'connect-src',
		'img-src',
		'media-src',
		'font-src',
		'style-src',
		'script-src',
		'object-src',
		'frame-src',
		'base-uri',
		'form-action'
	]) {
		assert.ok(directives.has(name), `CSP is missing ${name}`);
	}
		assert.deepEqual(directives.get('object-src'), ["'none'"]);
		assert.deepEqual(directives.get('frame-src'), ["'none'"]);
		assert.deepEqual(directives.get('base-uri'), ["'none'"]);
		assert.deepEqual(directives.get('form-action'), ["'none'"]);
		assert.deepEqual(directives.get('default-src'), ["'self'", 'asset:']);
		assert.deepEqual(directives.get('connect-src'), ["'self'", 'ipc:', 'http://ipc.localhost']);
		assert.deepEqual(directives.get('img-src'), [
			"'self'",
			'asset:',
			'http://asset.localhost',
			'data:',
			'blob:',
			'https:'
		]);
		assert.deepEqual(directives.get('media-src'), [
			"'self'",
			'asset:',
			'http://asset.localhost',
			'blob:',
			'https:'
		]);
		assert.deepEqual(directives.get('font-src'), [
			"'self'",
			'asset:',
			'http://asset.localhost',
			'data:'
		]);
		assert.deepEqual(directives.get('style-src'), ["'self'", "'unsafe-inline'"]);
		assert.deepEqual(directives.get('script-src'), ["'self'"]);
	assert.equal(csp.includes('*'), false, 'CSP must not contain wildcard sources');
});

test('native desktop journey preserves queue, settings, focus, and responsive geometry', { timeout: 180_000 }, async () => {
	assert.ok(appPath, 'YAPEL_E2E_APP_PATH must name the compiled native executable');
	assert.ok(dataHome, 'YAPEL_E2E_DATA_HOME must name the disposable XDG data root');
	assert.ok(sqlitePath, 'YAPEL_E2E_SQLITE must name the sqlite3 executable');
	assert.ok(databasePath, 'native database path could not be derived');

	let driver;
	try {
		driver = await openNativeSession();
		await waitForNativeShell(driver);
		assert.equal(await driver.executeScript('return document.documentElement.lang'), 'en');
		await assertRuntimeCspBlock(driver);
		assert.equal(
			await driver.executeScript("return Boolean(document.querySelector('link[rel=\"icon\"]')?.href)"),
			true,
			'bundled favicon was not resolved by the native WebView'
		);
			await setViewport(driver, 1100, 860);
			await ensureSidebar(driver, true);
			await assertShellGeometry(driver, { sidebarWidth: 240, railVisible: false, playerVisible: false });
		await setViewport(driver, 900, 620);
		await assertGlobalListenTogether(driver);
		await exerciseGlobalListenTogetherKeyboard(driver);
		await assertShellGeometry(driver, { sidebarWidth: 64, railVisible: false, playerVisible: false });
		const homeTerminal = await displayed(driver, By.css('[data-home-terminal-state]'), 'usable Home offline state');
		await displayed(driver, By.xpath("//*[@data-home-terminal-state]//button[normalize-space(.)='Add local folder']"), 'Home local-folder recovery');
		assert.match(await homeTerminal.getText(), /Try again|Sign in with Google/);
		await capture(driver, '01-home-900x620');
	} finally {
		await closeNativeSession(driver);
	}

	await waitForFile(databasePath);
	assert.ok(localMediaPath, 'native local-media path could not be derived');
	await mkdir(localMediaPath, { recursive: true });
	for (const name of [
		'Yapel Test - Native E2E Dawn.mp3',
		'Yapel Test - Native E2E Night.mp3',
		'Yapel Test - Native E2E Signal.mp3'
	]) {
		await writeFile(path.join(localMediaPath, name), '');
	}
	const localFolders = JSON.stringify([localMediaPath]).replaceAll("'", "''");
	const seed = (await readFile(seedPath, 'utf8')).replace('__YAPEL_E2E_LOCAL_FOLDERS__', localFolders);
	assert.equal(seed.includes('__YAPEL_E2E_LOCAL_FOLDERS__'), false, 'fixture path token was not resolved');
	execFileSync(sqlitePath, [databasePath], {
		input: seed,
		stdio: ['pipe', 'pipe', 'pipe']
	});

	driver = undefined;
	try {
		driver = await openNativeSession();
		await waitForNativeShell(driver);
		await driver.wait(
			async () =>
				(await driver.executeScript('return document.body?.innerText.includes("Deterministic Current") ?? false')) === true,
			10_000,
			'cold-restored current track did not reach the native UI'
		);
		assert.equal(
			await driver.executeScript('return document.body?.innerText.includes("Deterministic Upcoming") ?? false'),
			true,
			'cold-restored upcoming track did not reach the native UI'
		);

			// Reach account-independent routes and a real local album through actual controls.
			await setViewport(driver, 1101, 860);
			await ensureSidebar(driver, true);
			await clickNav(driver, '/library');
			const localTab = await displayed(
				driver,
				By.xpath("//*[@role='tab' and normalize-space(.)='Local']"),
				'Local library tab'
			);
			await localTab.click();
			const localAlbum = await displayed(
				driver,
				By.xpath("//*[@role='button' and starts-with(@title, 'Native E2E Collection')]"),
				'native fixture album'
			);
			assert.equal(await localAlbum.isDisplayed(), true);
			await assertWholeAppSurfaces(driver);
		await clickNav(driver, '/');
		await setViewport(driver, 900, 620);
		await clickNav(driver, '/search');

		// Exercise actual native WebView zoom, not a CSS transform. At 200%, the minimum physical
		// window exposes a 450x310 CSS viewport and every owned surface must remain reachable.
		const zoomedViewport = await setWebviewZoom(driver, 2);
		assert.ok(Math.abs(zoomedViewport.width - 450) <= 1, `200% zoom width is ${zoomedViewport.width}`);
		assert.ok(Math.abs(zoomedViewport.height - 310) <= 1, `200% zoom height is ${zoomedViewport.height}`);
		await assertNoRootOverflow(driver);
		const zoomSearch = await displayed(driver, By.css(`${CENTER} [role="combobox"]`), 'zoomed Search combobox');
		await zoomSearch.sendKeys('Native E2E');
		const zoomListbox = await displayed(driver, By.css(`${CENTER} [role="listbox"]`), 'zoomed Search listbox');
		const zoomSearchPanel = await displayed(driver, By.css(`${CENTER} [data-search-panel]`), 'zoomed Search panel');
		await displayed(driver, By.css(`${CENTER} [role="option"]`), 'zoomed local Search option');
		const zoomBounds = { left: 0, top: 0, right: zoomedViewport.width, bottom: zoomedViewport.height };
		assertContained(await rect(driver, zoomSearchPanel), zoomBounds, '200% Search preview');
		const zoomSearchScroll = await driver.executeScript(
			'return { clientHeight: arguments[0].clientHeight, scrollHeight: arguments[0].scrollHeight }',
			zoomSearchPanel
		);
		assert.ok(
			zoomSearchScroll.scrollHeight >= zoomSearchScroll.clientHeight,
			`zoomed Search panel has invalid scrolling geometry: ${JSON.stringify(zoomSearchScroll)}`
		);
		await zoomSearch.sendKeys(Key.ARROW_DOWN);
		assert.ok(await zoomSearch.getAttribute('aria-activedescendant'), 'zoomed Search ArrowDown did not select an option');
		await zoomSearch.sendKeys(Key.ESCAPE);

		const zoomMore = await displayed(driver, By.css(`${PLAYER} button[aria-label="More player controls"]`), 'zoomed player overflow');
		await zoomMore.sendKeys(Key.ENTER);
		await driver.wait(
			async () => (await zoomMore.getAttribute('aria-expanded')) === 'true',
			3_000,
			'zoomed player overflow did not expose its open state'
		);
		const zoomMenu = await displayed(driver, By.css('[data-player-more-menu]'), 'zoomed player overflow menu');
		const zoomMenuRect = await rect(driver, zoomMenu);
		assertContained(zoomMenuRect, zoomBounds, '200% player overflow menu');
		const zoomMenuScroll = await driver.executeScript(
			'return { clientHeight: arguments[0].clientHeight, scrollHeight: arguments[0].scrollHeight }',
			zoomMenu
		);
		assert.ok(
			zoomMenuScroll.scrollHeight > zoomMenuScroll.clientHeight,
			`200% player menu is not an owned scroll region: ${JSON.stringify(zoomMenuScroll)}`
		);
		const zoomTrackActions = await driver.findElement(
			By.xpath("//*[@data-player-more-menu]//button[normalize-space(.)='Track actions']")
		);
		await driver.executeScript('arguments[0].scrollIntoView({ block: "nearest" })', zoomTrackActions);
		assertContained(await rect(driver, zoomTrackActions), await rect(driver, zoomMenu), 'zoomed Track actions');
		await zoomMore.sendKeys(Key.ESCAPE);
		await waitHidden(driver, By.css('[data-player-more-menu]'), 'zoomed player overflow menu');
		const resetViewport = await setWebviewZoom(driver, 1);
		assert.equal(resetViewport.width, 900, 'native zoom did not reset before exact geometry checks');
		assert.equal(resetViewport.height, 620, 'native zoom height did not reset');

		await setViewport(driver, 1024, 620);
		await ensureSidebar(driver, true);
		const search = await displayed(driver, By.css(`${PRIMARY_NAV} [role="combobox"]`), 'sidebar search combobox');
			await search.sendKeys('Native E2E');
			await driver.wait(async () => (await search.getAttribute('aria-expanded')) === 'true', 3_000, 'search preview did not open');
			const listbox = await displayed(driver, By.css(`${PRIMARY_NAV} [role="listbox"]`), 'search preview listbox');
			assert.equal(await listbox.getAttribute('aria-busy'), 'true', 'search preview skipped its loading state');
			assert.equal(
				(await listbox.findElements(By.css('[data-search-loading-row]'))).length,
				4,
				'search loading geometry must reserve four rows'
			);
			const listRect = await rect(driver, listbox);
		const centerRect = await rect(driver, await displayed(driver, By.css(CENTER), 'center region'));
		assertContained(listRect, centerRect, 'search preview');
			await displayed(driver, By.css(`${PRIMARY_NAV} [role="option"]`), 'offline local search option');
			await search.sendKeys(Key.ARROW_DOWN);
			const firstActive = await search.getAttribute('aria-activedescendant');
			assert.ok(firstActive, 'ArrowDown did not select a search option');
			assert.equal(
				await driver.findElement(By.id(firstActive)).getAttribute('aria-selected'),
				'true',
				'active search option is not exposed semantically'
			);
			await search.sendKeys(Key.ARROW_UP);
			assert.ok(await search.getAttribute('aria-activedescendant'), 'ArrowUp cleared the search selection');
			await search.sendKeys(Key.ARROW_DOWN, Key.ENTER);
			await waitForPathPrefix(driver, '/album/');
			await displayed(driver, By.xpath("//h1[normalize-space(.)='Native E2E Collection']"), 'local album heading');
			const compactAlbumArt = await displayed(driver, By.css('[data-media-art]'), 'compact album artwork');
			assert.ok((await rect(driver, compactAlbumArt)).width <= 184, 'compact album artwork exceeds 184px');

			await driver.actions({ async: true }).keyDown(Key.CONTROL).sendKeys('f').keyUp(Key.CONTROL).perform();
			await waitForPath(driver, '/search');
			await assertGlobalListenTogether(driver);
			const offlineSearch = await displayed(driver, By.css(`${PRIMARY_NAV} [role="combobox"]`), 'sidebar search combobox');
			await offlineSearch.clear();
			await offlineSearch.sendKeys('offline proof unavailable');
			await displayed(
				driver,
				By.xpath("//*[@role='status' and contains(normalize-space(.), 'Quick results are unavailable')]"),
				'offline search recovery state'
			);
			await offlineSearch.sendKeys(Key.ESCAPE);
			await driver.wait(async () => (await offlineSearch.getAttribute('aria-expanded')) === 'false', 3_000, 'Escape did not close search preview');
			assert.equal(await driver.executeScript('return document.activeElement === arguments[0]', offlineSearch), true);
			await offlineSearch.sendKeys(Key.ENTER);
			await waitForPath(driver, '/search');
			await driver.wait(
				async () =>
					(await driver.executeScript("return new URL(location.href).searchParams.get('q')")) ===
					'offline proof unavailable',
				3_000,
				'bare Enter did not submit the typed full-search query'
			);
			await capture(driver, '10-search-1024x620');

		// Exact sidebar and rail boundaries, including both remembered manual states.
			await setViewport(driver, 1024, 620);
			await ensureSidebar(driver, true);
			await assertShellGeometry(driver, { sidebarWidth: 240, railVisible: false, playerVisible: true });
			await displayed(driver, By.css(`${PLAYER} [data-player-time]`), 'compact elapsed/duration text');
			const moreControls = await displayed(driver, By.css(`${PLAYER} button[aria-label="More player controls"]`), 'compact player overflow');
			await moreControls.click();
			await displayed(driver, By.css('[data-player-more] input[aria-label="Volume"]'), 'compact volume control');
			const compactTrackActions = await displayed(driver, By.xpath("//*[@data-player-more]//button[normalize-space(.)='Track actions']"), 'compact current-track actions');
			await compactTrackActions.click();
			await displayed(driver, By.xpath("//*[@data-track-menu]//button[normalize-space(.)='Add to shortcuts']"), 'compact Add to shortcuts action');
			await driver.actions({ async: true }).sendKeys(Key.ESCAPE).perform();
			await waitHidden(driver, By.css('[data-track-menu]'), 'topmost Track actions menu');
			assert.equal(await moreControls.getAttribute('aria-expanded'), 'true', 'first Escape also closed the parent player menu');
			await driver.wait(
				async () => (await driver.executeScript('return document.activeElement === arguments[0]', compactTrackActions)) === true,
				3_000,
				'Track actions Escape did not return focus to its trigger'
			);
			await moreControls.click();
			assert.equal(await moreControls.getAttribute('aria-expanded'), 'false');
			await capture(driver, '03-shell-1024-expanded');
		await ensureSidebar(driver, false);
		await assertShellGeometry(driver, { sidebarWidth: 64, railVisible: false, playerVisible: true });
		await capture(driver, '04-shell-1024-collapsed');
		await setViewport(driver, 1023, 620);
		await assertShellGeometry(driver, { sidebarWidth: 64, railVisible: false, playerVisible: true });
		await setViewport(driver, 1024, 620);
		await assertShellGeometry(driver, { sidebarWidth: 64, railVisible: false, playerVisible: true });
		await ensureSidebar(driver, true);
		await setViewport(driver, 1023, 620);
		await assertShellGeometry(driver, { sidebarWidth: 64, railVisible: false, playerVisible: true });
		const queueAt1023 = await openPanel(driver, 'queue');
			assert.equal(await queueAt1023.trigger.getAttribute('aria-controls'), 'queue-panel');
			const queueFocusBefore = await driver.executeScript(
				'return { tag: document.activeElement?.tagName, label: document.activeElement?.getAttribute("aria-label"), html: document.activeElement?.outerHTML?.slice(0, 180) }'
			);
			await driver.actions({ async: true }).keyDown(Key.SHIFT).sendKeys(Key.TAB).keyUp(Key.SHIFT).perform();
			const queueFocusAfter = await driver.executeScript(
				'return { contained: arguments[0].contains(document.activeElement), tag: document.activeElement?.tagName, label: document.activeElement?.getAttribute("aria-label"), html: document.activeElement?.outerHTML?.slice(0, 180) }',
				queueAt1023.panel
			);
			assert.equal(
				queueFocusAfter.contained,
				true,
				`initial Shift+Tab escaped the Queue focus boundary: ${JSON.stringify({ before: queueFocusBefore, after: queueFocusAfter })}`
			);
			const queueRect = await rect(driver, queueAt1023.panel);
			assert.ok(queueRect.width <= 360, `Queue overlay is ${queueRect.width}px wide`);
			assertContained(queueRect, await rect(driver, await displayed(driver, By.css(CENTER), 'center region')), 'Queue overlay');
			const queueSummary = await displayed(
				driver,
				By.css('[data-queue-summary]'),
				'Queue position and source summary'
			);
			const queueSummaryText = await queueSummary.getAttribute('textContent');
			assert.match(queueSummaryText, /1 of 2/);
			assert.match(queueSummaryText, /Native E2E/);
			await capture(driver, '02-queue-1023x620');
			await closePanelWithEscape(driver, 'queue', queueAt1023.trigger);
			const queueSpace = await openPanel(driver, 'queue');
			const transportBeforeSpace = await displayed(driver, By.css(`${PLAYER} button[aria-label="Play"], ${PLAYER} button[aria-label="Pause"]`), 'transport before Queue close');
			const transportLabel = await transportBeforeSpace.getAttribute('aria-label');
			const queueClose = await displayed(driver, By.css('[data-overlay-panel="queue"] button[aria-label="Close queue"]'), 'Queue close button');
			await queueClose.sendKeys(Key.SPACE);
			await waitHidden(driver, By.css('[data-overlay-panel="queue"]'), 'Queue closed with Space');
			const transportAfterSpace = await displayed(driver, By.css(`${PLAYER} button[aria-label="Play"], ${PLAYER} button[aria-label="Pause"]`), 'transport after Queue close');
			assert.equal(await transportAfterSpace.getAttribute('aria-label'), transportLabel, 'Space on Queue close toggled playback');

		await setViewport(driver, 1099, 860);
		await assertShellGeometry(driver, { sidebarWidth: 240, railVisible: false, playerVisible: true });
		const queueAt1099 = await openPanel(driver, 'queue');
		const lyricsTrigger = await displayed(driver, By.css(`${PLAYER} button[aria-label="Toggle lyrics"]`), 'Lyrics trigger');
		await lyricsTrigger.click();
		await waitHidden(driver, By.css('[data-overlay-panel="queue"]'), 'Queue overlay after Lyrics opened');
		const lyrics = await displayed(driver, By.css('[data-overlay-panel="lyrics"]'), 'Lyrics overlay');
		assertContained(await rect(driver, lyrics), await rect(driver, await displayed(driver, By.css(CENTER), 'center region')), 'Lyrics overlay');
			await capture(driver, '05-overlay-1099x860');
			await closePanelWithEscape(driver, 'lyrics', lyricsTrigger);
			assert.equal(await queueAt1099.trigger.getAttribute('aria-expanded'), 'false');
			const resizingQueue = await openPanel(driver, 'queue');
			await setViewport(driver, 1100, 860);
			await waitHidden(driver, By.css('[data-overlay-panel="queue"]'), 'Queue overlay after crossing 1100px');
			const resizedImmersive = await displayed(driver, By.css('[role="dialog"][aria-label="Now playing"]'), 'focused Queue after crossing 1100px');
			assert.equal(await resizingQueue.trigger.getAttribute('aria-expanded'), 'true');
			assert.equal(await resizingQueue.trigger.getAttribute('aria-controls'), 'now-playing-dialog');
			assert.equal(await driver.executeScript('return arguments[0].contains(document.activeElement)', resizedImmersive), true);
			await driver.actions({ async: true }).sendKeys(Key.ESCAPE).perform();
			await waitHidden(driver, By.css('[role="dialog"][aria-label="Now playing"]'), 'resized immersive Queue');
			assert.equal(await driver.executeScript('return document.activeElement === arguments[0]', resizingQueue.trigger), true);

			await assertShellGeometry(driver, { sidebarWidth: 240, railVisible: true, playerVisible: true });
		await capture(driver, '06-rail-1100x860');
		await setViewport(driver, 1101, 860);
		await assertShellGeometry(driver, { sidebarWidth: 240, railVisible: true, playerVisible: true });
		await capture(driver, '07-resize-1101x860');
			await setViewport(driver, 1440, 900);
			await assertShellGeometry(driver, { sidebarWidth: 240, railVisible: true, playerVisible: true });
			await assertPlayerControlsDoNotOverlap(driver);
			await assertMinTarget(driver, By.css(`${PLAYER} input[aria-label="Seek"]`), 'Seek');
			const compactMore = await driver.findElements(By.css(`${PLAYER} button[aria-label="More player controls"]`));
			if (compactMore.length && await compactMore[0].isDisplayed()) {
				await compactMore[0].click();
				await assertMinTarget(driver, By.css('[data-player-more] input[aria-label="Volume"]'), 'compact Volume');
				const compactSleep = await displayed(
					driver,
					By.xpath("//*[@data-player-more]//button[normalize-space(.)='Off' or normalize-space(.)='15m']"),
					'compact sleep choice'
				);
				const compactSleepRect = await rect(driver, compactSleep);
				assert.ok(
					compactSleepRect.width >= 44 && compactSleepRect.height >= 44,
					`compact sleep choice is ${compactSleepRect.width}x${compactSleepRect.height}`
				);
				await compactMore[0].click();
			}
			await ensureSidebar(driver, false);
			await assertShellGeometry(driver, { sidebarWidth: 64, railVisible: true, playerVisible: true });
			await assertPlayerControlsDoNotOverlap(driver);
			await assertMinTarget(driver, By.css(`${PLAYER} input[aria-label="Volume"]`), 'Volume');
			const sleepTrigger = await displayed(driver, By.css(`${PLAYER} button[aria-label="Sleep timer"]`), 'Sleep timer');
			const sleepTriggerRect = await rect(driver, sleepTrigger);
			assert.ok(
				sleepTriggerRect.width >= 44 && sleepTriggerRect.height >= 44,
				`Sleep timer is ${sleepTriggerRect.width}x${sleepTriggerRect.height}`
			);
			await sleepTrigger.click();
			const sleepChoice = await displayed(
				driver,
				By.xpath("//*[@data-sleep]//button[normalize-space(.)='15m']"),
				'wide sleep choice'
			);
			const sleepChoiceRect = await rect(driver, sleepChoice);
			assert.ok(
				sleepChoiceRect.width >= 44 && sleepChoiceRect.height >= 44,
				`wide sleep choice is ${sleepChoiceRect.width}x${sleepChoiceRect.height}`
			);
			await sleepTrigger.click();
			await ensureSidebar(driver, true);
			await clickNav(driver, '/library');
			const onRepeat = await displayed(
				driver,
				By.xpath("//*[@role='button' and starts-with(@title, 'On Repeat')]"),
				'On Repeat playlist card'
			);
			await onRepeat.click();
			await waitForPath(driver, '/playlist/LIMUSIC_ON_REPEAT');
			const mediaHero = await displayed(driver, By.css('[data-media-hero]'), 'playlist media hero');
			await setViewport(driver, 1240, 860);
			const compactPlaylistArt = await displayed(driver, By.css('[data-media-art]'), 'compact playlist artwork');
			const compactPlaylistArtRect = await rect(driver, compactPlaylistArt);
			const compactPlaylistEnvironment = await driver.executeScript(
				`const style = getComputedStyle(arguments[0]);
				 return { innerWidth, outerWidth, clientWidth: document.documentElement.clientWidth,
				   visualWidth: visualViewport?.width, media1242: matchMedia('(min-width: 1242px)').matches,
				   cssWidth: style.width };`,
				compactPlaylistArt
			);
			assert.ok(
				compactPlaylistArtRect.width <= 185,
				`1240px playlist artwork is ${compactPlaylistArtRect.width}px wide: ${JSON.stringify(compactPlaylistEnvironment)}`
			);
			await setViewport(driver, 1241, 860);
			const wideStartArt = await displayed(driver, By.css('[data-media-art]'), '1241 playlist artwork');
			const wideStartArtRect = await rect(driver, wideStartArt);
			const wideStartHeroRect = await rect(driver, mediaHero);
			const wideStartEnvironment = await driver.executeScript(
				`const style = getComputedStyle(arguments[0]);
				 return { innerWidth, cssWidth: style.width, minHeight: getComputedStyle(arguments[1]).minHeight };`,
				wideStartArt,
				mediaHero
			);
			assert.ok(
				wideStartArtRect.width >= 220 && wideStartArtRect.width <= 280,
				`1241px playlist artwork is ${wideStartArtRect.width}px wide: ${JSON.stringify(wideStartEnvironment)}`
			);
			assert.ok(
				wideStartHeroRect.height >= 319,
				`1241px playlist hero is only ${wideStartHeroRect.height}px tall: ${JSON.stringify(wideStartEnvironment)}`
			);
			await setViewport(driver, 1440, 900);
			const wideHeroRect = await rect(driver, mediaHero);
			const wideHeroEnvironment = await driver.executeScript(
				`const style = getComputedStyle(arguments[0]);
				 return { innerWidth, outerWidth, media1241: matchMedia('(min-width: 1241px)').matches,
				   minHeight: style.minHeight, className: arguments[0].className };`,
				mediaHero
			);
			await capture(driver, '08-playlist-1440x900');
			assert.ok(
				wideHeroRect.height >= 319,
				`wide playlist hero is only ${wideHeroRect.height}px tall: ${JSON.stringify(wideHeroEnvironment)}`
			);
			const trackList = await displayed(driver, By.css('[data-track-list]'), 'flat playlist track list');
			const firstTrack = await displayed(driver, By.css('[data-track-list] button[aria-label^="Play "]'), 'playlist track row');
			assert.ok((await rect(driver, firstTrack)).height >= 52, 'playlist row rhythm is below 52px');
			assert.equal(
				await driver.executeScript('return Boolean(arguments[0].closest("[role=button]"))', firstTrack),
				false,
				'play button is nested inside an ARIA button'
			);
			assertContained(await rect(driver, trackList), await rect(driver, await displayed(driver, By.css(CENTER), 'center region')), 'playlist track list');

			// Enable the real preference so immersive lyrics must take the reduced-motion path.
			const motionSettings = await displayed(driver, By.css(`${PRIMARY_NAV} button[title="Settings"]`), 'Settings trigger');
			await motionSettings.click();
			const motionDialog = await displayed(driver, By.css('[role="dialog"]'), 'Settings dialog');
			await driver.actions({ async: true }).keyDown(Key.CONTROL).sendKeys('p').keyUp(Key.CONTROL).perform();
			assert.equal(
				await anyDisplayed(driver, By.css('[role="dialog"][aria-label="Now playing"]')),
				false,
				'Ctrl+P opened Now Playing underneath Settings'
			);
			const undersizedSettingsTargets = await driver.executeScript(
				`return [...arguments[0].querySelectorAll('button, [role="switch"], input:not([type="hidden"]), select')]
					.filter((element) => element.offsetParent !== null)
					.map((element) => {
						const rect = element.getBoundingClientRect();
						return { name: element.getAttribute('aria-label') || element.textContent?.trim() || element.tagName,
							width: rect.width, height: rect.height };
					})
					.filter((target) => target.width < 44 || target.height < 44);`,
				motionDialog
			);
			assert.deepEqual(undersizedSettingsTargets, [], 'Settings contains targets below 44x44px');
			const generalForMotion = await displayed(
				driver,
				By.xpath("//div[@role='dialog']//button[@role='tab' and normalize-space(.)='General']"),
				'General settings tab for Reduce motion'
			);
			await generalForMotion.click();
			await driver.wait(
				async () => (await generalForMotion.getAttribute('aria-selected')) === 'true',
				3_000,
				'General settings tab did not select for Reduce motion'
			);
			const reduceMotion = await displayed(
				driver,
				By.xpath("//div[@role='dialog']//*[normalize-space(.)='Reduce motion']/ancestor::div[contains(@class,'justify-between')][1]//*[@role='switch']"),
				'Reduce motion switch'
			);
			if ((await reduceMotion.getAttribute('data-state')) !== 'checked') await reduceMotion.click();
			assert.equal(await driver.executeScript("return document.documentElement.classList.contains('reduce-motion')"), true);
			await closeDialogWithEscape(driver, motionSettings, 'Settings');

			// Immersive lyrics are readable, reduced-motion, keyboard-dismissable, and return focus.
			const immersiveTrigger = await displayed(driver, By.css(`${PLAYER} button[aria-label="Immersive player"]`), 'Immersive player trigger');
			await resetAnimationProbe(driver);
			await immersiveTrigger.click();
			const immersive = await displayed(driver, By.css('[role="dialog"][aria-label="Now playing"]'), 'immersive Now Playing dialog');
			assert.equal(await driver.executeScript('return arguments[0].contains(document.activeElement)', immersive), true);
			await driver.actions({ async: true }).keyDown(Key.SHIFT).sendKeys(Key.TAB).keyUp(Key.SHIFT).perform();
			assert.equal(
				await driver.executeScript('return arguments[0].contains(document.activeElement)', immersive),
				true,
				'initial Shift+Tab escaped immersive focus containment'
			);
			await driver.wait(
				async () =>
					(await driver.executeScript(
						'return window.__yapelE2eAnimations.filter((entry) => entry.immersive).length'
					)) > 0,
				2_000,
				'immersion did not expose its reduced-motion animation evidence'
			);
			const immersiveAnimations = await driver.executeScript(
				'return window.__yapelE2eAnimations.filter((entry) => entry.immersive)'
			);
			assert.ok(
				immersiveAnimations.every((entry) => entry.duration <= 80),
				`reduced-motion immersive duration exceeded 80ms: ${JSON.stringify(immersiveAnimations)}`
			);
			const artPlane = await displayed(driver, By.css('[data-immersive-artwork]'), 'immersive artwork plane');
			const lyricPlane = await displayed(driver, By.css('[data-immersive-panel]'), 'immersive lyric plane');
			const immersiveRect = await rect(driver, immersive);
			const artRect = await rect(driver, artPlane);
			const lyricRect = await rect(driver, lyricPlane);
			assert.ok(Math.abs(artRect.width / immersiveRect.width - 0.48) < 0.02, 'immersive artwork is not a 48% plane');
			assert.ok(Math.abs(lyricRect.width / immersiveRect.width - 0.52) < 0.02, 'immersive lyrics are not a 52% plane');
			const lyricsFlow = await driver.executeScript(`
				const panel = document.getElementById('now-playing-lyrics');
				const style = getComputedStyle(panel);
				const kids = [...panel.children].map((element) => element.getBoundingClientRect());
				const stacked = kids.length < 2 || kids.every((box, index) => index === 0 || box.top >= kids[index - 1].top - 1);
				return { flexDirection: style.flexDirection, stacked, count: kids.length };
			`);
			assert.equal(lyricsFlow.flexDirection, 'column', `immersive lyrics are not a column: ${JSON.stringify(lyricsFlow)}`);
			assert.equal(lyricsFlow.stacked, true, `immersive lyric children sit side by side: ${JSON.stringify(lyricsFlow)}`);
			const playNesting = await driver.executeScript(`
				const play = document.querySelector('[data-immersive-artwork] > button[aria-label="Play"], [data-immersive-artwork] > button[aria-label="Pause"]');
				const credits = document.querySelector('[data-immersive-credits]');
				return {
					exists: Boolean(play),
					nestedButtons: play ? play.querySelectorAll('button, a[href]').length : -1,
					creditsInsidePlay: play && credits ? play.contains(credits) : null
				};
			`);
			assert.equal(playNesting.exists, true, `immersive play target missing: ${JSON.stringify(playNesting)}`);
			assert.equal(playNesting.nestedButtons, 0, `immersive play nests interactive controls: ${JSON.stringify(playNesting)}`);
			assert.equal(playNesting.creditsInsidePlay, false, `ArtistLine remains inside the immersive play button: ${JSON.stringify(playNesting)}`);
			await capture(driver, '09-immersive-1440x900');
			const immersiveTabs = await driver.executeScript(
				`return [...arguments[0].querySelectorAll('[role="tab"]')].map((element) => {
				   const rect = element.getBoundingClientRect();
				   const style = getComputedStyle(element);
				   const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
				   return { label: element.getAttribute('aria-label'), left: rect.left, top: rect.top,
				     width: rect.width, height: rect.height,
				     display: style.display, visibility: style.visibility, opacity: style.opacity,
				     inLayout: element.offsetParent !== null, hit: Boolean(hit && element.contains(hit)),
				     hitTag: hit?.tagName, hitLabel: hit?.getAttribute?.('aria-label'),
				     hitClass: typeof hit?.className === 'string' ? hit.className : null };
				 });`,
				immersive
			);
			assert.deepEqual(
				immersiveTabs.map((tab) => tab.label),
				['Queue', 'Lyrics'],
				`immersive tabs are missing: ${JSON.stringify(immersiveTabs)}`
			);
			assert.ok(
				immersiveTabs.every(
					(tab) => tab.width >= 44 && tab.height >= 44 && tab.inLayout && tab.hit && tab.display !== 'none' && tab.visibility !== 'hidden' && Number(tab.opacity) > 0
				),
				`immersive tabs are not visibly reachable: ${JSON.stringify(immersiveTabs)}`
			);
			const lyricsTab = await driver.findElement(By.css('[role="dialog"][aria-label="Now playing"] [role="tab"][aria-label="Lyrics"]'));
			await lyricsTab.sendKeys(Key.ARROW_LEFT);
			const queueTab = await driver.findElement(By.css('[role="dialog"][aria-label="Now playing"] [role="tab"][aria-label="Queue"]'));
			assert.equal(await queueTab.getAttribute('aria-selected'), 'true');
			await queueTab.sendKeys(Key.ARROW_RIGHT);
			assert.equal(await lyricsTab.getAttribute('aria-selected'), 'true');
			const firstLyric = await displayed(driver, By.xpath("//*[@id='now-playing-lyrics']//*[@data-line='0' and contains(normalize-space(.), 'quiet rose glow')]"), 'first deterministic lyric');
			await assertMinTarget(driver, By.css('#now-playing-lyrics button[aria-label="Decrease lyrics offset"]'), 'lyrics offset decrease');
			await assertMinTarget(driver, By.css('#now-playing-lyrics button[aria-label="Increase lyrics offset"]'), 'lyrics offset increase');
			await assertMinTarget(driver, By.css('#now-playing-lyrics button[aria-label="Add your lyrics"]'), 'Add your lyrics');
			await firstLyric.click();
			assert.ok(parseFloat(await firstLyric.getCssValue('font-size')) >= 30, 'immersive active lyric is below 30px');
			await driver.executeScript(`
				window.__yapelE2eScrollBehaviors = [];
				const original = Element.prototype.scrollIntoView;
				Element.prototype.scrollIntoView = function(options) {
					window.__yapelE2eScrollBehaviors.push(options?.behavior ?? 'auto');
					return original.call(this, options);
				};
			`);
			const secondLyric = await displayed(driver, By.css('#now-playing-lyrics [data-line="1"]'), 'second deterministic lyric');
			await secondLyric.click();
			await driver.wait(
				async () => (await driver.executeScript("return window.__yapelE2eScrollBehaviors?.includes('instant')")) === true,
				3_000,
				'reduced-motion lyric change did not use immediate scrolling'
			);
			await capture(driver, '09-immersive-1440x900');
		await driver.actions({ async: true }).sendKeys(Key.ESCAPE).perform();
		await waitHidden(driver, By.css('[role="dialog"][aria-label="Now playing"]'), 'immersive Now Playing dialog');
		assert.equal(await driver.executeScript('return document.activeElement === arguments[0]', immersiveTrigger), true);

		// Settings exposes the real backend default, then persists a UI-only change.
		await setViewport(driver, 900, 620);
		const settings = await openSettingsPlayback(driver);
		const dialogRect = await rect(driver, settings.dialog);
		const viewportRect = { left: 0, top: 0, right: 900, bottom: 620 };
		assertContained(dialogRect, viewportRect, 'Settings dialog');
		const fadeGroup = await displayed(driver, By.css('[role="dialog"] [role="group"][aria-label="Fade between tracks"]'), 'fade setting group');
		const fiveSeconds = await displayed(driver, By.xpath("//div[@role='dialog']//*[@role='group' and @aria-label='Fade between tracks']//button[normalize-space(.)='5s']"), '5s fade choice');
		assert.equal(await fiveSeconds.getAttribute('aria-pressed'), 'true', 'UI must reflect the backend 5s default');
		const eightSeconds = await displayed(driver, By.xpath("//div[@role='dialog']//*[@role='group' and @aria-label='Fade between tracks']//button[normalize-space(.)='8s']"), '8s fade choice');
		await eightSeconds.click();
		await driver.wait(async () => (await eightSeconds.getAttribute('aria-pressed')) === 'true', 5_000, '8s fade choice did not persist in UI state');
		assert.equal(await fadeGroup.isDisplayed(), true);
		await capture(driver, '11-settings-900x620');
		await closeDialogWithEscape(driver, settings.trigger, 'Settings');

		// Remove the upcoming seeded item through its row menu; no direct post-seed database write.
		await setViewport(driver, 1100, 860);
		await ensureSidebar(driver, true);
		await assertMinTarget(
			driver,
			By.xpath("//button[@aria-label='Clear queue' or normalize-space(.)='Clear queue']"),
			'Clear queue'
		);
		const upcoming = await displayed(driver, By.css('button[aria-label="Play Deterministic Upcoming"]'), 'upcoming queue row');
		await driver.actions({ async: true }).move({ origin: upcoming }).perform();
		const options = await displayed(
			driver,
			By.css('button[aria-label="Play Deterministic Upcoming"] ~ div button[aria-label="Track options"]'),
			'upcoming track options'
		);
		await options.click();
		const remove = await displayed(driver, By.xpath("//button[normalize-space(.)='Remove from queue']"), 'Remove from queue action');
		const removeRect = await rect(driver, remove);
		assertContained(removeRect, { left: 0, top: 0, right: 1100, bottom: 860 }, 'track menu');
		assert.ok(removeRect.width >= 44 && removeRect.height >= 44, 'track-menu action is below 44x44px');
		await resetAnimationProbe(driver);
		await remove.click();
		await waitHidden(driver, By.css('button[aria-label="Play Deterministic Upcoming"]'), 'removed queue row');
		const queueAnimations = await driver.executeScript(
			'return window.__yapelE2eAnimations.filter((entry) => entry.queueRow)'
		);
		assert.ok(
			queueAnimations.every((entry) => entry.duration <= 1),
			`reduced-motion queue mutation animated: ${JSON.stringify(queueAnimations)}`
		);
	} finally {
		await closeNativeSession(driver);
	}

	// Full native restart against the same XDG state, with no reseed.
	driver = undefined;
	try {
		driver = await openNativeSession();
		await waitForNativeShell(driver);
		await driver.wait(
			async () => (await driver.executeScript('return document.body?.innerText.includes("Deterministic Current") ?? false')) === true,
			10_000,
			'restored current track was absent after restart'
		);
		assert.equal(await driver.executeScript('return document.body?.innerText.includes("Deterministic Upcoming") ?? false'), false, 'removed queue item returned after restart');
		await setViewport(driver, 900, 620);
		await assertGlobalListenTogether(driver);
		const settings = await openSettingsPlayback(driver);
		const eightSeconds = await displayed(driver, By.xpath("//div[@role='dialog']//*[@role='group' and @aria-label='Fade between tracks']//button[normalize-space(.)='8s']"), 'persisted 8s fade choice');
		assert.equal(await eightSeconds.getAttribute('aria-pressed'), 'true', 'fade setting did not survive restart');
		await capture(driver, '12-restart-persistence');
		await closeDialogWithEscape(driver, settings.trigger, 'Settings');
		} finally {
			await closeNativeSession(driver);
		}

		for (const file of REQUIRED_SCREENSHOTS) {
			await access(path.join(artifactDir, file));
		}
	});
