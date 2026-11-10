import { buildDataStages } from "@/pipeline/build-data-graph.mjs";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import {
	mkdirSync,
	mkdtempSync,
	readdirSync,
	rmSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { onTestFinished, test } from "vitest";
import {
	stageCodeFiles,
	stageCodeInputs,
} from "@/pipeline/build-data-code.mjs";
import { createStageCache } from "@/pipeline/build-data-cache.mjs";
import { runBuild } from "@/pipeline/build-data.mjs";

function fixture() {
	const root = mkdtempSync(join(tmpdir(), "atlas-stage-code-"));
	execFileSync("git", ["init", "--quiet", root]);
	onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	const write = (path: string, text: string) => {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), text);
	};
	write("package.json", "{}");
	mkdirSync(join(root, "packages"));
	write(
		"tsconfig.json",
		JSON.stringify({ compilerOptions: { paths: { "@/*": ["./*"] } } }),
	);
	write(
		"scripts/alpha.ts",
		'import { value } from "@/lib/alpha"; console.log(value);',
	);
	write("lib/alpha.ts", 'export { value } from "./transitive";');
	write("lib/transitive.ts", "export const value = 1;");
	write(
		"scripts/beta.ts",
		'const data = import("./dynamic"); console.log(data);',
	);
	write("scripts/dynamic.ts", "export const value = 2;");
	write("scripts/report.ts", 'console.log("report");');
	write("scripts/templates/schema.json", "{}");
	const stages = [
		{
			name: "alpha",
			dependencies: [],
			args: ["exec", "tsx", "scripts/alpha.ts"],
			codeInputs: ["scripts/templates"],
		},
		{
			name: "beta",
			dependencies: [],
			args: ["exec", "tsx", "scripts/beta.ts"],
		},
		{
			name: "report",
			dependencies: ["alpha"],
			args: ["exec", "tsx", "scripts/report.ts"],
		},
	];
	let writes = 0;
	const files = () =>
		readdirSync(root, { recursive: true, withFileTypes: true })
			.filter((file) => file.isFile())
			.map((file) =>
				join(file.parentPath, file.name).slice(root.length + 1),
			);
	const run = async (keyVersion?: number) => {
		const executed: string[] = [];
		const status = await runBuild({
			stages,
			log: () => {},
			createCache: () =>
				createStageCache({
					root,
					stateFile: join(root, ".cache/stages.json"),
					environment: {},
					keyVersion,
				}),
			execute: (stage: { name: string }) => {
				executed.push(stage.name);
				write(`data/build/${stage.name}.json`, String(++writes));
				return 0;
			},
		});
		assert.equal(status, 0);
		return executed;
	};
	return { root, write, run, files, stages };
}

test("UI edits reuse data outputs; transitive and dynamic imports rebuild only affected branches", async () => {
	const { write, run } = fixture();
	assert.deepEqual(await run(), ["alpha", "beta", "report"]);
	assert.deepEqual(await run(), []);
	write("app/page.tsx", "export default function Page() { return null; }");
	write("components/Map.tsx", "export const Map = () => null;");
	write("styles/globals.css", "body { color: red; }");
	assert.deepEqual(await run(), []);
	write("lib/transitive.ts", "export const value = 111;");
	assert.deepEqual(await run(), ["alpha", "report"]);
	write("scripts/dynamic.ts", "export const value = 222;");
	assert.deepEqual(await run(), ["beta"]);
	write("scripts/alpha.ts", 'console.log("new entry");');
	assert.deepEqual(await run(), ["alpha", "report"]);
}, 30_000);

test("declared runtime configuration invalidates only its stage and dependants", async () => {
	const { write, run, stages } = fixture();
	stages[0]!.codeInputs!.push("services/api/config/rules.json");
	await run();
	write("services/api/config/unrelated.json", "changed");
	assert.deepEqual(await run(), []);
	write("services/api/config/rules.json", "changed");
	assert.deepEqual(await run(), ["alpha", "report"]);
});

