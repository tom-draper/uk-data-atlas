import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	unlinkSync,
	utimesSync,
	writeFileSync,
	readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { onTestFinished, test, vi } from "vitest";
import { createStageCache } from "@/pipeline/build-data-cache.mjs";
import { runBuild } from "@/pipeline/build-data.mjs";
import { buildDataStages } from "@/pipeline/build-data-graph.mjs";

const sha256 = (path: string) =>
	createHash("sha256").update(readFileSync(path)).digest("hex");

type Stage = {
	name: string;
	dependencies: string[];
	args: string[];
	cacheable?: boolean;
	outputs?: string[];
};

const stage = (
	name: string,
	dependencies: string[] = [],
	cacheable = true,
	outputs: string[] = [],
): Stage => ({ name, dependencies, args: [name], cacheable, outputs });

// download feeds data/; compile and summary write outputs; report reads compile.
const stages = [
	stage("download", [], false),
	stage("compile", ["download"], true, ["data/build/datasets"]),
	stage("summary", ["download"]),
	stage("report", ["compile"]),
];

let writes = 0;

function fixture() {
	const root = mkdtempSync(join(tmpdir(), "atlas-build-cache-"));
	onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	const write = (path: string, content: string) => {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), content);
	};
	write("data/source/input.csv", "a,b\n");
	write("code.ts", "export {};\n");
	const outputs: Record<string, string> = {
		compile: "data/build/datasets/compiled.json",
		summary: "data/build/artifacts/summary.json",
		report: "public/data/report.json",
	};
	const ran: string[] = [];
	const hashed: string[] = [];
	// Stages listed here always write the same bytes.
	const fixed: Record<string, string> = {};
	const failing = new Set<string>();
	const build = async (argv: string[] = []) => {
		const log: string[] = [];
		const errors: string[] = [];
		const status = await runBuild({
			argv,
			stages,
			log: (line: string) => log.push(line),
			logError: (message: string) => errors.push(message),
			createCache: () =>
				createStageCache({
					root,
					stateFile: join(root, ".cache/stages.json"),
					codeFiles: () => ["code.ts"],
					environment: {},
					hashFile: (path: string) => {
						hashed.push(relative(root, path));
						return sha256(path);
					},
				}),
			execute: (current: Stage) => {
				ran.push(current.name);
				if (failing.has(current.name)) return 1;
				const output = outputs[current.name];
				if (output)
					write(
						output,
						fixed[current.name] ??
							`${current.name} ${(writes += 1)}\n`,
					);
				return 0;
			},
		});
		return { status, log, errors };
	};
	const runs = async (argv: string[] = []) => {
		ran.length = 0;
		const result = await build(argv);
		assert.equal(result.status, 0);
		return [...ran];
	};
	return { root, write, runs, build, ran, hashed, fixed, failing, outputs };
}

test("a second build reruns only the stages that always run", async () => {
	const { runs } = fixture();
	assert.deepEqual(await runs(), [
		"download",
		"compile",
		"summary",
		"report",
	]);
	assert.deepEqual(await runs(), ["download"]);
});

test("--only builds prerequisites on a clean run and reuses their cached outputs", async () => {
	const { runs } = fixture();
	assert.deepEqual(await runs(["--only", "report"]), [
		"download",
		"compile",
		"report",
	]);
	assert.deepEqual(await runs(["--only", "report"]), ["download"]);
	assert.deepEqual(await runs(["--only", "report", "--no-cache"]), [
		"download",
		"compile",
		"report",
	]);
});

test("changed data or code reruns every cached stage", async () => {
	const { runs, write } = fixture();
	await runs();
	write("data/source/input.csv", "a,b,c\n");
	assert.deepEqual(await runs(), [
		"download",
		"compile",
		"summary",
		"report",
	]);
	write("code.ts", "export const changed = true;\n");
	assert.deepEqual(await runs(), [
		"download",
		"compile",
		"summary",
		"report",
	]);
	// The download marker records the release, not the data itself.
	write("data/source/.source-release.json", "{}\n");
	assert.deepEqual(await runs(), ["download"]);
});

test("stages with declared raw inputs ignore unrelated source changes", async () => {
	const { root, write } = fixture();
	const cache = () =>
		createStageCache({
			root,
			codeFiles: () => ["code.ts"],
			environment: {},
		});
	const boundary = { name: "boundary", args: [], rawInputs: ["boundaries"] };
	write("data/source/boundaries/meta.json", "first");
	let current = cache();
	current.begin(boundary.name);
	current.record(boundary, []);
	write("data/source/input.csv", "unrelated change");
	current = cache();
	assert.notEqual(current.lookup(boundary, []), null);
	write("data/source/boundaries/meta.json", "changed boundary");
	current = cache();
	assert.equal(current.lookup(boundary, []), null);
});

test("a declared raw file invalidates its stage when changed or removed", async () => {
	const { root, write } = fixture();
	const cache = () =>
		createStageCache({
			root,
			codeFiles: () => ["code.ts"],
			environment: {},
		});
	const source = { name: "source", args: [], rawInputs: ["input.csv"] };
	let current = cache();
	current.begin(source.name);
	current.record(source, []);
	write("data/source/input.csv", "changed input");
	current = cache();
	assert.equal(current.lookup(source, []), null);
	current.begin(source.name);
	current.record(source, []);
	unlinkSync(join(root, "data/source/input.csv"));
	current = cache();
	assert.equal(current.lookup(source, []), null);
});

test("crosswalk inputs follow the adapter configuration", async () => {
	const { root, write } = fixture();
	write(
		"services/api/config/crosswalk-adapters.json",
		JSON.stringify({
			crosswalks: [
				{ input: "lookups/a.csv" },
				{ population: { input: "demographics/population.csv" } },
			],
		}),
	);
	write("data/source/lookups/a.csv", "lookup");
	write("data/source/demographics/population.csv", "population");
	const stage = buildDataStages.find(
		(entry) => entry.name === "crosswalk-inventory",
	)!;
	const cache = () =>
		createStageCache({
			root,
			codeFiles: () => ["code.ts"],
			environment: {},
		});
	let current = cache();
	current.begin(stage.name);
	current.record(stage, []);
	write("data/source/input.csv", "unrelated dataset");
	current = cache();
	assert.notEqual(current.lookup(stage, []), null);
	write("data/source/demographics/population.csv", "changed population");
	current = cache();
	assert.equal(current.lookup(stage, []), null);
});

