import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	chmodSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import test, { type TestContext } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const runner = join(root, "scripts/build-data.mjs");

function fixture(context: TestContext) {
	const directory = mkdtempSync(join(tmpdir(), "atlas-build-data-"));
	context.after(() => rmSync(directory, { recursive: true, force: true }));
	const trace = join(directory, "trace.jsonl");
	const executable = join(directory, "pnpm");
	writeFileSync(
		executable,
		`#!/usr/bin/env node
const { appendFileSync } = require("node:fs");
appendFileSync(process.env.BUILD_TRACE, JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() }) + "\\n");
process.exit(process.argv.at(-1) === process.env.BUILD_FAIL ? 23 : 0);
`,
	);
	chmodSync(executable, 0o755);
	return {
		directory,
		run(argv: string[], fail = "", script = runner) {
			return spawnSync(process.execPath, [script, ...argv], {
				cwd: directory,
				encoding: "utf8",
				env: {
					...process.env,
					PATH: `${directory}${delimiter}${process.env.PATH}`,
					BUILD_TRACE: trace,
					BUILD_FAIL: fail,
					DATA_BUILD_CACHE_DIR: join(directory, "cache"),
				},
			});
		},
		commands(): string[][] {
			try {
				return readFileSync(trace, "utf8")
					.trim()
					.split("\n")
					.map((line) => {
						const entry = JSON.parse(line);
						assert.equal(entry.cwd, resolve(root, "services/api"));
						return entry.args;
					});
			} catch (error) {
				if (
					error instanceof Error &&
					"code" in error &&
					error.code === "ENOENT"
				)
					return [];
				throw error;
			}
		},
	};
}

function stages(result: ReturnType<ReturnType<typeof fixture>["run"]>) {
	assert.equal(result.status, 0, result.stderr);
	return result.stdout
		.trim()
		.split("\n")
		.filter((line) => /^[a-z][a-z-]*: /.test(line))
		.map((line) => line.split(":")[0]);
}

const apiOrder = [
	"sources",
	"operations",
	"catalogue-registry",
	"datasets",
	"terrain-catalogue",
	"boundary-registry",
	"derived-boundaries",
	"area-inventory",
	"geometry-source-registry",
	"crosswalk-inventory",
	"geometry-store",
	"api-datasets",
	"named-locations",
	"location-projections",
	"atlas-sqlite",
	"geography-inventory",
	"relationship-paths",
	"data-catalog",
	"analysis-geographies",
	"analysis-geography-validation",
	"geography-catalogues",
	"place-index",
	"area-search-index",
	"postcode-index",
	"measure-compatibility",
	"export-manifest",
	"postcode-areas",
	"postcode-counts",
	"relationship-candidates",
	"lookup-manifest",
	"map-resource",
	"validation-report",
	"atlas-release-initial",
	"documents",
	"atlas-lookups",
	"atlas-pages",
	"website-lookups",
	"atlas-cache-stamp",
	"atlas-release",
];

test("default build executes both products in dependency order", (context) => {
	const build = fixture(context);
	assert.deepEqual(stages(build.run([])), [
		...apiOrder,
		"boundaries",
		"boundary-tiles",
		"website-tiles",
		"website-datasets",
		"website-registry",
	]);
	assert.equal(build.commands().length, apiOrder.length + 5);
});

test("rebuilding atlas pages imports SQLite assets before sealing the release and refreshing website data", (context) => {
	const build = fixture(context);
	assert.deepEqual(stages(build.run(["--from", "atlas-pages"])), [
		"atlas-pages",
		"website-lookups",
		"atlas-cache-stamp",
		"atlas-release",
		"website-datasets",
		"website-registry",
	]);
	assert.deepEqual(build.commands().at(-1), [
		"--dir",
		"../..",
		"exec",
		"tsx",
		"scripts/generate-dataset-registry.ts",
	]);
});

