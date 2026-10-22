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

test("default build executes the complete pipeline in order from the API directory", (context) => {
	const build = fixture(context);
	const result = build.run([]);
	assert.equal(result.status, 0, result.stderr);
	assert.deepEqual(build.commands(), [
		["--dir", "../..", "data:download"],
		...[
			"operations",
			"datasets",
			"boundary-registry",
			"derived-boundaries",
			"area-inventory",
			"geometry-source-registry",
			"geometry-store",
			"named-locations",
			"place-index",
			"area-search-index",
			"postcode-index",
			"data-catalog",
			"measure-compatibility",
			"export-manifest",
			"postcode-areas",
			"postcode-counts",
			"crosswalk-inventory",
			"relationship-paths",
			"analysis-geographies",
			"analysis-geography-validation",
			"location-projections",
			"relationship-candidates",
			"geography-inventory",
			"terrain-catalogue",
			"lookup-manifest",
			"map-resource",
			"validation-report",
			"atlas-release",
			"documents",
			"atlas-lookups",
			"atlas-release",
		].map((name) => [`build:${name}`]),
		["build:atlas-pages"],
	]);
});

test("dataset rebuild refreshes every consumer using existing upstream artifacts", (context) => {
	const build = fixture(context);
	const result = build.run(["--from", "datasets"]);
	assert.equal(result.status, 0, result.stderr);
	const commands = build.commands().map((args) => args.join(" "));
	assert.equal(commands[0], "build:datasets");
	for (const consumer of ["named-locations", "data-catalog", "atlas-pages"])
		assert.ok(commands.includes(`build:${consumer}`), consumer);
	assert.equal(commands.at(-1), "build:atlas-pages");
	assert.ok(!commands.includes("--dir ../.. data:download"));
	assert.ok(!commands.includes("build:geometry-store"));
});

test("crosswalk rebuild follows every downstream branch without geometry, postcode, or catalogue upstream work", (context) => {
	const build = fixture(context);
	const result = build.run(["--from", "crosswalk-inventory"]);
	assert.equal(result.status, 0, result.stderr);
	assert.deepEqual(build.commands(), [
		...[
			"crosswalk-inventory",
			"relationship-paths",
			"analysis-geographies",
			"analysis-geography-validation",
			"location-projections",
			"relationship-candidates",
			"geography-inventory",
			"lookup-manifest",
			"validation-report",
			"atlas-release",
			"documents",
			"atlas-lookups",
			"atlas-release",
		].map((name) => [`build:${name}`]),
		["build:atlas-pages"],
	]);
});

test("documents rebuild pins the final manifest without rerunning the initial manifest", (context) => {
	const build = fixture(context);
	assert.equal(build.run(["--from", "documents"]).status, 0);
	assert.deepEqual(build.commands(), [
		["build:documents"],
		["build:atlas-release"],
		["build:atlas-pages"],
	]);
});

test("a plan shows the same selected stages and dependencies without executing them", (context) => {
	const build = fixture(context);
	const result = build.run(["--plan", "--from", "operations"]);
	assert.equal(result.status, 0, result.stderr);
	assert.equal(
		result.stdout,
		"operations: pnpm build:operations [depends on: none]\ndocuments: pnpm build:documents [depends on: atlas-release-initial, operations, geometry-store]\natlas-release: pnpm build:atlas-release [depends on: atlas-release-initial, documents, atlas-lookups]\natlas-pages: pnpm build:atlas-pages [depends on: atlas-release, geometry-store, datasets]\n",
	);
	assert.deepEqual(build.commands(), []);
	assert.equal(build.run(["--from", "operations"]).status, 0);
	assert.deepEqual(build.commands(), [
		["build:operations"],
		["build:documents"],
		["build:atlas-release"],
		["build:atlas-pages"],
	]);
});

test("the first failing stage returns its exit code and prevents dependent execution", (context) => {
	const build = fixture(context);
	const result = build.run(
		["--from", "crosswalk-inventory"],
		"build:relationship-paths",
	);
	assert.equal(result.status, 23);
	assert.match(
		result.stdout,
		/Stage relationship-paths failed with exit code 23/,
	);
	assert.deepEqual(build.commands(), [
		["build:crosswalk-inventory"],
		["build:relationship-paths"],
	]);
});

test("invalid CLI arguments fail before executing stages", (context) => {
	const build = fixture(context);
	for (const [argv, message] of [
		[["--from", "missing"], /Unknown stage: missing/],
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
