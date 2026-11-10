import { readdirSync, readFileSync } from "node:fs";
import { builtinModules, createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";

const require = createRequire(
	new URL("../services/api/package.json", import.meta.url),
);
const { buildSync } = require("esbuild");

const runtimeConfig = {
	"pipeline/src/stages/build-atlas-sqlite.ts": ["measure-dimensions.json"],
	"pipeline/src/stages/build-data-catalog.ts": ["measure-dimensions.json"],
	"pipeline/src/stages/build-export-manifest.ts": ["measure-dimensions.json"],
	"pipeline/src/stages/build-derived-boundaries.ts": [
		"area-source-adapters.json",
	],
	"pipeline/src/stages/build-area-inventory.ts": [
		"area-source-adapters.json",
		"area-property-adapters.json",
	],
	"pipeline/src/relationships/buildCrosswalkInventory.ts": [
		"crosswalk-adapters.json",
	],
	"pipeline/src/stages/build-relationship-candidates.ts": [
		"crosswalk-adapters.json",
	],
	"pipeline/src/stages/build-relationship-paths.ts": [
		"relationship-paths.json",
	],
	"pipeline/src/stages/build-analysis-geographies.ts": [
		"analysis-geographies.json",
	],
	"pipeline/src/stages/build-validation-report.ts": [
		"measure-totals.json",
		"validation-waivers.json",
	],
};
const under = (path, directory) =>
	path === directory || path.startsWith(`${directory}/`);

/** Resolve local imports without executing builders or reading generated data. */
export function stageCodeInputs(root, stage, files) {
	const script = stage.args.find((argument) =>
		/\.(?:[cm]?[jt]sx?)$/.test(argument),
	);
	if (!script)
		throw new Error(`No script entry point for cached stage ${stage.name}`);
	const entry = resolve(root, script);
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
		"packages/atlas-loader/src/catalogueLoader.ts",
	)
		? ["services/api/openapi.yaml"]
		: [];
	for (const input of inputs)
		for (const config of runtimeConfig[input] ?? [])
			runtimeInputs.push(`services/api/config/${config}`);
	if (inputs.includes("pipeline/src/precompile/fingerprint.mjs"))
		runtimeInputs.push("data-release.json");
	const externalImports = new Set(
		Object.values(metafile.outputs).flatMap((output) =>
			output.imports
				.filter((item) => item.external)
				.map((item) => item.path),
		),
	);
	const packages = new Map();
	for (const [input, metadata] of Object.entries(metafile.inputs)) {
		for (const imported of metadata.imports) {
			if (
				!imported.external ||
				!externalImports.has(imported.path) ||
				imported.path.startsWith("@/") ||
				imported.path.startsWith("node:") ||
				builtinModules.includes(imported.path) ||
				imported.path.startsWith(".") ||
				imported.path.startsWith("/")
			)
				continue;
			const name = imported.path.startsWith("@")
				? imported.path.split("/").slice(0, 2).join("/")
				: imported.path.split("/")[0];
			const localRequire = createRequire(resolve(root, input));
			let directory = dirname(localRequire.resolve(imported.path));
			while (true) {
				try {
					const manifest = JSON.parse(
						readFileSync(join(directory, "package.json"), "utf8"),
					);
					if (manifest.name === name) {
						packages.set(`${name}@${manifest.version}`, true);
						break;
					}
				} catch (error) {
					if (error.code !== "ENOENT") throw error;
				}
				const parent = dirname(directory);
				if (parent === directory)
					throw new Error(
						`Cannot find package manifest for ${imported.path}`,
					);
				directory = parent;
			}
		}
	}
	const options = tsconfig.compilerOptions ?? {};
	const runtimeOptions = Object.fromEntries(
		[
			"target",
			"jsx",
			"jsxFactory",
			"jsxFragmentFactory",
			"jsxImportSource",
			"experimentalDecorators",
			"emitDecoratorMetadata",
			"useDefineForClassFields",
			"verbatimModuleSyntax",
		]
			.filter((key) => key in options)
			.map((key) => [key, options[key]]),
	);
	return {
		packages: [...packages.keys()].sort(),
		runtimeOptions,
		files: [
			...new Set([
				...runtimeInputs,
				...inputs,
				...files.filter((path) =>
					(stage.codeInputs ?? []).some((directory) =>
						under(path, directory),
					),
				),
			]),
		],
	};
}

export function stageCodeFiles(root, stage, files) {
	return stageCodeInputs(root, stage, files).files;
}