test("geography inventory tracks metadata additions, changes and removals", async () => {
	const { root, write } = fixture();
	const stage = buildDataStages.find(
		(entry) => entry.name === "geography-inventory",
	)!;
	const cache = () =>
		createStageCache({
			root,
			codeFiles: () => ["code.ts"],
			environment: {},
		});
	write("data/source/example/meta.json", "first metadata");
	let current = cache();
	current.begin(stage.name);
	current.record(stage, []);
	write("data/source/input.csv", "changed data file");
	current = cache();
	assert.notEqual(current.lookup(stage, []), null);
	write("data/source/new/meta.json", "new metadata");
	current = cache();
	assert.equal(current.lookup(stage, []), null);
	current.begin(stage.name);
	current.record(stage, []);
	write("data/source/example/meta.json", "changed metadata");
	current = cache();
	assert.equal(current.lookup(stage, []), null);
	current.begin(stage.name);
	current.record(stage, []);
	unlinkSync(join(root, "data/source/new/meta.json"));
	current = cache();
	assert.equal(current.lookup(stage, []), null);
});

test("boundary registry ignores boundary geometry but tracks release metadata", async () => {
	const { root, write } = fixture();
	const entry = buildDataStages.find(
		(stage) => stage.name === "boundary-registry",
	)!;
	const stage = { ...entry, outputs: [], requiredOutputs: [] };
	write("data/source/boundaries/ward/2024/meta.json", "metadata");
	write("data/source/boundaries/ward/2024/geometry.geojson", "geometry");
	const cache = () =>
		createStageCache({
			root,
			codeFiles: () => ["code.ts"],
			environment: {},
		});
	let current = cache();
	current.begin(stage.name);
	current.record(stage, []);
	write(
		"data/source/boundaries/ward/2024/geometry.geojson",
		"changed geometry",
	);
	current = cache();
	assert.notEqual(current.lookup(stage, []), null);
	write("data/source/boundaries/ward/2025/meta.json", "new metadata");
	current = cache();
	assert.equal(current.lookup(stage, []), null);
	current.begin(stage.name);
	current.record(stage, []);
	write("data/source/boundaries/ward/2024/meta.json", "changed metadata");
	current = cache();
	assert.equal(current.lookup(stage, []), null);
});

test("derived boundaries track only the configured source release", async () => {
	const { root, write } = fixture();
	const entry = buildDataStages.find(
		(stage) => stage.name === "derived-boundaries",
	)!;
	const stage = { ...entry, outputs: [], requiredOutputs: [] };
	write(
		"services/api/config/area-source-adapters.json",
		JSON.stringify({
			releases: {
				"ward/example": {
					source: { geography: "ward", boundaryRelease: "current" },
				},
			},
		}),
	);
	write(
		"data/source/boundaries/ward/current/meta.json",
		JSON.stringify({
			files: [{ role: "source", path: "geometry.geojson" }],
		}),
	);
	write("data/source/boundaries/ward/current/geometry.geojson", "geometry");
	write(
		"data/source/boundaries/ward/other/geometry.geojson",
		"other geometry",
	);
	const cache = () =>
		createStageCache({
			root,
			codeFiles: () => ["code.ts"],
			environment: {},
		});
	let current = cache();
	current.begin(stage.name);
	current.record(stage, []);
	write(
		"data/source/boundaries/ward/other/geometry.geojson",
		"changed other geometry",
	);
	current = cache();
	assert.notEqual(current.lookup(stage, []), null);
	write(
		"data/source/boundaries/ward/current/geometry.geojson",
		"changed geometry",
	);
	current = cache();
	assert.equal(current.lookup(stage, []), null);
});

test("area inventory tracks declared attributes, not unrelated boundary files", async () => {
	const { root, write } = fixture();
	const entry = buildDataStages.find(
		(stage) => stage.name === "area-inventory",
	)!;
	const stage = { ...entry, outputs: [], requiredOutputs: [] };
	write(
		"data/source/boundaries/ward/current/meta.json",
		JSON.stringify({ files: [{ role: "source", path: "geometry.shp" }] }),
	);
	write("data/source/boundaries/ward/current/geometry.dbf", "attributes");
	write("data/source/boundaries/ward/current/geometry.shp", "geometry");
	const cache = () =>
		createStageCache({
			root,
			codeFiles: () => ["code.ts"],
			environment: {},
		});
	let current = cache();
	current.begin(stage.name);
	current.record(stage, []);
	write(
		"data/source/boundaries/ward/current/geometry.shp",
		"changed geometry",
	);
	current = cache();
	assert.notEqual(current.lookup(stage, []), null);
	write(
		"data/source/boundaries/ward/current/geometry.dbf",
		"changed attributes",
	);
	current = cache();
	assert.equal(current.lookup(stage, []), null);
});

test("relationship candidates track declared attributes, not shapefile geometry", async () => {
	const { root, write } = fixture();
	const entry = buildDataStages.find(
		(stage) => stage.name === "relationship-candidates",
	)!;
	const stage = { ...entry, outputs: [], requiredOutputs: [] };
	write(
		"data/source/boundaries/ward/current/meta.json",
		JSON.stringify({ files: [{ role: "source", path: "geometry.shp" }] }),
	);
	write("data/source/boundaries/ward/current/geometry.shp", "geometry");
	write("data/source/boundaries/ward/current/geometry.dbf", "attributes");
	const cache = () =>
		createStageCache({
			root,
			codeFiles: () => ["code.ts"],
			environment: {},
		});
	let current = cache();
	current.begin(stage.name);
	current.record(stage, []);
	write(
		"data/source/boundaries/ward/current/geometry.shp",
		"changed geometry",
	);
	current = cache();
	assert.notEqual(current.lookup(stage, []), null);
	write(
		"data/source/boundaries/ward/current/geometry.dbf",
		"changed attributes",
	);
	current = cache();
	assert.equal(current.lookup(stage, []), null);
});

test("documents and atlas pages track boundary offsets, not raw geometry", async () => {
	const { root, write } = fixture();
	const stages = buildDataStages
		.filter((stage) => ["documents", "atlas-pages"].includes(stage.name))
		.map((stage) => ({ ...stage, outputs: [], requiredOutputs: [] }));
	assert.equal(stages.length, 2);
	write("data/source/boundaries/ward/current/geometry.geojson", "geometry");
	write("data/source/boundaries/offset.json", "offset");
	const cache = () =>
		createStageCache({
			root,
			codeFiles: () => ["code.ts"],
			environment: {},
		});
	let current = cache();
	for (const stage of stages) {
		current.begin(stage.name);
		current.record(stage, []);
	}
	write(
		"data/source/boundaries/ward/current/geometry.geojson",
		"changed geometry",
	);
	current = cache();
	for (const stage of stages)
		assert.notEqual(current.lookup(stage, []), null);
	write("data/source/boundaries/offset.json", "changed offset");
	current = cache();
	for (const stage of stages) assert.equal(current.lookup(stage, []), null);
});

