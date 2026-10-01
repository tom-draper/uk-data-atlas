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
import { createReadStream } from "node:fs";
import {
	cp,
	mkdir,
	readFile,
	readdir,
	rename,
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

const sha256 = async (path) => {
	const hash = createHash("sha256");
	for await (const chunk of createReadStream(path)) hash.update(chunk);
	return hash.digest("hex");
};

const sha256OrNull = async (path) => {
	try {
		return await sha256(path);
	} catch (error) {
		if (error?.code === "ENOENT") return null;
		throw error;
	}
};

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
			config.version !== 2 ||
			typeof config.tag !== "string" ||
			typeof config.commit !== "string" ||
			!/^[0-9a-f]{40}$/.test(config.commit) ||
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
			(name) => name !== ".source-release.json" && name !== ".DS_Store",
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

const fileStamp = async (path) => {
	const metadata = await stat(path);
	return {
		bytes: metadata.size,
		modifiedAt: metadata.mtimeMs,
		changedAt: metadata.ctimeMs,
	};
};

const fileStamps = async (files) =>
	Object.fromEntries(
		await Promise.all(
			Object.keys(files).map(async (path) => [
				path,
				await fileStamp(join(DATA, path)),
			]),
		),
	);

const writeMarker = async (tag, repository, files) =>
	writeFile(
		LOCAL_MARKER,
		`${JSON.stringify(
			{
				version: 3,
				tag,
				repository,
				files,
				fileStamps: await fileStamps(files),
			},
			null,
			"\t",
		)}\n`,
	);

async function publish(tag, targetRef = "HEAD") {
	if (!DATA_TAG_PATTERN.test(tag))
		fail(
			`Invalid data release tag ${JSON.stringify(tag)}. Use data-YYYY-MM-DD (optionally with a suffix).`,
		);
	if (!capture("gh", ["--version"]))
		fail(
			"GitHub CLI (gh) is required to publish. Install it, then run gh auth login.",
		);
	const repository = repositoryFromOrigin();
	const target = capture("git", [
		"rev-parse",
		"--verify",
		`${targetRef}^{commit}`,
	]);
	if (!target) fail(`Could not resolve release target ${targetRef}.`);
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
		version: 2,
		tag,
		commit: target,
		repository,
		assets: assets.map(({ path: _path, ...asset }) => asset),
	};
	await writeFile(CONFIG, `${JSON.stringify(config, null, "\t")}\n`);
	// data/ now matches the release exactly, so it becomes the merge base.
	const files = {};
	for (const { path } of await filesUnder(DATA))
		files[path] = await sha256(join(DATA, path));
	await writeMarker(tag, repository, files);
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
	const replacement = join(STAGING, `restore-${process.pid}`);
	const previous = join(STAGING, `previous-${process.pid}`);
	await rm(replacement, { recursive: true, force: true });
	await rm(previous, { recursive: true, force: true });
	await cp(staging, replacement, { recursive: true });

	let hadPrevious = true;
	try {
		await rename(DATA, previous);
	} catch (error) {
		if (error?.code === "ENOENT") hadPrevious = false;
		else throw error;
	}
	try {
		await rename(replacement, DATA);
	} catch (error) {
		if (hadPrevious) await rename(previous, DATA);
		throw error;
	}
	if (hadPrevious) await rm(previous, { recursive: true, force: true });
}

async function moveFile(source, destination) {
	await mkdir(dirname(destination), { recursive: true });
	try {
		await rename(source, destination);
	} catch (error) {
		if (error?.code !== "EXDEV") throw error;
		await cp(source, destination);
	}
}

/**
 * Three-way merge of an extracted release into data/. `base` maps each path
 * to the hash it had in the previously synchronized release, so a local file
 * that still matches it is known to be untouched and safe to update. Anything
 * added or edited locally is kept.
 */
async function mergeSources(staging, base) {
	const release = {};
	const added = [];
	const updated = [];
	const kept = [];
	for (const { path } of await filesUnder(staging)) {
		const source = join(staging, path);
		const destination = join(DATA, path);
		const releaseHash = await sha256(source);
		release[path] = releaseHash;
		const localHash = await sha256OrNull(destination);
		if (localHash === releaseHash) continue;
		if (localHash === null) added.push(path);
		else if (localHash === base[path]) updated.push(path);
		else {
			kept.push(path);
			continue;
		}
		await moveFile(source, destination);
	}

	const removed = [];
	for (const [path, baseHash] of Object.entries(base)) {
		if (path in release) continue;
		const destination = join(DATA, path);
		if ((await sha256OrNull(destination)) !== baseHash) continue;
		await rm(destination);
		removed.push(path);
	}

	const report = (label, paths) => {
		if (paths.length === 0) return;
		console.log(`${label} (${paths.length}):`);
		for (const path of paths.sort()) console.log(`  ${path}`);
	};
	report("Added from the release", added);
	report("Updated to the release version", updated);
	report("Removed because the release dropped them", removed);
	report(
		"Kept local version that differs from the release (edited or added locally)",
		kept,
	);
	return release;
}

