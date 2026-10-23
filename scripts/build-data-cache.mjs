import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const VERSION = 1;
const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

// Where the stages write. A stage's outputs are the files here it changes.
const OUTPUT_ROOTS = ["data/build", "public/data", "services/api/public"];
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
			stamps.set(path, `${stats.size}:${stats.mtimeMs}`);
	}
	return stamps;
}

/**
 * The repo's code and config files: everything git tracks or would track,
 * less tests and docs. A coarse input, so any code change reruns every stage.
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

function hashStamps(stamps) {
	const hash = createHash("sha256");
	for (const path of [...stamps.keys()].sort())
		hash.update(`${path}\0${stamps.get(path)}\0`);
	return hash.digest("hex");
}

/**
 * Remembers each stage's inputs and outputs between builds, so a stage is
 * skipped when nothing it reads has changed and what it wrote is still there.
 *
 * A stage's key hashes its command, the repo's code, the size and mtime of
 * every file in data/source/, the relevant environment, and its dependencies'
 * outputs. Its outputs are the files under OUTPUT_ROOTS it created or
 * changed, plus any in the folders it declares as `outputs`, recorded by size
 * and mtime. A file belongs to the last stage that wrote it.
 *
 * @param {{
 *   root?: string,
 *   stateFile?: string,
 *   outputRoots?: string[],
 *   dataDirectory?: string,
 *   codeFiles?: () => string[],
 *   environment?: Record<string, string | undefined>,
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
	codeFiles = () => gitCodeFiles(root),
	environment = process.env,
} = {}) {
	let state;
	try {
		state = JSON.parse(readFileSync(stateFile, "utf8"));
		if (state?.version !== VERSION) state = null;
	} catch {
		state = null;
	}
	state ??= { version: VERSION, stages: {} };

	let inputs = null;
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
				code: hashCode(root, codeFiles()),
				data: hashStamps(data),
				environment: ENVIRONMENT.map(
					(name) => environment[name] ?? null,
				),
				node: process.versions.node,
			}),
		);
		return inputs;
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
				dependencies: dependencyDigests,
			}),
		);

	const save = () => {
		mkdirSync(join(stateFile, ".."), { recursive: true });
		const temporary = `${stateFile}.${process.pid}.tmp`;
		writeFileSync(temporary, `${JSON.stringify(state)}\n`);
		renameSync(temporary, stateFile);
	};

	return {
		/** The recorded output digest of a stage, or null if never built. */
		outputDigest(name) {
			return state.stages[name]?.digest ?? null;
		},

		/**
		 * The stage's output digest if it can be skipped, else null. It can be
		 * skipped when its key is unchanged and every file it wrote still has
		 * the size and mtime it had then.
		 */
		lookup(stage, dependencyDigests) {
			const record = state.stages[stage.name];
			if (!record || record.key !== keyFor(stage, dependencyDigests))
				return null;
			const files = currentSnapshot();
			for (const [path, stamp] of Object.entries(record.outputs))
				if (files.get(path) !== stamp) return null;
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
				return null;
			}
			const outputs = new Map();
			for (const [path, stamp] of after)
				if (before.get(path) !== stamp) outputs.set(path, stamp);
			for (const record of Object.values(state.stages))
				for (const path of outputs.keys()) delete record.outputs[path];
			const previous = state.stages[stage.name]?.outputs ?? {};
			// Files from an earlier run that this run left untouched.
			for (const [path, stamp] of Object.entries(previous))
				if (after.get(path) === stamp) outputs.set(path, stamp);
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
			const digest = hashStamps(outputs);
			state.stages[stage.name] = {
				key: keyFor(stage, dependencyDigests),
				digest,
				outputs: Object.fromEntries(
					[...outputs].sort(([a], [b]) => a.localeCompare(b)),
				),
			};
			save();
			return digest;
		},

		/** Where the cache lives, for messages. */
		location: relative(process.cwd(), stateFile) || stateFile,
	};
}