test("census stages ignore unrelated files within census tables", async () => {
	const { root, write } = fixture();
	const stages = buildDataStages
		.filter((stage) =>
			["atlas-sqlite", "data-catalog"].includes(stage.name),
		)
		.map((stage) => ({ ...stage, outputs: [], requiredOutputs: [] }));
	assert.equal(stages.length, 2);
	const directory = "data/source/demographics/census-2021-small-area/ts001";
	write(`${directory}/meta.json`, "metadata");
	write(`${directory}/census2021-ts001-lsoa.csv`, "census");
	write(`${directory}/notes.txt`, "notes");
	const cache = () =>
		createStageCache({
			root,
			codeFiles: () => ["code.ts"],
			environment: {},
		});
	let current = cache();
	for (const stage of stages) {
		current.begin(stage.name);
		current.record(stage, []);
	}
	write(`${directory}/notes.txt`, "changed notes");
	current = cache();
	for (const stage of stages)
		assert.notEqual(current.lookup(stage, []), null);
	write(`${directory}/census2021-ts001-msoa.csv`, "new census");
	current = cache();
	for (const stage of stages) assert.equal(current.lookup(stage, []), null);
});

test("named locations track county shapes and their attributes", async () => {
	const { root, write } = fixture();
	const entry = buildDataStages.find(
		(stage) => stage.name === "named-locations",
	)!;
	const stage = { ...entry, outputs: [], requiredOutputs: [] };
	const base =
		"data/source/geography/ceremonial-counties/source/Boundary-line-ceremonial-counties_region";
	write(`${base}.shp`, "shape");
	write(`${base}.dbf`, "attributes");
	write(`${base}.prj`, "projection");
	const cache = () =>
		createStageCache({
			root,
			codeFiles: () => ["code.ts"],
			environment: {},
		});
	let current = cache();
	current.begin(stage.name);
	current.record(stage, []);
	write(`${base}.prj`, "changed projection");
	current = cache();
	assert.notEqual(current.lookup(stage, []), null);
	write(`${base}.dbf`, "changed attributes");
	current = cache();
	assert.equal(current.lookup(stage, []), null);
});

test("website boundary stages track geometry, topology and offsets, not archives", async () => {
	const { root, write } = fixture();
	const stages = buildDataStages
		.filter((stage) =>
			["boundaries", "boundary-tiles"].includes(stage.name),
		)
		.map((stage) => ({ ...stage, outputs: [], requiredOutputs: [] }));
	assert.equal(stages.length, 2);
	write(
		"data/source/boundaries/ward/current/meta.json",
		JSON.stringify({
			files: [{ role: "derived", path: "geometry.geojson" }],
		}),
	);
	write("data/source/boundaries/ward/current/geometry.geojson", "geometry");
	write("data/source/boundaries/ward/current/archive.zip", "archive");
	const cache = () =>
		createStageCache({
			root,
			codeFiles: () => ["code.ts"],
			environment: {},
		});
	let current = cache();
	for (const stage of stages) {
		current.begin(stage.name);
		current.record(stage, []);
	}
	const stale = () => {
		current = cache();
		return stages.filter((stage) => current.lookup(stage, []) === null)
			.length;
	};
	write("data/source/boundaries/ward/current/archive.zip", "changed archive");
	assert.equal(stale(), 0);
	write(
		"data/source/boundaries/ward/current/geometry.geojson",
		"changed geometry",
	);
	assert.equal(stale(), 2);
	for (const stage of stages) {
		current.begin(stage.name);
		current.record(stage, []);
	}
	write(
		"data/source/boundaries/ward/current/boundaries.topojson",
		"topology",
	);
	assert.equal(stale(), 2);
	for (const stage of stages) {
		current.begin(stage.name);
		current.record(stage, []);
	}
	write("data/source/boundaries/offset.json", "offset");
	assert.equal(stale(), 2);
});

test("postcode areas and validation report rely on compiled dependencies", async () => {
	const { root, write } = fixture();
	const stages = buildDataStages
		.filter((stage) =>
			["postcode-areas", "validation-report"].includes(stage.name),
		)
		.map((stage) => ({ ...stage, outputs: [], requiredOutputs: [] }));
	assert.equal(stages.length, 2);
	write("data/source/boundaries/ward/current/meta.json", "boundary metadata");
	const cache = () =>
		createStageCache({
			root,
			codeFiles: () => ["code.ts"],
			environment: {},
		});
	let current = cache();
	for (const stage of stages) {
		current.begin(stage.name);
		current.record(stage, []);
	}
	write(
		"data/source/boundaries/ward/current/meta.json",
		"changed boundary metadata",
	);
	current = cache();
	for (const stage of stages)
		assert.notEqual(current.lookup(stage, []), null);
});

test("geometry store tracks registered geometry, attributes and offsets", async () => {
	const { root, write } = fixture();
	const entry = buildDataStages.find(
		(stage) => stage.name === "geometry-store",
	)!;
	const stage = { ...entry, outputs: [], requiredOutputs: [] };
	write(
		"data/build/artifacts/geometry-sources.json",
		JSON.stringify({
			schemaVersion: 1,
			releases: [
				{
					status: "available",
					input: "boundaries/ward/current/geometry.shp",
				},
			],
		}),
	);
	write("data/source/boundaries/ward/current/geometry.shp", "geometry");
	write("data/source/boundaries/ward/current/geometry.dbf", "attributes");
	write("data/source/boundaries/other/archive.zip", "archive");
	const cache = () =>
		createStageCache({
			root,
			codeFiles: () => ["code.ts"],
			environment: {},
		});
	let current = cache();
	current.begin(stage.name);
	current.record(stage, []);
	write("data/source/boundaries/other/archive.zip", "changed archive");
	current = cache();
	assert.notEqual(current.lookup(stage, []), null);
	write(
		"data/source/boundaries/ward/current/geometry.dbf",
		"changed attributes",
	);
	current = cache();
	assert.equal(current.lookup(stage, []), null);
	current.begin(stage.name);
	current.record(stage, []);
	write("data/source/boundaries/offset.json", "offset");
	current = cache();
	assert.equal(current.lookup(stage, []), null);
});

test("geometry source registry tracks declared geometry and projections", async () => {
	const { root, write } = fixture();
	const entry = buildDataStages.find(
		(stage) => stage.name === "geometry-source-registry",
	)!;
	const stage = { ...entry, outputs: [], requiredOutputs: [] };
	write(
		"data/source/boundaries/ward/current/meta.json",
		JSON.stringify({ files: [{ role: "source", path: "geometry.shp" }] }),
	);
	write("data/source/boundaries/ward/current/geometry.shp", "geometry");
	write("data/source/boundaries/ward/current/geometry.dbf", "attributes");
	const cache = () =>
		createStageCache({
			root,
			codeFiles: () => ["code.ts"],
			environment: {},
		});
	let current = cache();
	current.begin(stage.name);
	current.record(stage, []);
	write(
		"data/source/boundaries/ward/current/geometry.dbf",
		"changed attributes",
	);
	current = cache();
	assert.notEqual(current.lookup(stage, []), null);
	write("data/source/boundaries/ward/current/geometry.prj", "projection");
	current = cache();
	assert.equal(current.lookup(stage, []), null);
	current.begin(stage.name);
	current.record(stage, []);
	write(
		"data/source/boundaries/ward/current/geometry.shp",
		"changed geometry",
	);
	current = cache();
	assert.equal(current.lookup(stage, []), null);
});