test("package versions, runner edits and lockfile changes affect only relevant keys", async () => {
	const { write, run } = fixture();
	write(
		"node_modules/example/package.json",
		'{"name":"example","version":"1.0.0","main":"index.js"}',
	);
	write("node_modules/example/index.js", "module.exports = 1;");
	write(
		"scripts/alpha.ts",
		'import value from "example"; console.log(value);',
	);
	assert.deepEqual(await run(), ["alpha", "beta", "report"]);
	write("pnpm-lock.yaml", "unrelated package changed");
	write("pipeline/build-data-cache.mjs", "runner changed");
	assert.deepEqual(await run(), []);
	write(
		"node_modules/example/package.json",
		'{"name":"example","version":"2.0.0","main":"index.js"}',
	);
	assert.deepEqual(await run(), ["alpha", "report"]);
	assert.deepEqual(await run(999), ["alpha", "beta", "report"]);
});

test("runtime compiler options affect keys while type checking options do not", async () => {
	const { write, run } = fixture();
	await run();
	write(
		"tsconfig.json",
		JSON.stringify({
			compilerOptions: { paths: { "@/*": ["./*"] }, strict: true },
		}),
	);
	write("services/api/tsconfig.json", '{"compilerOptions":{"strict":true}}');
	assert.deepEqual(await run(), []);
	write(
		"tsconfig.json",
		JSON.stringify({
			compilerOptions: { paths: { "@/*": ["./*"] }, target: "ES2022" },
		}),
	);
	assert.deepEqual(await run(), ["alpha", "beta", "report"]);
	write("lib/other.ts", "export const value = 3;");
	write(
		"tsconfig.json",
		JSON.stringify({
			compilerOptions: {
				paths: { "@/lib/alpha": ["./lib/other"], "@/*": ["./*"] },
				target: "ES2022",
			},
		}),
	);
	assert.deepEqual(await run(), ["alpha", "report"]);
});

test("explicit file inputs include additions and deletions without rebuilding unrelated stages", async () => {
	const { root, write, run } = fixture();
	await run();
	write("scripts/templates/extra.json", "{}");
	assert.deepEqual(await run(), ["alpha", "report"]);
	unlinkSync(join(root, "scripts/templates/extra.json"));
	assert.deepEqual(await run(), ["alpha", "report"]);
});

test("unresolved local imports fail instead of returning a stale cache hit", async () => {
	const { root, run } = fixture();
	await run();
	unlinkSync(join(root, "lib/transitive.ts"));
	await assert.rejects(run, /Could not resolve/);
});

test("builder discovery does not execute scripts or include generated JSON", async () => {
	const { root, write, stages, files } = fixture();
	write(
		"scripts/alpha.ts",
		'import data from "@/public/data/missing.json"; throw new Error(String(data));',
	);
	const inputs = stageCodeFiles(root, stages[0], files());
	assert.ok(inputs.includes("scripts/alpha.ts"));
	assert.ok(!inputs.some((path: string) => path.startsWith("public/data/")));
});

test("package folders without a manifest do not change or break the code inputs", async () => {
	const { root, write, stages, files } = fixture();
	write(
		"packages/real/package.json",
		JSON.stringify({
			name: "@uk-data-atlas/real",
			exports: "./src/index.ts",
		}),
	);
	write("packages/real/src/index.ts", "export const real = 1;");
	const before = stageCodeInputs(root, stages[0], files());
	// A deleted package whose gitignored node_modules survived a pull.
	write("packages/leftover/node_modules/dep/index.js", "module.exports = 1;");
	mkdirSync(join(root, "packages/empty"));
	const after = stageCodeInputs(root, stages[0], files());
	assert.deepEqual(after, before);
	assert.ok(before.files.includes("scripts/alpha.ts"));
});

