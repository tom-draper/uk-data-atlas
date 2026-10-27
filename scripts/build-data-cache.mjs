import { stageCodeFiles } from "./build-data-code.mjs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	closeSync,
	mkdirSync,
	openSync,
	readdirSync,
	readFileSync,
	readSync,
	renameSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const VERSION = 4;
const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

// Where the stages write. A stage's outputs are the files here it changes.
const OUTPUT_ROOTS = ["data/build", "public/data"];
// Environment variables a stage's output depends on.
const ENVIRONMENT = ["MAXIMUM_DISCOVERED_STEPS"];

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

/** Size and mtime of every file under `directory`, keyed by repo path. */
function stampFiles(root, directory, stamps = new Map(), excluded = new Set()) {
	if (excluded.has(directory)) return stamps;
	let entries;
	try {
		entries = readdirSync(join(root, directory), { withFileTypes: true });
	} catch (error) {
		if (error?.code === "ENOENT" || error?.code === "ENOTDIR")
			return stamps;
		throw error;
	}
	for (const entry of entries) {
		const path = join(directory, entry.name);
		const stats = statSync(join(root, path), { throwIfNoEntry: false });
		if (!stats) continue;
		if (stats.isDirectory()) stampFiles(root, path, stamps, excluded);
		else if (stats.isFile())
			stamps.set(path, { size: stats.size, mtimeMs: stats.mtimeMs });
	}
	return stamps;
}

/**
 * The repo's code and config files: everything git tracks or would track,
 * less tests and docs. Stage-specific code inputs are selected from this list.
 */