test("postcode index tracks the selected edition, not older editions", async () => {
	const { root, write } = fixture();
	const entry = buildDataStages.find(
		(stage) => stage.name === "postcode-index",
	)!;
	const stage = { ...entry, outputs: [], requiredOutputs: [] };
	const metadata = JSON.stringify({
		files: [{ role: "source", path: "source.csv" }],
	});
	write("data/source/postcodes/onspd/2024/meta.json", metadata);
	write("data/source/postcodes/onspd/2024/source.csv", "old");
	write("data/source/postcodes/onspd/2025/meta.json", metadata);
	write("data/source/postcodes/onspd/2025/source.csv", "current");
	const cache = () =>
		createStageCache({
			root,
			codeFiles: () => ["code.ts"],
			environment: {},
		});
	let current = cache();
	current.begin(stage.name);
	current.record(stage, []);
	write("data/source/postcodes/onspd/2024/source.csv", "changed old edition");
	current = cache();
	assert.notEqual(current.lookup(stage, []), null);
	write("data/source/postcodes/onspd/2026/meta.json", metadata);
	write("data/source/postcodes/onspd/2026/source.csv", "new edition");
	current = cache();
	assert.equal(current.lookup(stage, []), null);
	current.begin(stage.name);
	current.record(stage, []);
	write(
		"data/source/postcodes/onspd/2026/source.csv",
		"updated current source",
	);
	current = cache();
	assert.equal(current.lookup(stage, []), null);
	current.begin(stage.name);
	current.record(stage, []);
	unlinkSync(join(root, "data/source/postcodes/onspd/2026/meta.json"));
	current = cache();
	assert.equal(current.lookup(stage, []), null);
});

test("dataset stage keys only tracked sources and missing inputs", async () => {
	const { root, write } = fixture();
	const entry = buildDataStages.find((stage) => stage.name === "datasets")!;
	const stage = { ...entry, outputs: [], requiredOutputs: [] };
	write("data/source/survey/workbook.xlsx", "workbook");
	write(
		"data/build/datasets/dataset-manifest.json",
		JSON.stringify({
			datasets: [
				{
					inputTrackingVersion: 1,
					inputs: [
						{
							kind: "xlsxSheet",
							path: "survey/workbook.xlsx#Sheet1",
						},
					],
					missingSource: "survey/missing.csv",
				},
			],
		}),
	);
	const cache = () =>
		createStageCache({
			root,
			codeFiles: () => ["code.ts"],
			environment: {},
		});
	let current = cache();
	current.begin(stage.name);
	current.record(stage, []);
	write("data/source/input.csv", "unrelated dataset input");
	current = cache();
	assert.notEqual(current.lookup(stage, []), null);
	write("data/source/survey/missing.csv", "restored");
	current = cache();
	assert.equal(current.lookup(stage, []), null);
	current.begin(stage.name);
	current.record(stage, []);
	write("data/source/survey/workbook.xlsx", "changed workbook");
	current = cache();
	assert.equal(current.lookup(stage, []), null);
});

test("dataset stage conservatively keys all sources for legacy manifests", async () => {
	const { root, write } = fixture();
	const entry = buildDataStages.find((stage) => stage.name === "datasets")!;
	const stage = { ...entry, outputs: [], requiredOutputs: [] };
	write(
		"data/build/datasets/dataset-manifest.json",
		JSON.stringify({ datasets: [{ inputs: [] }] }),
	);
	const cache = () =>
		createStageCache({
			root,
			codeFiles: () => ["code.ts"],
			environment: {},
		});
	let current = cache();
	current.begin(stage.name);
	current.record(stage, []);
	write("data/source/input.csv", "changed before migration");
	current = cache();
	assert.equal(current.lookup(stage, []), null);
});

test("website dataset key tracks declared file presence without hashing its contents", async () => {
	const { root, write } = fixture();
	const entry = buildDataStages.find(
		(stage) => stage.name === "website-datasets",
	)!;
	const stage = { ...entry, outputs: [], requiredOutputs: [] };
	write(
		"data/source/survey/meta.json",
		JSON.stringify({ files: [{ path: "survey.csv" }] }),
	);
	write("data/source/survey/survey.csv", "survey data");
	const cache = () =>
		createStageCache({
			root,
			codeFiles: () => ["code.ts"],
			environment: {},
		});
	let current = cache();
	current.begin(stage.name);
	current.record(stage, []);
	write("data/source/survey/survey.csv", "changed survey data");
	current = cache();
	assert.notEqual(current.lookup(stage, []), null);
	unlinkSync(join(root, "data/source/survey/survey.csv"));
	current = cache();
	assert.equal(current.lookup(stage, []), null);
	current.begin(stage.name);
	current.record(stage, []);
	write("data/source/survey/survey.csv", "restored");
	current = cache();
	assert.equal(current.lookup(stage, []), null);
	current.begin(stage.name);
	current.record(stage, []);
	write(
		"data/source/transport/road-safety/dft-road-casualty-statistics-collision-provisional-2025.csv",
		"road safety",
	);
	current = cache();
	assert.equal(current.lookup(stage, []), null);
	current.begin(stage.name);
	current.record(stage, []);
	write("data/source/lookups/places/source.csv", "new lookup");
	current = cache();
	assert.notEqual(current.lookup(stage, []), null);
	write(
		"data/source/lookups/local-authority-to-region/2025-04-en/LAD25_RGN25_EN_LU_v2.geojson",
		"gazetteer lookup",
	);
	current = cache();
	assert.equal(current.lookup(stage, []), null);
});

