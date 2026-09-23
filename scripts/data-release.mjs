/**
 * Packages the uncompiled data tree as immutable GitHub Release assets and
 * restores it for local compilation. Release tags are intentionally data
 * identifiers (for example data-2026-09-23), not application versions.
 *
 * The archive shards are deliberately limited below GitHub's 2 GiB per-asset
 * limit. They are split by file size, rather than by subject area, so a large
 * future domain cannot accidentally produce an invalid release asset.
 */
import { createHash } from "node:crypto";
import {
	copyFile,
	cp,
	mkdir,
	readFile,
	readdir,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DATA = join(ROOT, "data");
const PRECOMPILED = join(ROOT, "public", "data", "datasets");
const CONFIG = join(ROOT, "data-release.json");
const LOCAL_MARKER = join(DATA, ".source-release.json");
const STAGING = join(ROOT, ".data-release");
const MAX_UPLOAD_BYTES = 2 * 1024 ** 3;
const FALLBACK_SHARD_BYTES = Math.floor(1.75 * 1024 ** 3);
const DATA_TAG_PATTERN = /^data-\d{4}-\d{2}-\d{2}(?:-[a-z0-9][a-z0-9.-]*)?$/;

const fail = (message) => {
	throw new Error(message);
};

const run = (command, args, options = {}) => {
	const result = spawnSync(command, args, {
		cwd: ROOT,
		stdio: "inherit",
		...options,
	});
	if (result.error) fail(`Could not run ${command}: ${result.error.message}`);
	if (result.status !== 0)
		fail(
			`${command} ${args[0] ?? ""} exited with ${result.status ?? "an error"}.`,
		);
};

const capture = (command, args) => {
	const result = spawnSync(command, args, {
		cwd: ROOT,
		encoding: "utf8",
	});
	if (result.error || result.status !== 0) return null;
	return result.stdout.trim();
};

const gnuTar = () => {
	for (const command of process.platform === "darwin"
		? ["gtar", "tar"]
		: ["tar", "gtar"]) {
		if ((capture(command, ["--version"]) ?? "").includes("GNU tar"))
			return command;
	}
	fail(
		"GNU tar is required for reproducible data-release archives. On macOS, install it with: brew install gnu-tar",
	);
};

const sha256 = async (path) =>
	createHash("sha256")
		.update(await readFile(path))
		.digest("hex");

const fileSize = async (path) => (await stat(path)).size;

async function filesUnder(directory, prefix = "") {
	const files = [];
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		if (entry.name === ".source-release.json") continue;
		const entryPath = join(directory, entry.name);
		const archivePath = join(prefix, entry.name);
		if (entry.isDirectory())
			files.push(...(await filesUnder(entryPath, archivePath)));
		else if (entry.isFile())
			files.push({
				path: archivePath,
				bytes: (await stat(entryPath)).size,
			});
	}
	return files;
}

function shardFiles(files) {
	const shards = [];
	let shard = [];
	let shardBytes = 0;
	for (const file of files.sort((a, b) => a.path.localeCompare(b.path))) {
		if (
			shard.length > 0 &&
			shardBytes + file.bytes > FALLBACK_SHARD_BYTES
		) {
			shards.push(shard);
			shard = [];
			shardBytes = 0;
		}
		shard.push(file);
		shardBytes += file.bytes;
	}
	if (shard.length > 0) shards.push(shard);
	return shards;
}

function repositoryFromOrigin() {
	const origin = capture("git", ["remote", "get-url", "origin"]);
	if (!origin) fail("Could not determine the GitHub repository from origin.");
	const match = origin.match(/github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?$/);
	if (!match) fail(`origin is not a GitHub repository: ${origin}`);
	return match[1];
}

const todayTag = () => `data-${new Date().toISOString().slice(0, 10)}`;