test("atlas assembly depends on each declared component output", async () => {
	const stage = (name: string) =>
		buildDataStages.find((entry) => entry.name === name)!;
	assert.ok(
		stage("data-catalog").requiredOutputs.includes(
			"data/build/compiled-observations",
		),
	);
	assert.ok(
		stage("geography-catalogues").requiredOutputs.includes(
			"data/build/geography-payloads.json",
		),
	);
	assert.ok(
		stage("postcode-index").requiredOutputs.includes(
			"data/build/postcode-index.sqlite",
		),
	);
	assert.ok(
		stage("postcode-areas").requiredOutputs.includes(
			"data/build/postcode-areas-component/manifest.json",
		),
	);
	assert.ok(
		stage("postcode-areas").outputs.includes(
			"data/build/postcode-areas-component",
		),
	);
	assert.ok(stage("assemble-atlas").dependencies.includes("postcode-areas"));
	assert.ok(
		stage("website-lookups").requiredOutputs.includes(
			"data/build/website-assets.sqlite",
		),
	);
	// The website's assets live in their own file, so the API release neither
	// waits for them nor is rebuilt when they change.
	assert.ok(
		!stage("assemble-atlas").dependencies.includes("website-lookups"),
	);
	assert.ok(
		stage("atlas-sqlite").requiredOutputs.includes(
			"data/build/atlas-base.sqlite",
		),
	);
	assert.deepEqual(stage("data-catalog").dependencies, [
		"datasets",
		"statistics-vocabulary",
	]);
	assert.ok(
		stage("statistics-vocabulary").dependencies.includes("atlas-sqlite"),
	);
	assert.ok(
		stage("statistics-read-path").dependencies.includes("data-catalog"),
	);
	assert.ok(
		stage("statistics-read-path").dependencies.includes("atlas-sqlite"),
	);
	assert.ok(
		stage("export-manifest").dependencies.includes("statistics-read-path"),
	);
	assert.deepEqual(stage("postcode-index").dependencies, ["sources"]);
	assert.ok(
		!stage("geography-catalogues").dependencies.includes("atlas-sqlite"),
	);
	assert.ok(stage("assemble-atlas").dependencies.includes("data-catalog"));
	assert.ok(
		stage("assemble-atlas").dependencies.includes("geography-catalogues"),
	);
	assert.ok(stage("assemble-atlas").dependencies.includes("postcode-index"));
	assert.ok(
		stage("assemble-atlas").requiredOutputs.includes(
			"data/build/atlas.sqlite",
		),
	);
	assert.deepEqual(
		buildDataStages
			.filter((entry) =>
				[...entry.outputs, ...entry.requiredOutputs].includes(
					"data/build/atlas.sqlite",
				),
			)
			.map((entry) => entry.name),
		["assemble-atlas"],
	);
});