test("dataset updates leave boundary tiles and postcodes cached", async () => {
	const { root, write } = fixture();
	write(
		"data/source/boundaries/ward/current/meta.json",
		JSON.stringify({ files: [] }),
	);
	write("data/source/postcodes/onspd/latest/meta.json", "postcode");
	const names = [
		"boundaries",
		"boundary-tiles",
		"website-tiles",
		"postcode-index",
	];
	const selected = buildDataStages
		.filter((entry) => names.includes(entry.name))
		.map((entry) => ({
			...entry,
			dependencies: entry.dependencies.filter((name: string) =>
				names.includes(name),
			),
			outputs: [],
			requiredOutputs: [],
			writes: [],
		}));
	const run = async () => {
		const ran: string[] = [];
		assert.equal(
			await runBuild({
				stages: selected,
				log: () => {},
				logError: () => {},
				createCache: () =>
					createStageCache({
						root,
						codeFiles: () => ["code.ts"],
						environment: {},
					}),
				execute: (entry: Stage) => {
					ran.push(entry.name);
					write(
						`data/build/${entry.name}.json`,
						`${entry.name} ${(writes += 1)}`,
					);
					return 0;
				},
			}),
			0,
		);
		return ran;
	};
	assert.deepEqual(await run(), [
		"postcode-index",
		"boundaries",
		"boundary-tiles",
		"website-tiles",
	]);
	write("data/source/input.csv", "updated dataset");
	assert.deepEqual(await run(), []);
	write(
		"data/source/boundaries/ward/current/meta.json",
		JSON.stringify({ files: [], updated: true }),
	);
	assert.deepEqual(await run(), [
		"boundaries",
		"boundary-tiles",
		"website-tiles",
	]);
	write("data/source/postcodes/onspd/latest/meta.json", "updated postcode");
	assert.deepEqual(await run(), ["postcode-index"]);
});

test("area, map and atlas stages track their own raw sources", async () => {
	const { root, write } = fixture();
	write(
		"data/source/boundaries/ward/current/meta.json",
		JSON.stringify({ files: [] }),
	);
	write(
		"data/source/lookups/local-authority-to-region/2025-04-en/LAD25_RGN25_EN_LU_v2.geojson",
		"lookup",
	);
	write(
		"data/source/demographics/census-2021-small-area/ts001/census2021-ts001-lsoa.csv",
		"census",
	);
	const stages = buildDataStages
		.filter((entry) =>
			[
				"area-inventory",
				"map-resource",
				"atlas-sqlite",
				"api-datasets",
			].includes(entry.name),
		)
		.map((entry) => ({ ...entry, outputs: [], requiredOutputs: [] }));
	const cache = () =>
		createStageCache({
			root,
			codeFiles: () => ["code.ts"],
			environment: {},
		});
	let current = cache();
	for (const entry of stages) {
		current.begin(entry.name);
		current.record(entry, []);
	}
	const stale = () => {
		current = cache();
		return stages
			.filter((entry) => current.lookup(entry, []) === null)
			.map((entry) => entry.name);
	};
	write("data/source/input.csv", "different dataset");
	assert.deepEqual(stale(), []);
	write(
		"data/source/demographics/census-2021-small-area/ts001/census2021-ts001-lsoa.csv",
		"updated census",
	);
	assert.deepEqual(stale(), ["atlas-sqlite"]);
	write(
		"data/source/lookups/local-authority-to-region/2025-04-en/LAD25_RGN25_EN_LU_v2.geojson",
		"updated lookup",
	);
	assert.deepEqual(stale(), ["atlas-sqlite", "api-datasets"]);
	write(
		"data/source/boundaries/ward/current/meta.json",
		JSON.stringify({ files: [], updated: true }),
	);
	assert.deepEqual(stale(), [
		"atlas-sqlite",
		"api-datasets",
		"area-inventory",
		"map-resource",
	]);
});

test("a missing or edited output reruns its stage and the stages that read it", async () => {
	const { runs, root, write, outputs } = fixture();
	await runs();
	unlinkSync(join(root, outputs.compile));
	assert.deepEqual(await runs(), ["download", "compile", "report"]);
	write(outputs.report, "edited\n");
	assert.deepEqual(await runs(), ["download", "report"]);
	assert.deepEqual(await runs(), ["download"]);
});

test("a failed stage is rebuilt next time even if its outputs look unchanged", async () => {
	const { runs, build, failing, ran } = fixture();
	await runs();
	failing.add("compile");
	ran.length = 0;
	const result = await build(["--from", "compile"]);
	assert.equal(result.status, 1);
	failing.clear();
	assert.deepEqual(await runs(), ["download", "compile", "report"]);
});

test("--no-cache and --from run every selected stage", async () => {
	const { runs } = fixture();
	await runs();
	assert.deepEqual(await runs(["--no-cache"]), [
		"download",
		"compile",
		"summary",
		"report",
	]);
	assert.deepEqual(await runs(["--from", "compile"]), ["compile", "report"]);
	// Both refresh the cache for the next build.
	assert.deepEqual(await runs(), ["download"]);
});

test("a plan marks the stages it would skip", async () => {
	const { runs, root, outputs, build, ran } = fixture();
	await runs();
	unlinkSync(join(root, outputs.compile));
	ran.length = 0;
	const { log } = await build(["--plan"]);
	assert.deepEqual(ran, []);
	assert.equal(
		log.some((line) => line.startsWith("Data build done")),
		false,
	);
	assert.equal(log[0], "Data build plan: 4 stages, 3 to run, 1 unchanged");
	assert.deepEqual(
		log
			.filter((line) => /^[a-z]/.test(line) && !line.startsWith("Data"))
			.map((line) =>
				line.replace(/ \(last run [^)]+\)$/, "").split(": "),
			),
		[
			["download", "would run"],
			["compile", "would run"],
			["summary", "unchanged, would skip"],
			["report", "would run"],
		],
	);
	assert.ok(log.includes("  Depends on: compile"));
	assert.ok(log.some((line) => line.startsWith("Estimated total:")));
	assert.equal(existsSync(join(root, outputs.compile)), false);
});

test("a stage owns the files in its declared folders, even ones it kept", async () => {
	const { runs, root, write } = fixture();
	write("data/build/datasets/kept.json", "from an earlier build\n");
	await runs();
	// compile does not rewrite kept.json, but it is still compile's.
	unlinkSync(join(root, "data/build/datasets/kept.json"));
	assert.deepEqual(await runs(), ["download", "compile", "report"]);
});

test("a later writer can update a shared database while its builder still rebuilds a missing file", async () => {
	const root = mkdtempSync(join(tmpdir(), "atlas-shared-build-"));
	onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	mkdirSync(join(root, "data/build"), { recursive: true });
	const path = join(root, "data/build/atlas.sqlite");
	const sharedStages = [
		{
			name: "base",
			dependencies: [],
			args: [],
			requiredOutputs: ["data/build/atlas.sqlite"],
		},
		{ name: "final", dependencies: ["base"], args: [] },
	];
	const run = async () => {
		const executed: string[] = [];
		assert.equal(
			await runBuild({
				stages: sharedStages,
				log: () => {},
				createCache: () =>
					createStageCache({
						root,
						stateFile: join(root, ".cache/stages.json"),
						codeFiles: () => [],
						environment: {},
					}),
				execute: (current: { name: string }) => {
					executed.push(current.name);
					writeFileSync(path, current.name);
					return 0;
				},
			}),
			0,
		);
		return executed;
	};
	assert.deepEqual(await run(), ["base", "final"]);
	assert.deepEqual(await run(), []);
	unlinkSync(path);
	assert.deepEqual(await run(), ["base", "final"]);
	assert.deepEqual(await run(), []);
});