test("dataset rebuild refreshes consumers using existing upstream artifacts", (context) => {
	const build = fixture(context);
	const selected = stages(build.run(["--from", "datasets"]));
	assert.deepEqual(selected.slice(0, 2), ["datasets", "atlas-sqlite"]);
	for (const name of [
		"api-datasets",
		"named-locations",
		"sources",
		"geometry-store",
	])
		assert.ok(!selected.includes(name), name);
	for (const name of ["data-catalog", "atlas-pages"])
		assert.ok(selected.includes(name), name);
	assert.equal(selected.at(-1), "website-registry");
});

test("datasets build once for both products", (context) => {
	const build = fixture(context);
	const selected = stages(build.run(["--from", "datasets"]));
	assert.equal(selected[0], "datasets");
	assert.equal(selected.filter((name) => name === "datasets").length, 1);
	assert.ok(selected.includes("atlas-sqlite"));
	assert.equal(selected.at(-1), "website-registry");
});

test("crosswalk rebuild refreshes SQLite and downstream consumers", (context) => {
	const build = fixture(context);
	assert.deepEqual(stages(build.run(["--from", "crosswalk-inventory"])), [
		"crosswalk-inventory",
		"location-projections",
		"atlas-sqlite",
		"geography-inventory",
		"relationship-paths",
		"data-catalog",
		"analysis-geographies",
		"analysis-geography-validation",
		"geography-catalogues",
		"place-index",
		"area-search-index",
		"postcode-index",
		"measure-compatibility",
		"export-manifest",
		"postcode-areas",
		"postcode-counts",
		"relationship-candidates",
		"lookup-manifest",
		"validation-report",
		"atlas-release-initial",
		"documents",
		"atlas-lookups",
		"atlas-pages",
		"website-lookups",
		"atlas-cache-stamp",
		"atlas-release",
		"website-datasets",
		"website-registry",
	]);
});

test("documents rebuild pins the final manifest without rebuilding the initial manifest", (context) => {
	const build = fixture(context);
	assert.deepEqual(stages(build.run(["--from", "documents"])), [
		"documents",
		"atlas-release",
	]);
	assert.deepEqual(build.commands(), [
		[
			"--dir",
			"../..",
			"exec",
			"tsx",
			"--max-old-space-size=3072",
			"pipeline/src/build-evidence-documents.ts",
		],
		[
			"--dir",
			"../..",
			"exec",
			"tsx",
			"pipeline/src/build-atlas-release.ts",
		],
	]);
});

test("a plan selects the same stages without executing commands", (context) => {
	const build = fixture(context);
	const args = ["--from", "operations"];
	const result = build.run([...args, "--plan"]);
	assert.deepEqual(stages(result), [
		"operations",
		"documents",
		"atlas-release",
	]);
	assert.match(
		result.stdout,
		/documents: .*\[depends on: atlas-sqlite, atlas-release-initial, operations, geometry-store\]/,
	);
	assert.deepEqual(build.commands(), []);
	assert.deepEqual(stages(build.run(args)), [
		"operations",
		"documents",
		"atlas-release",
	]);
});

test("--only builds a stage and its prerequisites without unrelated or downstream work", (context) => {
	const build = fixture(context);
	assert.deepEqual(stages(build.run(["--only", "boundary-tiles"])), [
		"sources",
		"boundaries",
		"boundary-tiles",
	]);
	assert.deepEqual(build.commands(), [
		["--dir", "../..", "data:download"],
		[
			"--dir",
			"../..",
			"exec",
			"tsx",
			"pipeline/src/compile-boundaries.mts",
		],
		[
			"--dir",
			"../..",
			"exec",
			"tsx",
			"--max-old-space-size=3072",
			"pipeline/src/compile-boundary-tiles.mts",
		],
	]);
});