test("production builders resolve without UI code and include declared workers and compiler sources", async () => {
	const root = resolve(".");
	const files = execFileSync(
		"git",
		["ls-files", "--cached", "--others", "--exclude-standard"],
		{ cwd: root, encoding: "utf8" },
	)
		.trim()
		.split("\n");
	const inputs = new Map<string, string[]>();
	for (const stage of buildDataStages.filter(
		(stage) => stage.cacheable !== false,
	)) {
		const code = stageCodeFiles(root, stage, files);
		assert.ok(
			!code.some((path) => /^(app|components|hooks)\//.test(path)),
			stage.name,
		);
		inputs.set(stage.name, code);
	}
	for (const name of [
		"buildPlaceProfiles",
		"placeProfileTimeline",
		"namedPlaceProfiles",
		"placeProfileRefs",
		"placeProfileDatasets",
		"placeProfileGeometry",
	]) {
		assert.ok(
			inputs
				.get("atlas-pages")!
				.includes(`pipeline/src/places/${name}.ts`),
			name,
		);
	}
	for (const stage of [
		"api-datasets",
		"documents",
		"postcode-areas",
		"atlas-pages",
		"atlas-lookups",
	]) {
		const serviceCode = inputs
			.get(stage)!
			.filter((path) => /^services\/api\/(src|scripts)\//.test(path));
		assert.deepEqual(serviceCode, [], stage);
	}
	assert.ok(
		inputs
			.get("datasets")!
			.includes("pipeline/src/precompile/datasetWorker.mts"),
	);
	assert.ok(
		inputs
			.get("map-resource")!
			.includes("pipeline/src/maps/compileGeometryValidity.ts"),
	);
	for (const path of [
		"pipeline/src/buildMapResource.ts",
		"pipeline/src/maps/compileMapResource.ts",
		"pipeline/src/atlas/flatDownloads.ts",
	]) {
		assert.ok(inputs.get("map-resource")!.includes(path), path);
	}
	assert.ok(
		inputs
			.get("crosswalk-inventory")!
			.includes("pipeline/src/relationships/crosswalk-worker.ts"),
	);
	assert.ok(
		inputs
			.get("crosswalk-inventory")!
			.includes("pipeline/src/relationships/crosswalkCompiler.ts"),
	);
	for (const name of [
		"geographies/areaOverlap",
		"relationships/populationOverlap",
		"relationships/geometricContainment",
		"relationships/extentContinuity",
		"relationships/propertyCrosswalk",
		"relationships/crosswalkInventory",
	]) {
		assert.ok(
			inputs
				.get("crosswalk-inventory")!
				.includes(`pipeline/src/${name}.ts`),
			name,
		);
	}
	assert.ok(
		inputs
			.get("geometry-store")!
			.includes("packages/geography/src/geometryValidity.ts"),
	);
	assert.ok(
		inputs
			.get("website-datasets")!
			.includes("pipeline/src/compile-boundaries.mts"),
	);
	for (const name of [
		"boundaryReleaseSources",
		"boundaryBuildFiles",
		"correctBoundarySource",
	]) {
		assert.ok(
			inputs
				.get("website-datasets")!
				.includes(`pipeline/src/geographies/${name}.ts`),
			name,
		);
	}
	assert.ok(
		!inputs
			.get("website-datasets")!
			.includes("scripts/profile-atlas-memory.mjs"),
	);
	assert.ok(!inputs.get("boundaries")!.includes("services/api/openapi.yaml"));
	for (const [stage, configs] of [
		["derived-boundaries", ["area-source-adapters.json"]],
		[
			"area-inventory",
			["area-source-adapters.json", "area-property-adapters.json"],
		],
		["crosswalk-inventory", ["crosswalk-adapters.json"]],
		["relationship-candidates", ["crosswalk-adapters.json"]],
		["relationship-paths", ["relationship-paths.json"]],
		["analysis-geographies", ["analysis-geographies.json"]],
		[
			"validation-report",
			["measure-totals.json", "validation-waivers.json"],
		],
	] as const) {
		for (const config of configs)
			assert.ok(
				inputs.get(stage)!.includes(`services/api/config/${config}`),
				`${stage}: ${config}`,
			);
	}
	assert.ok(
		!inputs
			.get("crosswalk-inventory")!
			.includes("services/api/config/validation-waivers.json"),
	);
	assert.ok(inputs.get("operations")!.includes("services/api/openapi.yaml"));
	for (const path of [
		"pipeline/src/build-derived-boundaries.ts",
		"packages/areas/src/areaSourceAdapters.ts",
		"pipeline/src/geographies/boundarySourcePaths.ts",
		"pipeline/package.json",
		"pipeline/tsconfig.json",
	]) {
		assert.ok(inputs.get("derived-boundaries")!.includes(path), path);
	}
	for (const [stage, compiler] of [
		["boundary-registry", "build-boundary-registry"],
		["area-inventory", "geographies/areaInventory"],
		["geography-inventory", "geographies/geographyInventory"],
	]) {
		for (const path of [
			`pipeline/src/build-${stage}.ts`,
			`pipeline/src/${compiler}.ts`,
			"packages/artifacts/src/contentHash.ts",
			"pipeline/package.json",
			"pipeline/tsconfig.json",
		])
			assert.ok(inputs.get(stage)!.includes(path), `${stage}: ${path}`);
	}
	for (const path of [
		"packages/shapefile/src/dbf.ts",
		"packages/geometry/src/geoJsonProperties.ts",
		"pipeline/src/geographies/boundarySourcePaths.ts",
		"packages/areas/src/areaAdapters.ts",
		"packages/areas/src/areaSourceAdapters.ts",
	]) {
		assert.ok(inputs.get("area-inventory")!.includes(path), path);
	}
	for (const path of [
		"pipeline/src/build-operations.ts",
		"pipeline/src/atlas/operationTemplates.ts",
		"packages/artifacts/src/operations.ts",
		"pipeline/package.json",
		"pipeline/tsconfig.json",
	]) {
		assert.ok(inputs.get("operations")!.includes(path), path);
	}
	assert.ok(
		!inputs
			.get("operations")!
			.includes("services/api/src/operationTemplates.ts"),
	);
	for (const path of [
		"pipeline/src/build-geometry-source-registry.ts",
		"pipeline/src/geographies/geometrySourceRegistry.ts",
		"pipeline/src/lib/fileHashCache.ts",
		"packages/artifacts/src/contentHash.ts",
		"pipeline/package.json",
		"pipeline/tsconfig.json",
	]) {
		assert.ok(inputs.get("geometry-source-registry")!.includes(path), path);
	}
	for (const path of [
		"pipeline/src/build-geography-catalogues.ts",
		"packages/areas/src/geographyBuildPath.ts",
		"pipeline/package.json",
		"pipeline/tsconfig.json",
	]) {
		assert.ok(inputs.get("geography-catalogues")!.includes(path), path);
	}
	for (const path of [
		"pipeline/src/build-relationship-candidates.ts",
		"pipeline/src/relationships/relationshipCandidates.ts",
		"packages/relationships/src/crosswalkAdapters.ts",
		"packages/geography/src/geographyKinds.ts",
		"pipeline/package.json",
		"pipeline/tsconfig.json",
	]) {
		assert.ok(inputs.get("relationship-candidates")!.includes(path), path);
	}
	for (const path of [
		"pipeline/src/build-relationship-paths.ts",
		"pipeline/src/relationships/relationshipPaths.ts",
		"pipeline/src/relationships/relationshipPathAdapters.ts",
		"packages/relationships/src/relationshipPaths.ts",
		"pipeline/src/storage/buildIntermediates.ts",
		"packages/relationships/src/atlasCrosswalks.ts",
		"pipeline/package.json",
		"pipeline/tsconfig.json",
	]) {
		assert.ok(inputs.get("relationship-paths")!.includes(path), path);
	}
	for (const path of [
		"pipeline/src/build-analysis-geographies.ts",
		"pipeline/src/geographies/analysisGeographies.ts",
		"packages/geography/src/geographyKinds.ts",
		"packages/areas/src/geographyBuildPath.ts",
		"pipeline/package.json",
		"pipeline/tsconfig.json",
	]) {
		assert.ok(inputs.get("analysis-geographies")!.includes(path), path);
	}
	for (const path of [
		"packages/atlas-db/src/atlasCache.ts",
		"packages/search-index/src/node/nameFingerprint.ts",
		"packages/geography/src/nameNormalisation.ts",
		"packages/artifacts/src/sqliteTables.ts",
	]) {
		assert.ok(inputs.get("atlas-sqlite")!.includes(path), path);
	}
	for (const stage of ["atlas-release-initial", "atlas-release"]) {
		for (const path of [
			"pipeline/src/build-atlas-release.ts",
			"pipeline/src/atlas/atlasRelease.ts",
			"packages/atlas-db/src/atlasAssets.ts",
			"pipeline/src/lib/fileHashCache.ts",
			"pipeline/package.json",
			"pipeline/tsconfig.json",
		]) {
			assert.ok(inputs.get(stage)!.includes(path), `${stage}: ${path}`);
		}
	}
	for (const path of [
		"pipeline/src/build-data-catalog.ts",
		"pipeline/src/catalog/compileDataCatalog.ts",
		"packages/measures/src/dataCatalog.ts",
		"packages/artifacts/src/sqliteTables.ts",
		"pipeline/package.json",
		"pipeline/tsconfig.json",
	]) {
		assert.ok(inputs.get("data-catalog")!.includes(path), path);
	}
	for (const path of [
		"pipeline/src/build-measure-compatibility.ts",
		"pipeline/src/statistics/measureCompatibility.ts",
		"packages/measures/src/measureCompatibility.ts",
		"packages/measures/src/observationTables.ts",
		"pipeline/package.json",
		"pipeline/tsconfig.json",
	]) {
		assert.ok(inputs.get("measure-compatibility")!.includes(path), path);
	}
	for (const path of [
		"pipeline/src/build-lookup-manifest.ts",
		"packages/areas/src/lookupExports.ts",
		"pipeline/package.json",
		"pipeline/tsconfig.json",
	]) {
		assert.ok(inputs.get("lookup-manifest")!.includes(path), path);
	}
	for (const path of [
		"pipeline/src/build-export-manifest.ts",
		"pipeline/src/atlas/exportManifest.ts",
		"pipeline/src/statistics/observationDownloads.ts",
		"packages/artifacts/src/parquet.ts",
		"pipeline/package.json",
		"pipeline/tsconfig.json",
	]) {
		assert.ok(inputs.get("export-manifest")!.includes(path), path);
	}
	for (const path of [
		"pipeline/src/build-atlas-assets.ts",
		"pipeline/package.json",
		"pipeline/tsconfig.json",
		"packages/atlas-db/src/atlasAssets.ts",
	]) {
		assert.ok(inputs.get("website-lookups")!.includes(path), path);
	}
});

test("moved pipeline builders trace imports and invalidate their own manifests", async () => {
	const { write, run, stages } = fixture();
	write(
		"pipeline/src/build.ts",
		'import { value } from "./compiler"; console.log(value);',
	);
	write("pipeline/src/compiler.ts", "export const value = 1;");
	write("pipeline/package.json", "{}");
	write("pipeline/tsconfig.json", "{}");
	stages[0].args = ["exec", "tsx", "pipeline/src/build.ts"];
	stages[0].codeInputs = ["pipeline/package.json", "pipeline/tsconfig.json"];
	assert.deepEqual(await run(), ["alpha", "beta", "report"]);
	assert.deepEqual(await run(), []);
	for (const path of [
		"pipeline/src/compiler.ts",
		"pipeline/package.json",
		"pipeline/tsconfig.json",
	]) {
		write(
			path,
			path.endsWith(".ts")
				? "export const value = 2;"
				: '{"changed":true}',
		);
		assert.deepEqual(await run(), ["alpha", "report"], path);
		assert.deepEqual(await run(), []);
	}
});

test("untraced API docs, website files and unrelated scripts preserve stage keys", async () => {
	const { write, run } = fixture();
	await run();
	for (const path of [
		"services/api/openapi.yaml",
		"lib/unrelated-website.ts",
		"scripts/unrelated.ts",
		"package.json",
	]) {
		write(
			path,
			path.endsWith(".json")
				? '{"scripts":{"new":"command"}}'
				: "changed",
		);
		assert.deepEqual(await run(), [], path);
	}
});
test("workspace imports trace their source without including unrelated package files", async () => {
	const { write, run } = fixture();
	write(
		"packages/example/package.json",
		JSON.stringify({
			name: "@uk-data-atlas/example",
			exports: "./src/index.ts",
		}),
	);
	write("packages/example/src/index.ts", "export const value = 1;");
	write(
		"scripts/alpha.ts",
		'import { value } from "@uk-data-atlas/example"; console.log(value);',
	);
	await run();
	write("packages/example/src/unused.ts", "export const unused = 2;");
	assert.deepEqual(await run(), []);
	write("packages/example/src/index.ts", "export const value = 222;");
	assert.deepEqual(await run(), ["alpha", "report"]);
});