async function readConfig() {
	try {
		const config = JSON.parse(await readFile(CONFIG, "utf8"));
		if (
			config.version !== 1 ||
			typeof config.tag !== "string" ||
			typeof config.repository !== "string" ||
			!Array.isArray(config.assets)
		)
			fail("data-release.json has an unsupported shape.");
		return config;
	} catch (error) {
		if (error?.code === "ENOENT") return null;
		throw error;
	}
}

async function hasLocalSources() {
	try {
		return (await readdir(DATA)).some(
			(name) => name !== ".source-release.json",
		);
	} catch (error) {
		if (error?.code === "ENOENT") return false;
		throw error;
	}
}

async function createArchives(tag) {
	const files = await filesUnder(DATA);
	if (files.length === 0) fail("data/ has no source files to publish.");
	const output = join(STAGING, tag);
	await mkdir(output, { recursive: true });
	const tar = gnuTar();
	let shards = [
		files.sort((left, right) => left.path.localeCompare(right.path)),
	];
	for (;;) {
		const digits = String(shards.length).length;
		const assets = [];
		let needsFallback = false;

		for (const [index, shard] of shards.entries()) {
			const name =
				shards.length === 1
					? `${tag}.tar.gz`
					: `${tag}.${String(index + 1).padStart(digits, "0")}.tar.gz`;
			const path = join(output, name);
			console.log(
				`Creating ${name} from ${shard.length} files (${(
					shard.reduce((total, file) => total + file.bytes, 0) /
					1024 ** 3
				).toFixed(2)} GiB before compression)...`,
			);
			const reusable = Boolean(
				capture(tar, ["--list", "--gzip", "--file", path]),
			);
			if (reusable) {
				console.log(`  reusing verified ${name}`);
			} else {
				await rm(path, { force: true });
				run(tar, [
					"--create",
					"--gzip",
					"--file",
					path,
					"--directory",
					DATA,
					"--sort=name",
					"--mtime=@0",
					"--owner=0",
					"--group=0",
					"--numeric-owner",
					...shard.map((file) => file.path),
				]);
			}
			const bytes = await fileSize(path);
			if (bytes >= MAX_UPLOAD_BYTES) {
				if (shards.length > 1)
					fail(
						`${name} is ${(bytes / 1024 ** 3).toFixed(2)} GiB; split its source files further before publishing.`,
					);
				console.log(
					`${name} exceeds GitHub's 2 GiB limit after compression; splitting it into fallback shards.`,
				);
				await rm(path, { force: true });
				shards = shardFiles(files);
				needsFallback = true;
				break;
			}
			assets.push({ name, bytes, sha256: await sha256(path), path });
		}
		if (!needsFallback) return assets;
	}
}

async function publish(tag) {
	if (!DATA_TAG_PATTERN.test(tag))
		fail(
			`Invalid data release tag ${JSON.stringify(tag)}. Use data-YYYY-MM-DD (optionally with a suffix).`,
		);
	if (!capture("gh", ["--version"]))
		fail(
			"GitHub CLI (gh) is required to publish. Install it, then run gh auth login.",
		);
	const repository = repositoryFromOrigin();
	const target = capture("git", ["rev-parse", "HEAD"]);
	if (!target) fail("Could not resolve the release target commit.");
	if (capture("gh", ["release", "view", tag, "--repo", repository]))
		fail(
			`GitHub release ${tag} already exists. Releases are immutable snapshots; choose a new data tag.`,
		);

	const assets = await createArchives(tag);
	console.log(
		`Uploading ${assets.length} data assets to ${repository}@${tag}...`,
	);
	run("gh", [
		"release",
		"create",
		tag,
		...assets.map((asset) => asset.path),
		"--repo",
		repository,
		"--target",
		target,
		"--title",
		tag.slice("data-".length),
		"--notes",
		`Immutable source-data snapshot for UK Data Atlas, dated ${tag.slice("data-".length)}.`,
		"--latest=false",
	]);

	const config = {
		version: 1,
		tag,
		repository,
		assets: assets.map(({ path: _path, ...asset }) => asset),
	};
	await writeFile(CONFIG, `${JSON.stringify(config, null, "\t")}\n`);
	console.log(
		`Wrote ${relative(ROOT, CONFIG)}. Commit it with public/data/.`,
	);
}