test("a build prints a line for each stage and ranks the slowest", async () => {
	let now = 0;
	const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
	onTestFinished(() => clock.mockRestore());
	const log: string[] = [];
	const status = await runBuild({
		stages: Array.from({ length: 6 }, (_, index) =>
			stage(`stage-${index + 1}`),
		),
		execute: (stage: Stage) => {
			now += Number(stage.name.slice(-1)) * 1000;
			return 0;
		},
		log: (line: string) => {
			log.push(line);
			if (line.includes(": running")) now += 500;
		},
	});
	assert.equal(status, 0);
	assert.deepEqual(log, [
		"Data build: 6 stages, 6 to run, 0 unchanged",
		"",
		"stage-1: running (1 of 6)",
		"stage-1: done in 1.5s",
		"stage-2: running (2 of 6)",
		"stage-2: done in 2.5s",
		"stage-3: running (3 of 6)",
		"stage-3: done in 3.5s",
		"stage-4: running (4 of 6)",
		"stage-4: done in 4.5s",
		"stage-5: running (5 of 6)",
		"stage-5: done in 5.5s",
		"stage-6: running (6 of 6)",
		"stage-6: done in 6.5s",
		"",
		"Data build done in 24s (6 ran, 0 unchanged)",
		"Slowest stages:",
		"  stage-6  6.5s",
		"  stage-5  5.5s",
		"  stage-4  4.5s",
		"  stage-3  3.5s",
		"  stage-2  2.5s",
	]);
});

test("a verbose build adds each command and the command and overhead split", async () => {
	let now = 0;
	const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
	onTestFinished(() => clock.mockRestore());
	const log: string[] = [];
	let verbose: boolean | undefined;
	await runBuild({
		argv: ["--verbose"],
		stages: [stage("first")],
		execute: (_stage: Stage, options: { verbose: boolean }) => {
			verbose = options.verbose;
			now += 2000;
			return 0;
		},
		log: (line: string) => {
			log.push(line);
			if (line.includes(": running")) now += 500;
		},
	});
	assert.equal(verbose, true);
	assert.deepEqual(log.slice(2, 5), [
		"first: running (1 of 1)",
		"  Command: pnpm first",
		"  Depends on: none",
	]);
	assert.equal(log.at(-1), "  first  2.5s (command 2.0s, overhead 0.5s)");
});

test("a failed stage reports its exit status on stderr and still prints the summary", async () => {
	let now = 0;
	const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
	onTestFinished(() => clock.mockRestore());
	const log: string[] = [];
	const errors: string[] = [];
	const status = await runBuild({
		stages: [stage("failing"), stage("unreached")],
		execute: () => {
			now += 1250;
			return 2;
		},
		log: (line: string) => log.push(line),
		logError: (message: string) => errors.push(message),
	});
	assert.equal(status, 2);
	assert.deepEqual(errors, [
		"failing failed with exit code 2 after 1.3s. Build stopped",
	]);
	assert.deepEqual(log.slice(2), [
		"failing: running (1 of 2)",
		"",
		"Data build failed after 1.3s (0 ran, 1 failed, 0 unchanged)",
		"Slowest stages:",
		"  failing  1.3s",
	]);
});

test("a rebuild says which stages are unchanged and leaves them out of the ranking", async () => {
	const { runs, build } = fixture();
	await runs();
	const { status, log } = await build();
	assert.equal(status, 0);
	assert.equal(log[0], "Data build: 4 stages, 1 to run, 3 unchanged");
	for (const name of ["compile", "summary", "report"])
		assert.ok(log.includes(`${name}: unchanged, skipped`), name);
	assert.ok(log.includes("download: running (1 of 1)"));
	const ranking = log.slice(log.indexOf("Slowest stages:") + 1);
	assert.equal(ranking.length, 1);
	assert.match(ranking[0], /^ {2}download {2}\S+$/);
	assert.match(log.at(-ranking.length - 2)!, /\(1 ran, 3 unchanged\)$/);
});

test("restoring a deleted shared API cache rebuilds every component", async () => {
	const root = mkdtempSync(join(tmpdir(), "atlas-component-build-"));
	onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	mkdirSync(join(root, "data/build/.stamps"), { recursive: true });
	const path = join(root, "data/build/atlas-cache.sqlite");
	const components = ["place-index", "area-search-index", "postcode-counts"];
	const selected = components.map((name) => {
		const original = buildDataStages.find(
			(entry: Stage) => entry.name === name,
		);
		assert.ok(original);
		return { ...original, dependencies: ["base"] };
	});
	const run = async () => {
		const executed: string[] = [];
		assert.equal(
			await runBuild({
				stages: [
					{
						name: "base",
						dependencies: [],
						args: [],
						requiredOutputs: ["data/build/atlas-cache.sqlite"],
						writes: [
							"data/build/.stamps/place-index.json",
							"data/build/.stamps/area-search-index.json",
							"data/build/.stamps/postcode-counts.json",
						],
					},
					...selected,
				],
				log: () => {},
				createCache: () =>
					createStageCache({
						root,
						stateFile: join(root, ".cache/stages.json"),
						codeFiles: () => [],
						environment: {},
					}),
				execute: (current: { name: string }) => {
					executed.push(current.name);
					// The base build starts the cache again and clears the stamps.
					if (current.name === "base") {
						writeFileSync(path, "[]");
						for (const name of components)
							rmSync(
								join(root, `data/build/.stamps/${name}.json`),
								{
									force: true,
								},
							);
						return 0;
					}
					const values = JSON.parse(readFileSync(path, "utf8"));
					writeFileSync(
						path,
						JSON.stringify([...new Set([...values, current.name])]),
					);
					writeFileSync(
						join(root, `data/build/.stamps/${current.name}.json`),
						current.name,
					);
					return 0;
				},
			}),
			0,
		);
		assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), components);
		return executed;
	};
	assert.deepEqual(await run(), ["base", ...components]);
	assert.deepEqual(await run(), []);
	unlinkSync(path);
	assert.deepEqual(await run(), ["base", ...components]);
});

