import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

// Two kinds of fingerprint come out of this file, so that changing one
// dataset's loader recompiles that dataset alone.
//
// A dataset's own: the files every dataset depends on, plus the files its
// definition imports, directly or through each other.
//
// The pipeline's: everything that builds the artifacts which are not one
// dataset (the gazetteer, the boundary assets, road safety and the region
// chunks), and nothing that belongs to a single dataset.

/** Inputs to every artifact: the raw data release, dependencies and config. */
const baseInputs = [
	"data-release.json",
	"package.json",
	"pnpm-lock.yaml",
	"tsconfig.json",
	"scripts/precompile-fingerprint.mjs",
];

/** What compiles a dataset, whichever dataset it is. */
const datasetCompilerInputs = ["scripts/precompile/compileDataset.mts"];

/** What builds everything that is not a catalogue dataset. */
const pipelineInputs = [
	...baseInputs,
	"scripts/compile-boundaries.mts",
	"scripts/dataset-discovery.ts",
	"scripts/dataset-region-chunks.mts",
	"scripts/generate-dataset-registry.ts",
	"scripts/generate-sources-readme.mts",
	"scripts/precompile",
	"scripts/precompile-data.mts",
	"scripts/precompile-selection.ts",
	"packages/geography/package.json",
	"packages/geography/src",
	"public/data/datasets/boundary-mappings.json",
	"public/data/datasets/parish-lad-mappings.json",
];

const definitionsDirectory = "lib/data/catalog/definitions";

// These name every dataset, so reaching one from a single dataset's imports
// would tie that dataset to all the others, and adding a dataset would change
// everyone's fingerprint. Following an import stops at them. Each dataset's
// definition is the starting point of its own fingerprint instead.
const barredFiles = new Set([
	"lib/data/catalog/registry.ts",
	"lib/data/catalog/generated.ts",
	`${definitionsDirectory}/index.ts`,
]);