async function downloadFile(url, destination) {
	await new Promise((resolvePromise, reject) => {
		const child = spawn(
			"curl",
			[
				"--fail",
				"--location",
				"--retry",
				"3",
				"--output",
				destination,
				url,
			],
			{ stdio: "inherit" },
		);
		child.on("error", reject);
		child.on("exit", (code) =>
			code === 0
				? resolvePromise()
				: reject(new Error(`curl exited with ${code}`)),
		);
	});
}

async function replaceSources(staging) {
	await mkdir(DATA, { recursive: true });
	for (const entry of await readdir(DATA, { withFileTypes: true })) {
		if (entry.name === ".source-release.json") continue;
		await rm(join(DATA, entry.name), { recursive: true, force: true });
	}
	for (const entry of await readdir(staging)) {
		const source = join(staging, entry);
		const destination = join(DATA, entry);
		if (entry.isDirectory()) {
			await cp(source, destination, { recursive: true });
		} else {
			await copyFile(source, destination);
		}
	}
}

async function download(force) {
	const config = await readConfig();
	if (!config) {
		if (await hasLocalSources()) {
			console.log(
				"No data-release.json yet; using the local source data.",
			);
			return;
		}
		fail(
			"No data-release.json is committed and no local source data is available.",
		);
	}
	let marker = null;
	try {
		marker = JSON.parse(await readFile(LOCAL_MARKER, "utf8"));
	} catch (error) {
		if (error?.code !== "ENOENT")
			console.log(
				"Raw data marker is unreadable; restoring the pinned release.",
			);
	}
	if (!force && marker?.tag === config.tag && (await hasLocalSources())) {
		console.log(
			`Raw data ${config.tag} is already present; skipping download.`,
		);
		return;
	}
	console.log(`Synchronizing raw data from ${config.tag}...`);

	const workspace = join(STAGING, `download-${config.tag}`);
	await rm(workspace, { recursive: true, force: true });
	await mkdir(workspace, { recursive: true });
	try {
		for (const asset of config.assets) {
			const path = join(workspace, asset.name);
			const url = `https://github.com/${config.repository}/releases/download/${encodeURIComponent(config.tag)}/${encodeURIComponent(asset.name)}`;
			console.log(`Downloading ${asset.name}...`);
			await downloadFile(url, path);
			if (
				(await fileSize(path)) !== asset.bytes ||
				(await sha256(path)) !== asset.sha256
			)
				fail(`Checksum verification failed for ${asset.name}.`);
			run("tar", [
				"--extract",
				"--gzip",
				"--file",
				path,
				"--directory",
				workspace,
			]);
			await rm(path, { force: true });
		}
		await replaceSources(workspace);
		await writeFile(
			LOCAL_MARKER,
			`${JSON.stringify(
				{ version: 1, tag: config.tag, repository: config.repository },
				null,
				"\t",
			)}\n`,
		);
		console.log(`Restored raw data release ${config.tag}.`);
	} finally {
		await rm(workspace, { recursive: true, force: true });
	}
}

async function verifyPrecompiled() {
	try {
		await stat(join(PRECOMPILED, "dataset-manifest.json"));
		await stat(join(PRECOMPILED, "docs-catalogue.json"));
		await stat(join(ROOT, "public", "data", "boundaries"));
	} catch {
		fail(
			"Committed browser data is incomplete. Run pnpm precompile locally and commit public/data/.",
		);
	}
}

async function main() {
	const [command = "help", option] = process.argv.slice(2);
	if (command === "publish") await publish(option ?? todayTag());
	else if (command === "download") await download(option === "--force");
	else if (command === "verify-precompiled") await verifyPrecompiled();
	else {
		console.log(
			"Usage: node scripts/data-release.mjs <publish [data-YYYY-MM-DD]|download [--force]|verify-precompiled>",
		);
	}
}

await main();
