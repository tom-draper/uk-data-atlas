import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

const inputs = [
	"data-release.json",
	"package.json",
	"pnpm-lock.yaml",
	"tsconfig.json",
	"scripts/compile-boundaries.mts",
	"scripts/dataset-discovery.ts",
	"scripts/dataset-region-chunks.mts",
	"scripts/generate-dataset-registry.ts",
	"scripts/generate-sources-readme.mts",
	"scripts/precompile",
	"scripts/precompile-data.mts",
	"scripts/precompile-fingerprint.mjs",
	"scripts/precompile-selection.ts",
	"lib/data",
	"packages/geography/package.json",
	"packages/geography/src",
	"public/data/datasets/boundary-mappings.json",
	"public/data/datasets/parish-lad-mappings.json",
];

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
const importClosure = async (root, files) => {
	const aliases = await readAliases(root);
	const seen = new Set(files);
	const pending = files.filter((file) => sourceFile.test(file));
	while (pending.length > 0) {
		for (const file of await importedFiles(root, aliases, pending.pop())) {
			if (seen.has(file) || file.includes("/node_modules/")) continue;
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

/** A content fingerprint for files that can change a browser data artifact. */
export const precompileFingerprint = async (root) => {
	const listed = (
		await Promise.all(
			inputs.map((input) => filesUnder(root, join(root, input))),
		)
	).flat();
	const files = (await importClosure(root, listed)).sort((left, right) =>
		left.localeCompare(right),
	);
	const hash = createHash("sha256");
	hash.update("uk-data-atlas-precompiler-v1\0");
	for (const path of files) {
		hash.update(relative(root, path));
		hash.update("\0");
		hash.update(await contentsOf(root, path));
		hash.update("\0");
	}
	return `sha256:${hash.digest("hex")}`;
};
