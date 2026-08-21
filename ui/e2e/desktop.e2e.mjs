import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { Builder } from 'selenium-webdriver';

const appPath = process.env.YAPEL_E2E_APP_PATH;
const driverUrl = process.env.YAPEL_E2E_DRIVER_URL ?? 'http://127.0.0.1:4444';
const dataHome = process.env.YAPEL_E2E_DATA_HOME;
const sqlitePath = process.env.YAPEL_E2E_SQLITE;
const artifactDir = process.env.YAPEL_E2E_ARTIFACT_DIR;
const seedPath = new URL('./fixtures/seed.sql', import.meta.url);
const databasePath = dataHome
	? path.join(dataHome, 'com.joshazmy.yapel', 'limusic.sqlite')
	: undefined;

async function openNativeSession() {
	return new Builder()
		.usingServer(driverUrl)
		.withCapabilities({
			browserName: 'wry',
			'tauri:options': { application: appPath }
		})
		.build();
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
		await capture(driver, 'failure-native-shell');
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

async function capture(driver, name) {
	if (!artifactDir) return;
	try {
		await mkdir(artifactDir, { recursive: true });
		await writeFile(path.join(artifactDir, `${name}.png`), await driver.takeScreenshot(), 'base64');
	} catch (error) {
		process.stderr.write(`warning: could not capture ${name}: ${error.message}\n`);
	}
}

async function closeNativeSession(driver) {
	if (!driver) return;
	try {
		await driver.quit();
	} catch (error) {
		process.stderr.write(`warning: native session teardown failed: ${error.message}\n`);
	}
}

test('real Tauri shell migrates its isolated database and cold-restores the seeded queue', { timeout: 60_000 }, async () => {
	assert.ok(appPath, 'YAPEL_E2E_APP_PATH must name the compiled native executable');
	assert.ok(dataHome, 'YAPEL_E2E_DATA_HOME must name the disposable XDG data root');
	assert.ok(sqlitePath, 'YAPEL_E2E_SQLITE must name the sqlite3 executable');
	assert.ok(databasePath, 'native database path could not be derived');

	let driver;
	try {
		driver = await openNativeSession();
		await waitForNativeShell(driver);
		assert.equal(await driver.executeScript('return document.documentElement.lang'), 'en');
		assert.equal(
			await driver.executeScript(
				"return Boolean(document.querySelector('link[rel=\"icon\"]')?.href)"
			),
			true,
			'bundled favicon was not resolved by the native WebView'
		);
		await capture(driver, '01-native-handshake');
	} finally {
		await closeNativeSession(driver);
	}

	await waitForFile(databasePath);
	execFileSync(sqlitePath, [databasePath], {
		input: await readFile(seedPath),
		stdio: ['pipe', 'pipe', 'pipe']
	});

	driver = undefined;
	try {
		driver = await openNativeSession();
		await waitForNativeShell(driver);
		await driver.wait(
			async () =>
				(await driver.executeScript(
					'return document.body?.innerText.includes("Deterministic Current") ?? false'
				)) === true,
			10_000,
			'cold-restored current track did not reach the native UI'
		);
		assert.equal(
			await driver.executeScript(
				'return document.body?.innerText.includes("Deterministic Upcoming") ?? false'
			),
			true,
			'cold-restored upcoming track did not reach the native UI'
		);
		await capture(driver, '02-cold-restored-queue');
	} finally {
		await closeNativeSession(driver);
	}
});