test("adopt reuses current outputs after a cache version change without executing stages", async () => {
	const { runs, root, write, build, ran } = fixture();
	await runs();
	const statePath = join(root, ".cache/stages.json");
	const old = JSON.parse(readFileSync(statePath, "utf8"));
	old.version = -1;
	write(".cache/stages.json", JSON.stringify(old));
	write("code.ts", "export const current = true;");
	write("data/build/datasets/compiled.json", "trusted existing bytes");
	ran.length = 0;
	const { log } = await build(["--adopt"]);
	assert.deepEqual(ran, []);
	assert.ok(log.includes("compile: adopted 1 output file"));
	assert.ok(!log.includes("  data/build/datasets/compiled.json"));
	assert.ok(
		(await build(["--adopt", "--verbose"])).log.includes(
			"  data/build/datasets/compiled.json",
		),
	);
	assert.deepEqual(await runs(), ["download"]);
	unlinkSync(join(root, "data/build/datasets/compiled.json"));
	assert.deepEqual(await runs(), ["download", "compile", "report"]);
});

test("adopt only selects prerequisites and plan does not change the cache", async () => {
	const { runs, root, write, build, ran } = fixture();
	await runs();
	write("code.ts", "export const current = true;");
	const statePath = join(root, ".cache/stages.json");
	const before = readFileSync(statePath, "utf8");
	ran.length = 0;
	const planned = await build(["--adopt", "--only", "report", "--plan"]);
	assert.deepEqual(ran, []);
	assert.ok(planned.log.includes("report: would adopt existing outputs"));
	assert.equal(readFileSync(statePath, "utf8"), before);
	assert.deepEqual(await runs(["--adopt", "--only", "report"]), []);
	assert.deepEqual(await runs(), ["download", "summary"]);
});

test("adoption preflights missing inventory files before saving any selected stage", async () => {
	const { runs, root, build, outputs } = fixture();
	await runs();
	const statePath = join(root, ".cache/stages.json");
	const before = readFileSync(statePath, "utf8");
	unlinkSync(join(root, outputs.report));
	await assert.rejects(
		() => build(["--adopt"]),
		/Cannot adopt report: missing output/,
	);
	assert.equal(readFileSync(statePath, "utf8"), before);
});

test("adoption validates required outputs and declared folders without an old cache", async () => {
	const { root, write } = fixture();
	const cache = createStageCache({
		root,
		codeFiles: () => ["code.ts"],
		environment: {},
	});
	const current = {
		name: "new",
		args: [],
		requiredOutputs: ["data/build/required.json"],
		outputs: ["data/build/folder"],
	};
	assert.throws(
		() => cache.adopt(current, []),
		/missing output data\/build\/folder/,
	);
	write("data/build/folder/item.json", "{}");
	const freshCache = () =>
		createStageCache({
			root,
			codeFiles: () => ["code.ts"],
			environment: {},
		});
	assert.throws(
		() => freshCache().adopt(current, []),
		/missing output data\/build\/required.json/,
	);
	write("data/build/required.json", "{}");
	const complete = freshCache();
	const adopted = complete.adopt(current, []);
	assert.deepEqual(adopted.files, [
		"data/build/folder/item.json",
		"data/build/required.json",
	]);
	assert.equal(complete.lookup(current, []), adopted.digest);
	assert.throws(
		() => complete.adopt({ name: "unknown", args: [] }, []),
		/no output inventory/,
	);
});

test("adoption rejects conflicting execution flags", async () => {
	const { build } = fixture();
	await assert.rejects(
		() => build(["--adopt", "--no-cache"]),
		/cannot be combined/,
	);
	await assert.rejects(
		() => build(["--adopt", "--from", "compile"]),
		/cannot be combined/,
	);
});

test("partial adoption preserves obsolete inventories for a later adoption", async () => {
	const { runs, root, write } = fixture();
	await runs();
	const old = JSON.parse(
		readFileSync(join(root, ".cache/stages.json"), "utf8"),
	);
	old.version = -1;
	write(".cache/stages.json", JSON.stringify(old));
	assert.deepEqual(await runs(["--adopt", "--only", "compile"]), []);
	assert.deepEqual(await runs(["--adopt", "--only", "summary"]), []);
	assert.deepEqual(await runs(), ["download", "report"]);
});

// A rewrite with a new mtime but the same bytes, as a rebuild would leave.
const touch = (root: string, path: string) => {
	const later = new Date(Date.now() + 60_000);
	utimesSync(join(root, path), later, later);
};

test("a stage that rewrites identical bytes does not rerun its dependants", async () => {
	const { runs, root, outputs, fixed } = fixture();
	fixed.compile = "stable\n";
	await runs();
	touch(root, outputs.compile);
	assert.deepEqual(await runs(), ["download", "compile"]);
	assert.deepEqual(await runs(), ["download"]);
	unlinkSync(join(root, outputs.compile));
	assert.deepEqual(await runs(), ["download", "compile"]);
	assert.deepEqual(await runs(), ["download"]);
});

test("a stage that writes different bytes reruns its dependants", async () => {
	const { runs, root, outputs, fixed } = fixture();
	fixed.compile = "stable\n";
	await runs();
	fixed.compile = "changed\n";
	touch(root, outputs.compile);
	assert.deepEqual(await runs(), ["download", "compile", "report"]);
	assert.deepEqual(await runs(), ["download"]);
});

test("files with unchanged size and mtime are not hashed again", async () => {
	const { runs, root, write, hashed, outputs } = fixture();
	write("data/build/datasets/kept.json", "kept\n");
	await runs();
	assert.deepEqual(
		[...hashed].sort(),
		[
			"data/build/datasets/compiled.json",
			"data/build/datasets/kept.json",
			"public/data/report.json",
			"data/build/artifacts/summary.json",
		].sort(),
	);
	hashed.length = 0;
	assert.deepEqual(await runs(), ["download"]);
	assert.equal(hashed.length, 0);
	// compile reruns, but kept.json still matches its record.
	touch(root, outputs.compile);
	await runs();
	assert.ok(hashed.includes(outputs.compile));
	assert.ok(!hashed.includes("data/build/datasets/kept.json"));
});

test("an upstream stage rewriting identical bytes still restores a file a downstream stage changed", async () => {
	const root = mkdtempSync(join(tmpdir(), "atlas-shared-rewrite-"));
	onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	mkdirSync(join(root, "data/build"), { recursive: true });
	const path = join(root, "data/build/atlas.sqlite");
	const chain = [
		{
			name: "base",
			dependencies: [],
			args: [],
			requiredOutputs: ["data/build/atlas.sqlite"],
		},
		{ name: "middle", dependencies: ["base"], args: [] },
		{ name: "final", dependencies: ["middle"], args: [] },
	];
	const executed: string[] = [];
	const run = async () => {
		executed.length = 0;
		await runBuild({
			stages: chain,
			log: () => {},
			createCache: () =>
				createStageCache({
					root,
					stateFile: join(root, ".cache/stages.json"),
					codeFiles: () => [],
					environment: {},
				}),
			execute: (current: { name: string }) => {
				executed.push(current.name);
				// base and final write the database; middle only reads it.
				if (current.name !== "middle")
					writeFileSync(path, current.name);
				return 0;
			},
		});
		return [...executed];
	};
	assert.deepEqual(await run(), ["base", "middle", "final"]);
	assert.deepEqual(await run(), []);
	// Recreating base's bytes wipes final's changes, so final must run again.
	unlinkSync(path);
	assert.deepEqual(await run(), ["base", "final"]);
	assert.equal(readFileSync(path, "utf8"), "final");
	assert.deepEqual(await run(), []);
});