function gitCodeFiles(root) {
	return execFileSync(
		"git",
		["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
		{ cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
	)
		.split("\0")
		.filter(
			(path) =>
				path &&
				!path.endsWith(".md") &&
				!/(^|\/)tests?\//.test(path) &&
				!/^(docs|deploy|\.github)\//.test(path),
		);
}

function hashCode(root, files) {
	const hash = createHash("sha256");
	for (const path of [...new Set(files)].sort()) {
		let content;
		try {
			content = readFileSync(join(root, path));
		} catch (error) {
			if (error?.code === "ENOENT" || error?.code === "EISDIR") continue;
			throw error;
		}
		hash.update(`${path}\0${sha256(content)}\0`);
	}
	return hash.digest("hex");
}

/** Hashes raw-data stamps, which are fingerprinted by size and mtime alone. */
function hashStamps(stamps) {
	const hash = createHash("sha256");
	for (const path of [...stamps.keys()].sort()) {
		const { size, mtimeMs } = stamps.get(path);
		hash.update(`${path}\0${size}:${mtimeMs}\0`);
	}
	return hash.digest("hex");
}

/** A stage's output digest: its paths and their contents, never their mtimes. */
function hashOutputs(outputs) {
	const hash = createHash("sha256");
	for (const path of [...outputs.keys()].sort())
		hash.update(`${path}\0${outputs.get(path).sha256}\0`);
	return hash.digest("hex");
}

const sameStamp = (a, b) =>
	Boolean(a && b) && a.size === b.size && a.mtimeMs === b.mtimeMs;

/** SHA-256 of a file, read in chunks so large outputs never sit in memory. */
function hashFileContent(path) {
	const hash = createHash("sha256");
	const buffer = Buffer.allocUnsafe(1024 * 1024);
	const descriptor = openSync(path, "r");
	try {
		for (;;) {
			const read = readSync(descriptor, buffer, 0, buffer.length, null);
			if (read === 0) break;
			hash.update(buffer.subarray(0, read));
		}
	} finally {
		closeSync(descriptor);
	}
	return hash.digest("hex");
}

/** Reads recorded outputs, upgrading `size:mtimeMs` strings from old records. */
function readOutputs(outputs) {
	return Object.fromEntries(
		Object.entries(outputs ?? {}).map(([path, value]) => {
			if (typeof value !== "string") return [path, value];
			const [size, mtimeMs] = value.split(":").map(Number);
			return [path, { size, mtimeMs, sha256: null }];
		}),
	);
}

/**
 * Remembers each stage's inputs and outputs between builds, so a stage is
 * skipped when nothing it reads has changed and what it wrote is still there.
 *
 * A stage's key hashes its command, local imports and shared config, raw-file
 * sizes and mtimes in data/source/, the relevant environment, and dependencies'
 * outputs. Its outputs are the files under OUTPUT_ROOTS it created or
 * changed, plus any in the folders it declares as `outputs`. Each is recorded
 * with its size, mtime and SHA-256, and the stage's output digest hashes the
 * contents, so a stage that rewrites identical bytes changes nothing downstream.
 * Size and mtime only decide whether a file must be hashed again. A file belongs
 * to the last stage that wrote it.
 *
 * @param {{
 *   root?: string,
 *   stateFile?: string,
 *   outputRoots?: string[],
 *   dataDirectory?: string,
 *   codeFiles?: (stage: { name: string, args: string[], codeInputs?: string[] }) => string[],
 *   environment?: Record<string, string | undefined>,
 *   hashFile?: (path: string) => string,
 * }} [options]
 */
export function createStageCache({
	root = repositoryRoot,
	stateFile = resolve(
		root,
		process.env.DATA_BUILD_CACHE_DIR ?? ".cache/data-build",
		"stages.json",
	),
	outputRoots = OUTPUT_ROOTS,
	dataDirectory = "data/source",
	codeFiles,
	environment = process.env,
	hashFile = hashFileContent,
} = {}) {
	let state;
	let previousStages = {};
	try {
		state = JSON.parse(readFileSync(stateFile, "utf8"));
		previousStages = state?.stages ?? {};
		if (state?.version !== VERSION) state = null;
		else
			for (const record of Object.values(state.stages ?? {}))
				record.outputs = readOutputs(record.outputs);
	} catch {
		state = null;
	}
	state ??= {
		version: VERSION,
		stages: Object.fromEntries(
			Object.entries(previousStages).map(([name, record]) => [
				name,
				{
					key: null,
					digest: null,
					outputs: readOutputs(record.outputs),
				},
			]),
		),
	};

	let inputs = null;
	let files = null;
	const stageInputs = new Map();
	const currentInputs = () => {
		if (inputs) return inputs;
		const data = stampFiles(
			root,
			dataDirectory,
			new Map(),
			new Set(outputRoots),
		);
		data.delete(join(dataDirectory, ".source-release.json"));
		inputs = sha256(
			JSON.stringify({
				data: hashStamps(data),
				environment: ENVIRONMENT.map(
					(name) => environment[name] ?? null,
				),
				node: process.versions.node,
			}),
		);
		return inputs;
	};

	const codeFor = (stage) => {
		if (!stageInputs.has(stage.name)) {
			if (!codeFiles) files ??= gitCodeFiles(root);
			stageInputs.set(
				stage.name,
				hashCode(
					root,
					codeFiles
						? codeFiles(stage)
						: stageCodeFiles(root, stage, files),
				),
			);
		}
		return stageInputs.get(stage.name);
	};

	let snapshot = null;
	const currentSnapshot = () => {
		if (snapshot) return snapshot;
		snapshot = new Map();
		for (const directory of outputRoots)
			stampFiles(root, directory, snapshot);
		return snapshot;
	};

	const keyFor = (stage, dependencyDigests) =>
		sha256(
			JSON.stringify({
				args: stage.args,
				inputs: currentInputs(),
				code: codeFor(stage),
				dependencies: dependencyDigests,
			}),
		);

	const save = () => {
		mkdirSync(join(stateFile, ".."), { recursive: true });
		const temporary = `${stateFile}.${process.pid}.tmp`;
		writeFileSync(temporary, `${JSON.stringify(state)}\n`);
		renameSync(temporary, stateFile);
	};

	/** Recorded output entries that carry a hash, by path. */
	const knownHashes = () => {
		const known = new Map();
		for (const record of Object.values(state.stages))
			for (const [path, entry] of Object.entries(record.outputs))
				if (entry.sha256) known.set(path, entry);
		return known;
	};

	/** Output records for these files, hashing only those not known unchanged. */
	const withHashes = (stamps, known = knownHashes()) =>
		new Map(
			[...stamps]
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([path, stamp]) => {
					const entry = known.get(path);
					const sha256 = sameStamp(entry, stamp)
						? entry.sha256
						: hashFile(join(root, path));
					return [
						path,
						{ size: stamp.size, mtimeMs: stamp.mtimeMs, sha256 },
					];
				}),
		);

	/** Every stage the named one depends on, directly or not, from the records. */
	const upstreamOf = (name) => {
		const seen = new Set();
		const visit = (current) => {
			for (const dependency of state.stages[current]?.dependencies ?? [])
				if (!seen.has(dependency)) {
					seen.add(dependency);
					visit(dependency);
				}
		};
		visit(name);
		return seen;
	};

	const adoptionOutputs = (stage) => {
		const after = currentSnapshot();
		const previous = previousStages[stage.name]?.outputs;
		const paths = new Set([
			...Object.keys(previous ?? {}),
			...(stage.requiredOutputs ?? []),
		]);
		for (const folder of stage.outputs ?? []) {
			const found = [...after.keys()].filter(
				(path) => path === folder || path.startsWith(`${folder}/`),
			);
			if (!found.length)
				throw new Error(
					`Cannot adopt ${stage.name}: missing output ${folder}`,
				);
			for (const path of found) paths.add(path);
		}
		if (!paths.size && !previous)
			throw new Error(
				`Cannot adopt ${stage.name}: no output inventory. Build this stage first.`,
			);
		for (const path of paths)
			if (!after.has(path))
				throw new Error(
					`Cannot adopt ${stage.name}: missing output ${path}`,
				);
		return new Map(
			[...paths].sort().map((path) => [path, after.get(path)]),
		);
	};

	return {
		/** Validate every selected stage before writing any adoption records. */
		validateAdoption(stages) {
			for (const stage of stages) adoptionOutputs(stage);
		},

		/** Trust the existing output bytes without running their producer. */
		adopt(stage, dependencyDigests) {
			const outputs = withHashes(adoptionOutputs(stage));
			const digest = hashOutputs(outputs);
			state.stages[stage.name] = {
				key: keyFor(stage, dependencyDigests),
				dependencies: stage.dependencies ?? [],
				digest,
				outputs: Object.fromEntries(outputs),
			};
			save();
			return { digest, files: [...outputs.keys()] };
		},

		/** The recorded output digest of a stage, or null if never built. */
		outputDigest(name) {
			return state.stages[name]?.digest ?? null;
		},

		/**
		 * The stage's output digest if it can be skipped, else null. It can be
		 * skipped when its key is unchanged and every file it wrote still has
		 * the size and mtime it had then. Nothing is hashed here.
		 */
		lookup(stage, dependencyDigests) {
			const record = state.stages[stage.name];
			if (!record || record.key !== keyFor(stage, dependencyDigests))
				return null;
			const files = currentSnapshot();
			// A later stage can own the current bytes of a shared output. Its
			// original builder must still recreate it when the file is missing.
			if (stage.requiredOutputs?.some((path) => !files.has(path)))
				return null;
			for (const [path, entry] of Object.entries(record.outputs))
				if (!sameStamp(files.get(path), entry)) return null;
			return record.digest;
		},

		/**
		 * Call before a stage runs. Notes the files already there, and
		 * invalidates the stage's record so a failed run is never reused.
		 */
		begin(name) {
			currentSnapshot();
			const record = state.stages[name];
			if (!record || record.key === null) return;
			record.key = null;
			save();
		},

		/**
		 * Records a stage that just ran successfully, after `begin`, and returns its output
		 * digest. Pass `cacheable: false` for a stage that is never skipped;
		 * its effects reach later stages through their inputs instead.
		 */
		record(stage, dependencyDigests, { cacheable = true } = {}) {
			const before = currentSnapshot();
			snapshot = null;
			const after = currentSnapshot();
			if (!cacheable) {
				inputs = null;
				files = null;
				stageInputs.clear();
				return null;
			}
			const outputs = new Map();
			// Hashes of unchanged files come from records the next loop prunes.
			const known = knownHashes();
			for (const [path, stamp] of after)
				if (!sameStamp(before.get(path), stamp))
					outputs.set(path, stamp);
			for (const [name, record] of Object.entries(state.stages)) {
				let taken = false;
				for (const path of outputs.keys())
					if (path in record.outputs) {
						delete record.outputs[path];
						taken = true;
					}
				// Rewriting a downstream stage's file can leave this stage's digest
				// unchanged, so that stage must rebuild to restore its own bytes.
				if (
					taken &&
					name !== stage.name &&
					upstreamOf(name).has(stage.name)
				)
					record.key = null;
			}
			const previous = state.stages[stage.name]?.outputs ?? {};
			// Files from an earlier run that this run left untouched.
			for (const [path, entry] of Object.entries(previous))
				if (sameStamp(after.get(path), entry))
					outputs.set(path, after.get(path));
			// A stage that reuses its own earlier files declares the folders it
			// owns, and claims every file in them no other stage wrote.
			if (stage.outputs?.length) {
				const owned = new Set();
				for (const [name, record] of Object.entries(state.stages))
					if (name !== stage.name)
						for (const path of Object.keys(record.outputs))
							owned.add(path);
				for (const [path, stamp] of after)
					if (
						!owned.has(path) &&
						stage.outputs.some((folder) =>
							path.startsWith(`${folder}/`),
						)
					)
						outputs.set(path, stamp);
			}
			const hashed = withHashes(outputs, known);
			const digest = hashOutputs(hashed);
			state.stages[stage.name] = {
				key: keyFor(stage, dependencyDigests),
				dependencies: stage.dependencies ?? [],
				digest,
				outputs: Object.fromEntries(hashed),
			};
			save();
			return digest;
		},

		/** Where the cache lives, for messages. */
		location: relative(process.cwd(), stateFile) || stateFile,
	};
}
