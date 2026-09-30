import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

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
	"scripts/precompile-data.mts",
	"scripts/precompile-fingerprint.mjs",
	"scripts/precompile-selection.ts",
	"lib/data",
	"lib/helpers",
	"lib/types",
	"public/data/datasets/boundary-mappings.json",
];

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
	const files = (
		await Promise.all(
			inputs.map((input) => filesUnder(root, join(root, input))),
		)
	)
		.flat()
		.sort((left, right) => left.localeCompare(right));
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