test("the first failing stage returns its exit code and stops the build", (context) => {
	const build = fixture(context);
	const result = build.run(
		["--from", "crosswalk-inventory"],
		"pipeline/src/build-relationship-paths.ts",
	);
	assert.equal(result.status, 23);
	assert.match(
		result.stdout,
		/Stage relationship-paths failed with exit code 23/,
	);
	assert.equal(build.commands().length, 5);
	assert.deepEqual(build.commands().at(-1), [
		"--dir",
		"../..",
		"exec",
		"tsx",
		"pipeline/src/build-relationship-paths.ts",
	]);
});

test("invalid CLI arguments fail before executing stages", (context) => {
	const build = fixture(context);
	for (const [argv, message] of [
		[["--from", "missing"], /Unknown stage: missing/],
		[["--only", "missing"], /Unknown stage: missing/],
		[["--only"], /--only requires a stage name/],
		[["--only", "--plan"], /--only requires a stage name/],
		[
			["--only", "datasets", "--from", "datasets"],
			/--only and --from cannot be combined/,
		],
		[
			["--only", "datasets", "--only", "boundaries"],
			/Unknown or repeated argument/,
		],
		[["--target", "api"], /Unknown or repeated argument: --target/],
		[["--target", "website"], /Unknown or repeated argument: --target/],
		[["--target", "all"], /Unknown or repeated argument: --target/],
		[["--target"], /Unknown or repeated argument: --target/],
		[["--from"], /--from requires a stage name/],
		[["--from", "--plan"], /--from requires a stage name/],
		[["--wat"], /Unknown or repeated argument/],
		[["--plan", "--plan"], /Unknown or repeated argument/],
		[
			["--from", "documents", "--from", "operations"],
			/Unknown or repeated argument/,
		],
	] satisfies Array<[string[], RegExp]>) {
		const result = build.run(argv);
		assert.equal(result.status, 1);
		assert.match(result.stderr, message);
	}
	assert.deepEqual(build.commands(), []);
});

test("fixture graphs sort dependencies, select downstream branches, and reject invalid graphs before execution", (context) => {
	const build = fixture(context);
	const script = join(build.directory, "fixture.mjs");
	const fixtureStage = (name: string, dependencies: string[]) => ({
		name,
		dependencies,
		args: [name],
	});
	const invoke = (
		stages: ReturnType<typeof fixtureStage>[],
		argv: string[],
	) => {
		writeFileSync(
			script,
			`import { runBuild } from ${JSON.stringify(pathToFileURL(runner).href)};
process.exitCode = runBuild({ argv: process.argv.slice(2), stages: ${JSON.stringify(stages)} });`,
		);
		return build.run(argv, "", script);
	};
	const stages = [
		fixtureStage("publish", ["left", "right"]),
		fixtureStage("left", ["source"]),
		fixtureStage("unrelated", []),
		fixtureStage("right", ["source"]),
		fixtureStage("source", []),
	];
	const result = invoke(stages, ["--from", "left"]);
	assert.equal(result.status, 0, result.stderr);
	assert.deepEqual(build.commands(), [["left"], ["publish"]]);
	const downstream = invoke(stages, ["--from", "source"]);
	assert.equal(downstream.status, 0, downstream.stderr);
	assert.deepEqual(build.commands(), [
		["left"],
		["publish"],
		["source"],
		["left"],
		["right"],
		["publish"],
	]);
	for (const [invalid, message] of [
		[
			[
				fixtureStage("first", ["second"]),
				fixtureStage("second", ["first"]),
			],
			/Dependency cycle/,
		],
		[[fixtureStage("first", ["missing"])], /Unknown dependency: missing/],
		[
			[fixtureStage("first", []), fixtureStage("first", [])],
			/Duplicate stage: first/,
		],
	] satisfies Array<[ReturnType<typeof fixtureStage>[], RegExp]>) {
		const failure = invoke(invalid, ["--plan"]);
		assert.equal(failure.status, 1);
		assert.match(failure.stderr, message);
	}
	assert.deepEqual(build.commands(), [
		["left"],
		["publish"],
		["source"],
		["left"],
		["right"],
		["publish"],
	]);
});
