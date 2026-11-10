import { stageCodeInputs } from "./build-data-code.mjs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256FileHexSync, sha256Hex } from "./src/lib/hash.ts";
import { readJsonSync } from "./src/lib/json.ts";

const VERSION = 4;
export const KEY_VERSION = 1;
const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

// Where the stages write. A stage's outputs are the files here it changes.
const OUTPUT_ROOTS = ["data/build", "public/data"];
// Environment variables a stage's output depends on.
const ENVIRONMENT = ["MAXIMUM_DISCOVERED_STEPS"];

/** What a stat says about a file. The inode only distinguishes files. */
const stampOf = (stats) => ({
	size: stats.size,
	mtimeMs: stats.mtimeMs,
	ino: stats.ino,
});

/** Size and mtime of every file under `directory`, keyed by repo path. */
function stampFiles(root, directory, stamps = new Map(), excluded = new Set()) {
	if (excluded.has(directory)) return stamps;
	const target = statSync(join(root, directory), { throwIfNoEntry: false });
	if (!target) return stamps;
	if (target.isFile()) {
		stamps.set(directory, stampOf(target));
		return stamps;
	}
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
		else if (stats.isFile()) stamps.set(path, stampOf(stats));
	}
	return stamps;
}

/** Size and mtime of a file, or of every file under a folder, by repo path. */
function stampPath(root, path, stamps = new Map()) {
	const stats = statSync(join(root, path), { throwIfNoEntry: false });
	if (stats?.isFile()) stamps.set(path, stampOf(stats));
	else if (stats?.isDirectory()) stampFiles(root, path, stamps);
	return stamps;
}

/**
 * The paths a stage may change: its declared `writes`, `shared`, `scratch`,
 * `outputs` and `requiredOutputs`. A stage that declares none is tracked across all of
 * OUTPUT_ROOTS, so it must run alone.
 */
