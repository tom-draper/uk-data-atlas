import { createRequire } from "node:module";
import { join, relative, resolve } from "node:path";

const require = createRequire(
	new URL("../services/api/package.json", import.meta.url),
);
const { buildSync } = require("esbuild");

const commonFiles = new Set([
	"package.json",
	"pnpm-lock.yaml",
	"pnpm-workspace.yaml",
	"tsconfig.json",
	"data-release.json",
	"services/api/package.json",
	"services/api/tsconfig.json",
	"services/api/openapi.yaml",
	"scripts/build-data.mjs",
	"scripts/build-data-graph.mjs",
	"scripts/build-data-cache.mjs",
	"scripts/build-data-code.mjs",
]);
const commonDirectories = ["packages", "shared", "services/api/config"];
const under = (path, directory) =>
	path === directory || path.startsWith(`${directory}/`);

/** Resolve local imports without executing builders or reading generated data. */
export function stageCodeFiles(root, stage, files) {
	const script = stage.args.find((argument) =>
		/\.(?:[cm]?[jt]sx?)$/.test(argument),
	);
	if (!script)
		throw new Error(`No script entry point for cached stage ${stage.name}`);
	const directory = stage.args.includes("--dir")
		? root
		: join(root, "services/api");
	const entry = resolve(directory, script);
	const { metafile } = buildSync({
		absWorkingDir: root,
		entryPoints: [entry],
		bundle: true,
		write: false,
		metafile: true,
		platform: "node",
		format: "esm",
		packages: "external",
		external: [
			"public/data",
			"services/api/public",
			"data/build",
			"data/source",
		].map((path) => join(root, path, "*")),
		logLevel: "silent",
	});
	const inputs = Object.keys(metafile.inputs).map((path) =>
		relative(root, resolve(root, path)).replaceAll("\\", "/"),
	);
	return [
		...new Set([
			...inputs,
			...files.filter(
				(path) =>
					commonFiles.has(path) ||
					[...commonDirectories, ...(stage.codeInputs ?? [])].some(
						(directory) => under(path, directory),
					),
			),
		]),
	];
}
