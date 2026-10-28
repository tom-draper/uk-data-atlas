import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative, resolve } from "node:path";

const require = createRequire(
	new URL("../services/api/package.json", import.meta.url),
);
const { buildSync } = require("esbuild");

const commonFiles = new Set([
	"pnpm-lock.yaml",
	"pnpm-workspace.yaml",
	"tsconfig.json",
	"data-release.json",
	"services/api/tsconfig.json",
	"scripts/build-data.mjs",
	"scripts/build-data-graph.mjs",
	"scripts/build-data-cache.mjs",
	"scripts/build-data-code.mjs",
]);
const commonDirectories = ["services/api/config"];
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
	// Resolve workspace exports before treating third-party packages as external.
	const tsconfig = JSON.parse(
		readFileSync(join(root, "tsconfig.json"), "utf8"),
	);
	const paths = { ...tsconfig.compilerOptions?.paths };
	for (const directory of readdirSync(join(root, "packages"), {
		withFileTypes: true,
	})) {
		if (!directory.isDirectory()) continue;
		const path = join(root, "packages", directory.name);
		const manifest = JSON.parse(
			readFileSync(join(path, "package.json"), "utf8"),
		);
		const exports =
			typeof manifest.exports === "string"
				? { ".": manifest.exports }
				: manifest.exports;
		for (const [subpath, target] of Object.entries(exports ?? {})) {
			if (typeof target !== "string")
				throw new Error(
					`Unsupported workspace export: ${manifest.name}${subpath}`,
				);
			paths[
				subpath === "."
					? manifest.name
					: manifest.name + subpath.slice(1)
			] = [join(path, target)];
		}
	}
	const { metafile } = buildSync({
		tsconfigRaw: {
			...tsconfig,
			compilerOptions: {
				...tsconfig.compilerOptions,
				baseUrl: root,
				paths,
			},
		},
		absWorkingDir: root,
		entryPoints: [entry],
		bundle: true,
		write: false,
		metafile: true,
		platform: "node",
		format: "esm",
		packages: "external",
		external: ["public/data", "data/build", "data/source"].map((path) =>
			join(root, path, "*"),
		),
		logLevel: "silent",
	});
	const inputs = Object.keys(metafile.inputs).map((path) =>
		relative(root, resolve(root, path)).replaceAll("\\", "/"),
	);
	const runtimeInputs = inputs.includes(
		"packages/atlas-runtime/src/catalogue/catalogueLoader.ts",
	)
		? ["services/api/openapi.yaml"]
		: [];
	return [
		...new Set([
			...runtimeInputs,
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
