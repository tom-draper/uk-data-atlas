import { buildDataStages } from "@/scripts/build-data-graph.mjs";
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
import { stageCodeFiles } from "@/scripts/build-data-code.mjs";
import { createStageCache } from "@/scripts/build-data-cache.mjs";
import { runBuild } from "@/scripts/build-data.mjs";

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
			args: ["--dir", "../..", "exec", "tsx", "scripts/alpha.ts"],
			codeInputs: ["scripts/templates"],
		},
		{
			name: "beta",
			dependencies: [],
			args: ["--dir", "../..", "exec", "tsx", "scripts/beta.ts"],
		},
		{
			name: "report",
			dependencies: ["alpha"],
			args: ["--dir", "../..", "exec", "tsx", "scripts/report.ts"],
		},
	];
	let writes = 0;
	const files = () =>
		readdirSync(root, { recursive: true, withFileTypes: true })
			.filter((file) => file.isFile())
			.map((file) =>
				join(file.parentPath, file.name).slice(root.length + 1),
			);
	const run = () => {
		const executed: string[] = [];
		const status = runBuild({
			stages,
			log: () => {},
			createCache: () =>
				createStageCache({
					root,
					stateFile: join(root, ".cache/stages.json"),
					environment: {},
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

test("UI edits reuse data outputs; transitive and dynamic imports rebuild only affected branches", () => {
	const { write, run } = fixture();
	assert.deepEqual(run(), ["alpha", "beta", "report"]);
	assert.deepEqual(run(), []);
	write("app/page.tsx", "export default function Page() { return null; }");
	write("components/Map.tsx", "export const Map = () => null;");
	write("styles/globals.css", "body { color: red; }");
	assert.deepEqual(run(), []);
	write("lib/transitive.ts", "export const value = 111;");
	assert.deepEqual(run(), ["alpha", "report"]);
	write("scripts/dynamic.ts", "export const value = 222;");
	assert.deepEqual(run(), ["beta"]);
	write("scripts/alpha.ts", 'console.log("new entry");');
	assert.deepEqual(run(), ["alpha", "report"]);
}, 30_000);

test("runtime configuration and lockfile changes invalidate data stages", () => {
	const { write, run } = fixture();
	run();
	for (const path of ["services/api/config/rules.json", "pnpm-lock.yaml"]) {
		write(path, "changed");
		assert.deepEqual(run(), ["alpha", "beta", "report"], path);
	}
});

test("explicit file inputs include additions and deletions without rebuilding unrelated stages", () => {
	const { root, write, run } = fixture();
	run();
	write("scripts/templates/extra.json", "{}");
	assert.deepEqual(run(), ["alpha", "report"]);
	unlinkSync(join(root, "scripts/templates/extra.json"));
	assert.deepEqual(run(), ["alpha", "report"]);
});

test("unresolved local imports fail instead of returning a stale cache hit", () => {
	const { root, run } = fixture();
	run();
	unlinkSync(join(root, "lib/transitive.ts"));
	assert.throws(run, /Could not resolve/);
});

test("builder discovery does not execute scripts or include generated JSON", () => {
	const { root, write, stages, files } = fixture();
	write(
		"scripts/alpha.ts",
		'import data from "@/public/data/missing.json"; throw new Error(String(data));',
	);
	const inputs = stageCodeFiles(root, stages[0], files());
	assert.ok(inputs.includes("scripts/alpha.ts"));
	assert.ok(!inputs.some((path: string) => path.startsWith("public/data/")));
});

test("production builders resolve without UI code and include declared workers and compiler sources", () => {
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
			.includes("pipeline/src/compileGeometryValidity.ts"),
	);
	for (const path of [
		"pipeline/src/buildMapResource.ts",
		"pipeline/src/compileMapResource.ts",
		"pipeline/src/flatDownloads.ts",
	]) {
		assert.ok(inputs.get("map-resource")!.includes(path), path);
	}
	assert.ok(
		inputs
			.get("crosswalk-inventory")!
			.includes("pipeline/src/crosswalk-worker.ts"),
	);
	assert.ok(
		inputs.get("geometry-store")!.includes("shared/geometryValidity.ts"),
	);
	assert.ok(
		inputs
			.get("website-datasets")!
			.includes("pipeline/src/compile-boundaries.mts"),
	);
	assert.ok(
		!inputs
			.get("website-datasets")!
			.includes("scripts/profile-atlas-memory.mjs"),
	);
	assert.ok(!inputs.get("boundaries")!.includes("services/api/openapi.yaml"));
	assert.ok(inputs.get("operations")!.includes("services/api/openapi.yaml"));
	for (const path of [
		"pipeline/src/build-derived-boundaries.ts",
		"shared/areaSourceAdapters.ts",
		"shared/boundarySourcePaths.ts",
		"pipeline/package.json",
		"pipeline/tsconfig.json",
	]) {
		assert.ok(inputs.get("derived-boundaries")!.includes(path), path);
	}
	for (const [stage, compiler] of [
		["boundary-registry", "build-boundary-registry"],
		["area-inventory", "areaInventory"],
		["geography-inventory", "geographyInventory"],
	]) {
		for (const path of [
			`pipeline/src/build-${stage}.ts`,
			`pipeline/src/${compiler}.ts`,
			"shared/contentHash.ts",
			"pipeline/package.json",
			"pipeline/tsconfig.json",
		])
			assert.ok(inputs.get(stage)!.includes(path), `${stage}: ${path}`);
	}
	for (const path of [
		"shared/dbf.ts",
		"shared/geoJsonProperties.ts",
		"shared/boundarySourcePaths.ts",
		"shared/areaAdapters.ts",
		"shared/areaSourceAdapters.ts",
	]) {
		assert.ok(inputs.get("area-inventory")!.includes(path), path);
	}
	for (const path of [
		"pipeline/src/build-operations.ts",
		"pipeline/src/operationTemplates.ts",
		"shared/operations.ts",
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
		"pipeline/src/geometrySourceRegistry.ts",
		"pipeline/src/fileHashCache.ts",
		"shared/contentHash.ts",
		"pipeline/package.json",
		"pipeline/tsconfig.json",
	]) {
		assert.ok(inputs.get("geometry-source-registry")!.includes(path), path);
	}
	for (const path of [
		"pipeline/src/build-geography-catalogues.ts",
		"shared/geographyBuildPath.ts",
		"pipeline/package.json",
		"pipeline/tsconfig.json",
	]) {
		assert.ok(inputs.get("geography-catalogues")!.includes(path), path);
	}
	for (const path of [
		"pipeline/src/build-relationship-candidates.ts",
		"pipeline/src/relationshipCandidates.ts",
		"shared/crosswalkAdapters.ts",
		"shared/geography.ts",
		"pipeline/package.json",
		"pipeline/tsconfig.json",
	]) {
		assert.ok(inputs.get("relationship-candidates")!.includes(path), path);
	}
	for (const path of [
		"pipeline/src/build-relationship-paths.ts",
		"pipeline/src/relationshipPaths.ts",
		"pipeline/src/relationshipPathAdapters.ts",
		"shared/relationshipPaths.ts",
		"shared/storedText.ts",
		"pipeline/package.json",
		"pipeline/tsconfig.json",
	]) {
		assert.ok(inputs.get("relationship-paths")!.includes(path), path);
	}
	for (const path of [
		"pipeline/src/build-analysis-geographies.ts",
		"pipeline/src/analysisGeographies.ts",
		"shared/geography.ts",
		"shared/geographyBuildPath.ts",
		"pipeline/package.json",
		"pipeline/tsconfig.json",
	]) {
		assert.ok(inputs.get("analysis-geographies")!.includes(path), path);
	}
	for (const path of [
		"shared/atlasCache.ts",
		"shared/nameNormalisation.ts",
		"shared/sqliteTables.ts",
	]) {
		assert.ok(inputs.get("atlas-sqlite")!.includes(path), path);
	}
	for (const stage of ["atlas-release-initial", "atlas-release"]) {
		for (const path of [
			"pipeline/src/build-atlas-release.ts",
			"pipeline/src/atlasRelease.ts",
			"shared/atlasAssets.ts",
			"pipeline/src/fileHashCache.ts",
			"pipeline/package.json",
			"pipeline/tsconfig.json",
		]) {
			assert.ok(inputs.get(stage)!.includes(path), `${stage}: ${path}`);
		}
	}
	for (const path of [
		"pipeline/src/build-data-catalog.ts",
		"pipeline/src/catalog/compileDataCatalog.ts",
		"pipeline/src/store-observations.ts",
		"pipeline/src/atlasObservationTables.ts",
		"shared/dataCatalog.ts",
		"shared/atlasObservations.ts",
		"shared/sqliteTables.ts",
		"pipeline/package.json",
		"pipeline/tsconfig.json",
	]) {
		assert.ok(inputs.get("data-catalog")!.includes(path), path);
	}
	for (const path of [
		"pipeline/src/build-measure-compatibility.ts",
		"pipeline/src/measureCompatibility.ts",
		"shared/measureCompatibility.ts",
		"shared/observationTables.ts",
		"pipeline/package.json",
		"pipeline/tsconfig.json",
	]) {
		assert.ok(inputs.get("measure-compatibility")!.includes(path), path);
	}
	for (const path of [
		"pipeline/src/build-lookup-manifest.ts",
		"shared/lookupExports.ts",
		"pipeline/package.json",
		"pipeline/tsconfig.json",
	]) {
		assert.ok(inputs.get("lookup-manifest")!.includes(path), path);
	}
	for (const path of [
		"pipeline/src/build-export-manifest.ts",
		"pipeline/src/exportManifest.ts",
		"pipeline/src/observationDownloads.ts",
		"shared/parquet.ts",
		"pipeline/package.json",
		"pipeline/tsconfig.json",
	]) {
		assert.ok(inputs.get("export-manifest")!.includes(path), path);
	}
	for (const path of [
		"pipeline/src/build-atlas-assets.ts",
		"pipeline/package.json",
		"pipeline/tsconfig.json",
		"shared/atlasAssets.ts",
	]) {
		assert.ok(inputs.get("website-lookups")!.includes(path), path);
	}
});

test("moved pipeline builders trace imports and invalidate their own manifests", () => {
	const { write, run, stages } = fixture();
	write(
		"pipeline/src/build.ts",
		'import { value } from "./compiler"; console.log(value);',
	);
	write("pipeline/src/compiler.ts", "export const value = 1;");
	write("pipeline/package.json", "{}");
	write("pipeline/tsconfig.json", "{}");
	stages[0].args = ["--dir", "../..", "exec", "tsx", "pipeline/src/build.ts"];
	stages[0].codeInputs = ["pipeline/package.json", "pipeline/tsconfig.json"];
	assert.deepEqual(run(), ["alpha", "beta", "report"]);
	assert.deepEqual(run(), []);
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
		assert.deepEqual(run(), ["alpha", "report"], path);
		assert.deepEqual(run(), []);
	}
});

test("untraced API docs, website shared files and unrelated scripts preserve stage keys", () => {
	const { write, run } = fixture();
	run();
	for (const path of [
		"services/api/openapi.yaml",
		"shared/website.ts",
		"scripts/unrelated.ts",
		"package.json",
	]) {
		write(
			path,
			path.endsWith(".json")
				? '{"scripts":{"new":"command"}}'
				: "changed",
		);
		assert.deepEqual(run(), [], path);
	}
});
test("workspace imports trace their source without including unrelated package files", () => {
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
	run();
	write("packages/example/src/unused.ts", "export const unused = 2;");
	assert.deepEqual(run(), []);
	write("packages/example/src/index.ts", "export const value = 222;");
	assert.deepEqual(run(), ["alpha", "report"]);
});