/**
 * How data/ has moved away from the release its marker names: files the
 * release has that are gone, and files whose bytes are no longer the
 * release's. Files added locally are not drift.
 */
async function driftFrom(marker) {
	const missing = [];
	const changed = [];
	if (marker?.version !== 2 && marker?.version !== 3)
		return { missing, changed };
	for (const [path, releaseHash] of Object.entries(marker.files)) {
		const localHash = await sha256OrNull(join(DATA, path));
		if (localHash === null) missing.push(path);
		else if (localHash !== releaseHash) changed.push(path);
	}
	return { missing, changed };
}

async function markerStampsMatch(marker) {
	if (marker?.version !== 3 || !marker.fileStamps) return false;
	const paths = Object.keys(marker.files);
	if (Object.keys(marker.fileStamps).length !== paths.length) return false;
	for (const path of paths) {
		const expected = marker.fileStamps[path];
		if (
			!expected ||
			!Number.isFinite(expected.bytes) ||
			!Number.isFinite(expected.modifiedAt) ||
			!Number.isFinite(expected.changedAt)
		)
			return false;
		try {
			const actual = await fileStamp(join(DATA, path));
			if (
				actual.bytes !== expected.bytes ||
				actual.modifiedAt !== expected.modifiedAt ||
				actual.changedAt !== expected.changedAt
			)
				return false;
		} catch (error) {
			if (error?.code === "ENOENT") return false;
			throw error;
		}
	}
	return true;
}

async function download(mode) {
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
				"Raw data marker is unreadable; merging the pinned release.",
			);
	}
	if (!mode && marker?.tag === config.tag && (await hasLocalSources())) {
		if (await markerStampsMatch(marker)) {
			console.log(
				`Raw data ${config.tag} is already present; verified file stamps match; skipping checksum scan.`,
			);
			return;
		}
		// A stamp mismatch can be an edit or a benign timestamp change. Hash every
		// file before trusting it, then refresh the stamps if the release is intact.
		const { missing, changed } = await driftFrom(marker);
		const list = (paths) =>
			paths
				.slice(0, 20)
				.map((path) => `  ${path}`)
				.concat(
					paths.length > 20
						? [`  and ${paths.length - 20} more`]
						: [],
				)
				.join("\n");
		if (changed.length > 0)
			console.warn(
				`${changed.length} raw data files differ from ${config.tag} and are kept as local edits:\n${list(changed)}\nRun pnpm data:download --replace to restore the release exactly.`,
			);
		if (missing.length === 0) {
			if (changed.length === 0)
				await writeMarker(config.tag, config.repository, marker.files);
			console.log(
				`Raw data ${config.tag} is already present; skipping download.`,
			);
			return;
		}
		console.log(
			`${missing.length} raw data files of ${config.tag} are missing:\n${list(missing)}`,
		);
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
		let files;
		if (mode === "--replace") {
			files = {};
			for (const { path } of await filesUnder(workspace))
				files[path] = await sha256(join(workspace, path));
			await replaceSources(workspace);
		} else {
			await mkdir(DATA, { recursive: true });
			files = await mergeSources(
				workspace,
				marker?.version === 2 || marker?.version === 3
					? marker.files
					: {},
			);
		}
		await writeMarker(config.tag, config.repository, files);
		console.log(
			`${mode === "--replace" ? "Restored" : "Merged"} raw data release ${config.tag}.`,
		);
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
			"Committed browser data is incomplete. Run pnpm precompile locally.",
		);
	}
}

async function main() {
	const [command = "help", option, targetRef] = process.argv.slice(2);
	if (command === "publish")
		await publish(option ?? todayTag(), targetRef ?? "HEAD");
	else if (command === "download") {
		if (option && option !== "--force" && option !== "--replace")
			fail(`Unknown download option ${option}.`);
		await download(option);
	} else if (command === "verify-precompiled") await verifyPrecompiled();
	else {
		console.log(
			"Usage: node scripts/data-release.mjs <publish [data-YYYY-MM-DD] [target-commitish]|download [--force|--replace]|verify-precompiled>",
		);
	}
}

await main();