test("adopt records content digests and a normal build then skips", async () => {
	const { runs, root, write, build, ran, hashed, outputs } = fixture();
	await runs();
	const statePath = join(root, ".cache/stages.json");
	const current = JSON.parse(readFileSync(statePath, "utf8"));
	// An old record: version 2 with size:mtimeMs strings and no hashes.
	const legacy = JSON.parse(JSON.stringify(current));
	legacy.version = 2;
	for (const record of Object.values<{ outputs: Record<string, unknown> }>(
		legacy.stages,
	))
		for (const [path, entry] of Object.entries(record.outputs)) {
			const { size, mtimeMs } = entry as {
				size: number;
				mtimeMs: number;
			};
			record.outputs[path] = `${size}:${mtimeMs}`;
		}
	write(".cache/stages.json", JSON.stringify(legacy));
	ran.length = 0;
	hashed.length = 0;
	await build(["--adopt"]);
	assert.deepEqual(ran, []);
	assert.equal(hashed.length, 3);
	const adopted = JSON.parse(readFileSync(statePath, "utf8"));
	assert.equal(adopted.version, current.version);
	for (const name of ["compile", "summary", "report"]) {
		assert.equal(adopted.stages[name].digest, current.stages[name].digest);
		for (const entry of Object.values<{ sha256: string }>(
			adopted.stages[name].outputs,
		))
			assert.match(entry.sha256, /^[0-9a-f]{64}$/);
	}
	assert.equal(
		adopted.stages.compile.outputs[outputs.compile].sha256,
		sha256(join(root, outputs.compile)),
	);
	hashed.length = 0;
	assert.deepEqual(await runs(), ["download"]);
	assert.equal(hashed.length, 0);
});

test("timings persist across skips and plans read legacy records", async () => {
	const { runs, root, build, write } = fixture();
	await runs();
	const statePath = join(root, ".cache/stages.json");
	const summaryPath = join(root, ".cache/last-build.json");
	const state = JSON.parse(readFileSync(statePath, "utf8"));
	const timing = state.stages.compile.timing;
	assert.ok(timing.commandMs >= 0);
	assert.ok(timing.totalMs >= timing.commandMs);
	assert.ok(!Number.isNaN(Date.parse(timing.finishedAt)));
	assert.equal(timing.failed, false);
	const firstSummary = JSON.parse(readFileSync(summaryPath, "utf8"));
	assert.ok(!Number.isNaN(Date.parse(firstSummary.startedAt)));
	assert.ok(!Number.isNaN(Date.parse(firstSummary.finishedAt)));
	assert.ok(firstSummary.totalMs >= 0);
	assert.equal(
		firstSummary.stages.find(
			(entry: { name: string }) => entry.name === "compile",
		).status,
		"ran",
	);
	await runs();
	assert.deepEqual(
		JSON.parse(readFileSync(statePath, "utf8")).stages.compile.timing,
		timing,
	);
	const summary = readFileSync(summaryPath, "utf8");
	assert.equal(
		JSON.parse(summary).stages.find(
			(entry: { name: string }) => entry.name === "compile",
		).status,
		"skipped",
	);
	const planned = await build(["--plan"]);
	assert.ok(
		planned.log.some((line) =>
			line.startsWith("compile: unchanged, would skip (last run "),
		),
	);
	assert.equal(readFileSync(summaryPath, "utf8"), summary);
	const legacy = JSON.parse(readFileSync(statePath, "utf8"));
	for (const entry of Object.values<{ timing?: unknown }>(legacy.stages))
		delete entry.timing;
	write(".cache/stages.json", JSON.stringify(legacy));
	assert.ok(
		(await build(["--plan"])).log.includes(
			"compile: unchanged, would skip",
		),
	);
	assert.deepEqual(await runs(), ["download"]);
});

test("a failed run saves timing and a failed summary without caching the stage", async () => {
	const { root, runs, build, failing } = fixture();
	await runs();
	failing.add("compile");
	assert.equal((await build(["--from", "compile"])).status, 1);
	const state = JSON.parse(
		readFileSync(join(root, ".cache/stages.json"), "utf8"),
	);
	assert.equal(state.stages.compile.key, null);
	assert.equal(state.stages.compile.timing.failed, true);
	assert.ok(
		state.stages.compile.timing.totalMs >=
			state.stages.compile.timing.commandMs,
	);
	const summary = JSON.parse(
		readFileSync(join(root, ".cache/last-build.json"), "utf8"),
	);
	assert.equal(summary.failed, true);
	assert.equal(summary.stages[0].status, "failed");
	assert.equal(summary.stages[0].name, "compile");
	failing.clear();
	assert.ok((await runs()).includes("compile"));
});

test("plan totals known durations for stages that would run", async () => {
	let now = 0;
	const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
	onTestFinished(() => clock.mockRestore());
	const { build, root } = fixture();
	await build();
	const path = join(root, ".cache/stages.json");
	const state = JSON.parse(readFileSync(path, "utf8"));
	state.stages.download.timing.totalMs = 2000;
	state.stages.compile.timing.totalMs = 3000;
	delete state.stages.report.timing;
	writeFileSync(path, JSON.stringify(state));
	const { log } = await build(["--plan", "--no-cache"]);
	assert.ok(log.includes("download: would run (last run 2.0s)"));
	assert.ok(log.includes("compile: would run (last run 3.0s)"));
	assert.ok(log.includes("report: would run"));
	assert.ok(log.includes("Estimated total: 5.0s for 3 of 4 stages to run"));
});

test("an execution error records a failed run", async () => {
	const root = mkdtempSync(join(tmpdir(), "atlas-build-error-"));
	onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	await assert.rejects(
		() =>
			runBuild({
				stages: [stage("broken")],
				createCache: () =>
					createStageCache({
						root,
						codeFiles: () => [],
						environment: {},
					}),
				log: () => {},
				execute: () => {
					throw new Error("cannot start");
				},
			}),
		/cannot start/,
	);
	const state = JSON.parse(
		readFileSync(join(root, ".cache/data-build/stages.json"), "utf8"),
	);
	assert.equal(state.stages.broken.key, null);
	assert.equal(state.stages.broken.timing.failed, true);
	const summary = JSON.parse(
		readFileSync(join(root, ".cache/data-build/last-build.json"), "utf8"),
	);
	assert.equal(summary.stages[0].status, "failed");
});