export function stageScope(stage) {
	const paths = [
		...(stage.writes ?? []),
		...(stage.shared ?? []),
		...(stage.scratch ?? []),
		...(stage.outputs ?? []),
		...(stage.requiredOutputs ?? []),
	];
	return paths.length ? [...new Set(paths)] : null;
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
		hash.update(`${path}\0${sha256Hex(content)}\0`);
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

/**
 * The same file, unchanged: size, mtime and inode all match. A record from
 * before inodes were kept has none, and then size and mtime decide.
 */
const sameFile = (a, b) =>
	sameStamp(a, b) &&
	(a.ino === undefined || b.ino === undefined || a.ino === b.ino);

/** Names a file by inode, size and mtime, so its links share a hash. */
const identityOf = (stamp) =>
	stamp.ino ? `${stamp.ino}:${stamp.size}:${stamp.mtimeMs}` : null;

/**
 * The hashes a stage recorded for the files it wrote, by repo path. The file
 * holds one JSON object per line, as the stage appended them; a later line
 * for a path replaces an earlier one, and an unreadable line is ignored. A
 * hash only counts when the file still has the stat it had then.
 */
function readManifest(file, root) {
	let text;
	try {
		text = readFileSync(file, "utf8");
	} catch (error) {
		if (error?.code === "ENOENT") return new Map();
		throw error;
	}
	const claimed = new Map();
	for (const line of text.split("\n")) {
		let entry;
		try {
			entry = JSON.parse(line);
		} catch {
			continue;
		}
		if (
			typeof entry?.path !== "string" ||
			!/^[0-9a-f]{64}$/.test(entry.sha256) ||
			!Number.isFinite(entry.size) ||
			!Number.isFinite(entry.mtimeMs)
		)
			continue;
		const path = relative(root, resolve(root, entry.path))
			.split(sep)
			.join("/");
		if (!path || path.startsWith("..") || isAbsolute(path)) continue;
		claimed.set(path, {
			size: entry.size,
			mtimeMs: entry.mtimeMs,
			ino: entry.ino,
			sha256: entry.sha256,
		});
	}
	return claimed;
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
 * sizes and mtimes in its declared raw inputs (or all of data/source/ when
 * none are declared), the relevant environment, and dependencies'
 * outputs. Its outputs are the files under OUTPUT_ROOTS it created or
 * changed, plus any in the folders it declares as `outputs`. Each is recorded
 * with its size, mtime, inode and SHA-256, and the stage's output digest hashes the
 * contents, so a stage that rewrites identical bytes changes nothing downstream.
 * Size, mtime and inode only decide whether a file must be hashed again; a hash
 * the stage recorded while writing, or one held by a link to the same file, is
 * used instead of reading the file. A file belongs
 * to the last stage that wrote it.
 *
 * @param {{
 *   root?: string,
 *   stateFile?: string,
 *   outputRoots?: string[],
 *   dataDirectory?: string,
 *   codeFiles?: (stage: { name: string, args: string[], codeInputs?: string[] }) => string[],
 *   keyVersion?: number,
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
	keyVersion = KEY_VERSION,
	environment = process.env,
	hashFile = sha256FileHexSync,
} = {}) {
	let state;
	let previousStages = {};
	try {
		state = readJsonSync(stateFile);
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

	const inputs = new Map();
	let files = null;
	const generated = new Set();
	const stageInputs = new Map();
	const currentInputs = (stage) => {
		const selected =
			typeof stage.rawInputs === "function"
				? stage.rawInputs(root)
				: (stage.rawInputs ?? [""]);
		const paths = Array.isArray(selected) ? selected : selected.paths;
		const presence = Array.isArray(selected) ? [] : selected.presence;
		const key = JSON.stringify([paths, presence]);
		if (inputs.has(key)) return inputs.get(key);
		const data = new Map();
		for (const path of paths)
			stampFiles(
				root,
				join(dataDirectory, path),
				data,
				new Set(outputRoots),
			);
		data.delete(join(dataDirectory, ".source-release.json"));
		const existing = presence
			.map((path) => {
				try {
					statSync(join(root, dataDirectory, path));
					return [path, true];
				} catch {
					return [path, false];
				}
			})
			.sort(([left], [right]) => left.localeCompare(right));
		const digest = sha256Hex(
			JSON.stringify({
				data: hashStamps(data),
				existing,
				environment: ENVIRONMENT.map(
					(name) => environment[name] ?? null,
				),
				node: process.versions.node,
			}),
		);
		inputs.set(key, digest);
		return digest;
	};

	const codeFor = (stage) => {
		if (!stageInputs.has(stage.name)) {
			if (!codeFiles) files ??= gitCodeFiles(root);
			const code = codeFiles
				? { files: codeFiles(stage) }
				: stageCodeInputs(root, stage, files);
			stageInputs.set(
				stage.name,
				sha256Hex(
					JSON.stringify({
						...code,
						files: hashCode(root, code.files),
					}),
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

	// What each running stage's scope held when it began.
	const begun = new Map();
	// The output trees and raw sources when an audited stage began. Only
	// `sources` may change the latter.
	const audited = new Map();
	const fullScan = () => {
		const stamps = new Map();
		for (const directory of outputRoots)
			stampFiles(root, directory, stamps);
		stampFiles(root, dataDirectory, stamps);
		return stamps;
	};
	const scopedSnapshot = (scope) => {
		const stamps = new Map();
		for (const path of scope) stampPath(root, path, stamps);
		return stamps;
	};
	// A required file exists, or a required folder holds at least one file.
	const isPresent = (path) => {
		if (fileStamp(path)) return true;
		const stats = statSync(join(root, path), { throwIfNoEntry: false });
		return stats?.isDirectory() ? stampFiles(root, path).size > 0 : false;
	};
	const fileStamp = (path) => {
		const stats = statSync(join(root, path), { throwIfNoEntry: false });
		return stats?.isFile() ? stampOf(stats) : undefined;
	};

	const keyFor = (stage, dependencyDigests) =>
		sha256Hex(
			JSON.stringify({
				version: keyVersion,
				args: stage.args,
				inputs: currentInputs(stage),
				code: codeFor(stage),
				dependencies: dependencyDigests,
			}),
		);

	const writeJson = (path, value) => {
		mkdirSync(dirname(path), { recursive: true });
		const temporary = `${path}.${process.pid}.tmp`;
		writeFileSync(temporary, `${JSON.stringify(value)}\n`);
		renameSync(temporary, path);
	};
	const save = () => writeJson(stateFile, state);

	/** Recorded output entries that carry a hash, by path. */
	const knownHashes = () => {
		const known = new Map();
		for (const record of Object.values(state.stages))
			for (const [path, entry] of Object.entries(record.outputs))
				if (entry.sha256) known.set(path, entry);
		return known;
	};

	/**
	 * Output records for these files. A file is read and hashed only when no
	 * hash can be trusted: its own record, the stage's manifest, or a link to a
	 * file already hashed all need the same size, mtime and inode. With
	 * `verify`, a manifest hash is checked against the bytes instead of trusted,
	 * and any that differ are added to `mismatches`.
	 */
	const withHashes = (
		stamps,
		known = knownHashes(),
		{ trusted = new Map(), verify = false, mismatches = [] } = {},
	) => {
		const linked = new Map();
		for (const entry of known.values()) {
			const identity = identityOf(entry);
			if (identity && !linked.has(identity))
				linked.set(identity, entry.sha256);
		}
		return new Map(
			[...stamps]
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([path, stamp]) => {
					const entry = known.get(path);
					const claimed = trusted.get(path);
					const identity = identityOf(stamp);
					const claims = claimed && sameFile(claimed, stamp);
					let sha256;
					if (verify && claims) {
						sha256 = hashFile(join(root, path));
						if (sha256 !== claimed.sha256) mismatches.push(path);
					} else if (entry && sameFile(entry, stamp))
						sha256 = entry.sha256;
					else if (claims) sha256 = claimed.sha256;
					else if (identity && linked.has(identity))
						sha256 = linked.get(identity);
					else sha256 = hashFile(join(root, path));
					if (identity) linked.set(identity, sha256);
					return [path, { ...stampOf(stamp), sha256 }];
				}),
		);
	};

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
		const snapshot = currentSnapshot();
		// A stage that writes checked-in files has outputs outside the roots.
		const after = {
			has: (path) => snapshot.has(path) || Boolean(fileStamp(path)),
			get: (path) => snapshot.get(path) ?? fileStamp(path),
			keys: () => snapshot.keys(),
		};
		const previous = previousStages[stage.name]?.outputs;
		const paths = new Set([
			...Object.keys(previous ?? {}),
			...(stage.requiredOutputs ?? []),
		]);
		// A required folder stands for the files in it.
		for (const folder of stage.requiredOutputs ?? []) {
			if (after.has(folder)) continue;
			const inside = [...after.keys()].filter((path) =>
				path.startsWith(`${folder}/`),
			);
			if (!inside.length) continue;
			paths.delete(folder);
			for (const path of inside) paths.add(path);
		}
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

	// Where a running stage appends the hashes it computed while writing.
	const manifestFile = (name) =>
		join(dirname(stateFile), "outputs", `${name}.jsonl`);
	// Recorded hashes that did not match the bytes, found in verify mode.
	const mismatched = new Map();

	return {
		/** Where the named stage may append the hashes of the files it writes. */
		manifestPath: manifestFile,

		/** The files whose recorded hash did not match, after a verified record. */
		manifestMismatches(name) {
			const paths = mismatched.get(name) ?? [];
			mismatched.delete(name);
			return paths.sort();
		},

		lastTiming(name) {
			return state.stages[name]?.timing ?? null;
		},

		recordTiming(name, timing) {
			// A stage with a timing is no longer running, even if it failed.
			begun.delete(name);
			audited.delete(name);
			rmSync(manifestFile(name), { force: true });
			state.stages[name] ??= { key: null, digest: null, outputs: {} };
			state.stages[name].timing = timing;
			save();
		},

		writeBuildSummary(summary) {
			writeJson(join(dirname(stateFile), "last-build.json"), summary);
		},

		/** Validate every selected stage before writing any adoption records. */
		validateAdoption(stages) {
			for (const stage of stages) adoptionOutputs(stage);
		},

		/** Trust the existing output bytes without running their producer. */
		adopt(stage, dependencyDigests) {
			const outputs = withHashes(adoptionOutputs(stage));
			const digest = hashOutputs(outputs);
			state.stages[stage.name] = {
				timing: state.stages[stage.name]?.timing,
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
			// A later stage can own the current bytes of a shared output. Its
			// original builder must still recreate it when the file is missing.
			if (stage.requiredOutputs?.some((path) => !isPresent(path)))
				return null;
			// A shared file is not the stage's output, but it must still exist.
			if (stage.shared?.some((path) => !isPresent(path))) return null;
			for (const [path, entry] of Object.entries(record.outputs))
				if (!sameStamp(fileStamp(path), entry)) return null;
			return record.digest;
		},

		/**
		 * Call before a stage runs. Notes the files already there, and
		 * invalidates the stage's record so a failed run is never reused. A stage
		 * with a declared scope is tracked within it, so others can run beside
		 * it. Pass the stage; a bare name tracks the whole output tree. `audit`
		 * also notes the whole tree, for `undeclaredChanges`; only one stage may
		 * run then.
		 */
		begin(stage, { audit = false } = {}) {
			const name = typeof stage === "string" ? stage : stage.name;
			const scope = typeof stage === "string" ? null : stageScope(stage);
			// A stage tracked across the whole tree must have it to itself.
			if (
				[...begun].some(
					([other, entry]) =>
						other !== name && (!scope || !entry.scope),
				)
			)
				throw new Error(
					`Cannot begin ${name} beside a running stage without a declared scope. Pass the stage, not its name, to begin().`,
				);
			if (audit && scope) audited.set(name, fullScan());
			// Hashes left by an earlier run say nothing about this one.
			rmSync(manifestFile(name), { force: true });
			begun.set(name, {
				scope,
				before: scope ? scopedSnapshot(scope) : currentSnapshot(),
			});
			const record = state.stages[name];
			if (!record || record.key === null) return;
			record.key = null;
			save();
		},

		/**
		 * After a stage that began with `audit`: the files it changed outside its
		 * declared scope, which its record would otherwise miss. Raw sources
		 * count: a stage that changes them would stale every stage's key.
		 */
		undeclaredChanges(stage) {
			const before = audited.get(stage.name);
			audited.delete(stage.name);
			const scope = stageScope(stage);
			if (!before || !scope) return [];
			const inScope = (path) =>
				scope.some((own) => path === own || path.startsWith(`${own}/`));
			return [...fullScan()]
				.filter(
					([path, stamp]) =>
						!inScope(path) && !sameFile(before.get(path), stamp),
				)
				.map(([path]) => path)
				.sort();
		},

		/**
		 * Records a stage that just ran successfully, after `begin`, and returns its output
		 * digest. Pass `cacheable: false` for a stage that is never skipped;
		 * its effects reach later stages through their inputs instead.
		 * Hashes the stage appended to its manifest are used for files that still
		 * have the stat recorded with them, so those are not read again. With
		 * `verify` they are checked against the bytes, and `manifestMismatches`
		 * names any that were wrong.
		 */
		record(
			stage,
			dependencyDigests,
			{ cacheable = true, verify = false } = {},
		) {
			const trusted = readManifest(manifestFile(stage.name), root);
			rmSync(manifestFile(stage.name), { force: true });
			const { scope, before } = begun.get(stage.name) ?? {
				scope: null,
				before: currentSnapshot(),
			};
			begun.delete(stage.name);
			snapshot = null;
			const after = scope ? scopedSnapshot(scope) : currentSnapshot();
			for (const [path, stamp] of after)
				if (!sameFile(before.get(path), stamp)) generated.add(path);
			// A scoped stage can keep earlier files outside its scope.
			const afterStamp = (path) =>
				after.get(path) ?? (scope ? fileStamp(path) : undefined);
			if (!cacheable) {
				let changed = false;
				for (const [path, stamp] of after) {
					if (sameFile(before.get(path), stamp)) continue;
					for (const record of Object.values(state.stages)) {
						if (path in record.outputs) {
							delete record.outputs[path];
							changed = true;
						}
					}
				}
				if (changed) save();
				// A stage with a declared scope writes only build outputs, so the
				// raw inputs and code keys of the stages beside it still hold.
				if (!scope) {
					inputs.clear();
					files = null;
					stageInputs.clear();
				}
				return null;
			}
			const outputs = new Map();
			// Hashes of unchanged files come from records the next loop prunes.
			const known = knownHashes();
			// A shared file holds other stages' work, so its bytes are not this
			// stage's digest. The stage tracks what it owns in a stamp instead.
			// Rewriting it still takes it from whichever stage recorded it. A
			// scratch file is the same, except that it is gone once the build
			// is done with it, so it is not required to exist either.
			const isShared = (path) =>
				[...(stage.shared ?? []), ...(stage.scratch ?? [])].some(
					(own) => path === own || path.startsWith(`${own}/`),
				);
			const rewritten = [];
			for (const [path, stamp] of after)
				if (!sameFile(before.get(path), stamp)) {
					rewritten.push(path);
					if (!isShared(path)) outputs.set(path, stamp);
				}
			// Rewriting checked-in code changes what later stages hash as code.
			const codeChanged = [...after].some(
				([path, stamp]) =>
					!sameFile(before.get(path), stamp) &&
					!outputRoots.some((root) => path.startsWith(`${root}/`)),
			);
			if (codeChanged) {
				files = null;
				stageInputs.clear();
			}
			for (const [name, record] of Object.entries(state.stages)) {
				let taken = false;
				for (const path of rewritten)
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
				if (sameStamp(afterStamp(path), entry))
					outputs.set(path, afterStamp(path));
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
			const mismatches = [];
			const hashed = withHashes(outputs, known, {
				trusted,
				verify,
				mismatches,
			});
			if (mismatches.length) mismatched.set(stage.name, mismatches);
			const digest = hashOutputs(hashed);
			state.stages[stage.name] = {
				timing: state.stages[stage.name]?.timing,
				key: keyFor(stage, dependencyDigests),
				dependencies: stage.dependencies ?? [],
				digest,
				outputs: Object.fromEntries(hashed),
			};
			save();
			return digest;
		},

		/** Files created or rewritten during this build that still exist. */
		generatedFiles() {
			return [...generated].flatMap((path) => {
				const stamp = fileStamp(path);
				return stamp ? [[path, stamp.size]] : [];
			});
		},

		/** Where the cache lives, for messages. */
		location: relative(process.cwd(), stateFile) || stateFile,
	};
}