// Beyond the inputs above, the precompiler is changed by any module they
// import, wherever it lives. Following the imports, rather than hashing whole
// directories such as lib/helpers, keeps a change to code the precompiler never
// loads (the map's URL state, say) from invalidating every dataset.
const sourceFile = /\.(?:[cm]?[jt]s|tsx)$/;
const importSpecifier =
	/(?:import|export)\s[^;"']*?from\s*["']([^"']+)["']|import\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
const candidates = [
	"",
	".ts",
	".tsx",
	".mts",
	".mjs",
	".js",
	".json",
	"/index.ts",
	"/index.tsx",
];

const isFile = async (path) => {
	try {
		return (await stat(path)).isFile();
	} catch {
		return false;
	}
};

const resolveFile = async (base) => {
	for (const suffix of candidates) {
		if (await isFile(base + suffix)) return base + suffix;
	}
	return undefined;
};

/** tsconfig path aliases as [prefix, target directory] pairs, e.g. "@lib/". */
const readAliases = async (root) => {
	const { compilerOptions } = JSON.parse(
		await readFile(join(root, "tsconfig.json"), "utf8"),
	);
	return Object.entries(compilerOptions?.paths ?? {}).flatMap(
		([pattern, [target]]) =>
			pattern.endsWith("/*") && target.endsWith("/*")
				? [[pattern.slice(0, -1), target.slice(0, -1)]]
				: [],
	);
};

const importedFiles = async (root, aliases, file) => {
	const imported = [];
	const source = await readFile(file, "utf8");
	for (const match of source.matchAll(importSpecifier)) {
		const specifier = match[1] ?? match[2] ?? match[3];
		const bases = [];
		if (specifier.startsWith(".")) {
			const base = resolve(dirname(file), specifier);
			// A TypeScript source is imported by its emitted extension.
			bases.push(base.replace(/\.m?js$/, ""), base);
		} else if (specifier.startsWith("@uk-data-atlas/")) {
			bases.push(
				join(
					root,
					"packages",
					specifier.slice("@uk-data-atlas/".length),
					"src",
					"index",
				),
			);
		} else {
			for (const [prefix, target] of aliases) {
				if (specifier.startsWith(prefix))
					bases.push(
						join(root, target + specifier.slice(prefix.length)),
					);
			}
		}
		for (const base of bases) {
			const found = await resolveFile(base);
			if (found) {
				imported.push(found);
				break;
			}
		}
	}
	return imported;
};

/** Every file the given files import, directly or through each other. */
const importClosure = async (context, files) => {
	const { root, importsOf } = context;
	const seen = new Set(files);
	const pending = files.filter((file) => sourceFile.test(file));
	while (pending.length > 0) {
		for (const file of await importsOf(pending.pop())) {
			if (
				seen.has(file) ||
				file.includes("/node_modules/") ||
				barredFiles.has(relative(root, file))
			)
				continue;
			seen.add(file);
			if (sourceFile.test(file)) pending.push(file);
		}
	}
	return [...seen];
};

// Only these package.json fields can change what the precompiler emits; its
// scripts change often and never do, so hashing them would stale the data.
const packageFields = ["engines", "dependencies", "devDependencies"];

const contentsOf = async (root, path) => {
	const contents = await readFile(path);
	if (relative(root, path) !== "package.json") return contents;
	const manifest = JSON.parse(contents.toString("utf8"));
	return JSON.stringify(
		packageFields.map((field) => [field, manifest[field] ?? null]),
	);
};

const filesUnder = async (root, path) => {
	const entry = await stat(path);
	if (!entry.isDirectory()) return [path];
	const files = [];
	for (const child of await readdir(path, { withFileTypes: true })) {
		if (child.name === "node_modules") continue;
		files.push(...(await filesUnder(root, join(path, child.name))));
	}
	return files;
};

/**
 * Reads each file and works out what it imports once, however many
 * fingerprints include it.
 */
const createContext = async (root) => {
	const aliases = await readAliases(root);
	const imports = new Map();
	const digests = new Map();
	const memoised = (cache, key, compute) => {
		if (!cache.has(key)) cache.set(key, compute());
		return cache.get(key);
	};
	return {
		root,
		importsOf: (file) =>
			memoised(imports, file, () => importedFiles(root, aliases, file)),
		digestOf: (file) =>
			memoised(digests, file, async () =>
				createHash("sha256")
					.update(await contentsOf(root, file))
					.digest("hex"),
			),
	};
};

const expand = async (context, inputs) => {
	const listed = (
		await Promise.all(
			inputs.map((input) =>
				filesUnder(context.root, join(context.root, input)),
			),
		)
	).flat();
	return importClosure(context, listed);
};

/** One content fingerprint over `files`, which `label` tells apart from another's. */
const fingerprintOf = async (context, label, files) => {
	const hash = createHash("sha256");
	hash.update(`${label}\0`);
	for (const path of [...new Set(files)].sort((left, right) =>
		left.localeCompare(right),
	)) {
		hash.update(relative(context.root, path));
		hash.update("\0");
		hash.update(await context.digestOf(path));
		hash.update("\0");
	}
	return `sha256:${hash.digest("hex")}`;
};

/** The dataset type each definition file declares, by file. */
const definitionFiles = async (root) => {
	const directory = join(root, definitionsDirectory);
	const found = new Map();
	for (const name of (await readdir(directory)).sort()) {
		if (!sourceFile.test(name) || name === "index.ts") continue;
		const path = join(directory, name);
		const type = /^\s*type:\s*"([^"]+)"/m.exec(
			await readFile(path, "utf8"),
		)?.[1];
		if (!type)
			throw new Error(
				`${definitionsDirectory}/${name} declares no type.`,
			);
		if (found.has(type))
			throw new Error(
				`Two dataset definitions declare the type ${type}.`,
			);
		found.set(type, path);
	}
	return found;
};

/**
 * Content fingerprints for the files that can change a browser data artifact:
 * one for the pipeline, and one for each catalogue dataset by its type.
 *
 * @param {string} root
 * @returns {Promise<{ pipeline: string, datasets: Record<string, string> }>}
 */
export const precompileFingerprints = async (root) => {
	const context = await createContext(root);
	const shared = await expand(context, [
		...baseInputs,
		...datasetCompilerInputs,
	]);
	/** @type {Record<string, string>} */
	const datasets = {};
	for (const [type, file] of await definitionFiles(root)) {
		const own = await importClosure(context, [file]);
		datasets[type] = await fingerprintOf(
			context,
			`uk-data-atlas-dataset-v1\0${type}`,
			[...shared, ...own],
		);
	}
	return {
		pipeline: await fingerprintOf(
			context,
			"uk-data-atlas-precompiler-v2",
			await expand(context, pipelineInputs),
		),
		datasets,
	};
};
