import assert from "node:assert/strict";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test, type TestContext } from "vitest";
import {
	AssembleError,
	assembleModules,
	manifestFilePath,
} from "../../src/modules/assembleModules";
import { sha256OfFile, sqlitePath } from "../../src/modules/buildModules";
import { classifyViews, readSchema } from "../../src/modules/moduleTables";
import {
	buildFixtureRelease,
	writeFixtureAtlas,
} from "../fixtures/moduleFixtures";

const scratch = (t: TestContext) => {
	const root = mkdtempSync(join(tmpdir(), "module-build-"));
	t.onTestFinished(() => rmSync(root, { recursive: true, force: true }));
	return root;
};

const open = (path: string) => new DatabaseSync(path, { readOnly: true });

const count = (database: DatabaseSync, sql: string) =>
	Number((database.prepare(sql).get() as { n: number }).n);

test("a module file holds only the rows of its datasets", async (t) => {
	const root = scratch(t);
	await buildFixtureRelease(root);
	const atlas = open(join(root, "atlas.sqlite"));
	for (const [module, expected] of [
		[
			"economy",
			{
				dataset: 2,
				series: 3,
				observation: 6,
				series_gap: 1,
				series_input: 1,
				conversion_skip: 1,
			},
		],
		[
			"health",
			{
				dataset: 1,
				series: 2,
				observation: 3,
				series_gap: 1,
				conversion_skip: 1,
			},
		],
		[
			"politics",
			{
				dataset: 2,
				series: 2,
				// The 2016 local rows are the add-on's.
				observation: 2,
				series_gap: 1,
				area_relationship: 1,
				election: 2,
				contest: 3,
				candidacy: 4,
			},
		],
	] as const) {
		const file = open(join(root, "release", sqlitePath(module)));
		try {
			for (const [table, rows] of Object.entries(expected))
				assert.equal(
					count(file, `SELECT count(*) AS n FROM ${table}`),
					rows,
					`${module}.${table}`,
				);
			assert.equal(
				count(
					file,
					"SELECT count(*) AS n FROM sqlite_schema WHERE name IN ('measure','area_version','period','status')",
				),
				0,
				`${module} restates a core table`,
			);
		} finally {
			file.close();
		}
		// Politics gives up its 2016 local rows to the add-on (tested below).
		if (module === "politics") continue;
		const inAtlas = count(
			atlas,
			`SELECT count(*) AS n FROM observation WHERE series_id IN (SELECT s.id FROM series s JOIN dataset d ON d.id = s.dataset_id WHERE d.module = '${module}')`,
		);
		assert.equal(inAtlas, expected.observation);
	}
	atlas.close();
});

test("core holds the foundation tables, the catalogue and the denominators", async (t) => {
	const root = scratch(t);
	await buildFixtureRelease(root);
	const core = open(join(root, "release", sqlitePath("core")));
	try {
		const tables = readSchema(core)
			.filter((row) => row.type === "table")
			.map((row) => row.name);
		for (const name of [
			"measure",
			"area_version",
			"module",
			"module_dataset",
		])
			assert.ok(tables.includes(name), name);
		for (const name of [
			"observation",
			"dataset",
			"postcode_unit",
			"series_gap",
			"series_input",
			"conversion_skip",
		])
			assert.ok(!tables.includes(name), `${name} should not be in core`);
		assert.equal(
			count(core, "SELECT count(*) AS n FROM payloads"),
			1,
			"postcode payloads belong to the postcodes module",
		);
		// Population and households with no dimension: series 1 (3 rows) and 5 (1 row).
		assert.equal(
			count(core, "SELECT count(*) AS n FROM core_denominator"),
			4,
		);
		assert.equal(
			count(core, "SELECT count(*) AS n FROM module WHERE installed = 1"),
			1,
		);
		assert.deepEqual(
			readSchema(core)
				.filter((row) => row.type === "view")
				.map((row) => row.name),
			["area_label"],
		);
		assert.equal(
			count(core, "SELECT count(*) AS n FROM module_view"),
			2,
			"views over module tables wait for the assembler",
		);
	} finally {
		core.close();
	}
});

test("views are split by the module tables they read, through other views", () => {
	const atlas = new DatabaseSync(":memory:");
	atlas.exec(`
		CREATE TABLE observation (x); CREATE TABLE area_version (y);
		CREATE VIEW a AS SELECT y FROM area_version;
		CREATE VIEW b AS SELECT x FROM observation;
		CREATE VIEW c AS SELECT x FROM b;
	`);
	const { core, module } = classifyViews(readSchema(atlas));
	atlas.close();
	assert.deepEqual(
		core.map((view) => view.name),
		["a"],
	);
	assert.deepEqual(
		module.map((view) => [view.name, view.requires]),
		[
			["b", ["observation"]],
			["c", ["observation"]],
		],
	);
});

test("an assembled file answers like atlas.sqlite", async (t) => {
	const root = scratch(t);
	await buildFixtureRelease(root);
	const out = join(root, "all.sqlite");
	const result = await assembleModules({
		root: join(root, "release"),
		modules: [
			"postcodes",
			"politics-sharealike",
			"politics",
			"health",
			"economy",
		],
		out,
	});
	assert.deepEqual(result.modules, [
		"economy",
		"health",
		"politics",
		"politics-sharealike",
		"postcodes",
	]);
	assert.deepEqual(result.skippedViews, []);
	const atlas = open(join(root, "atlas.sqlite"));
	const assembled = open(out);
	try {
		for (const sql of [
			"SELECT count(*) AS n FROM dataset",
			"SELECT count(*) AS n FROM measure",
			"SELECT count(*) AS n FROM observation",
			"SELECT count(*) AS n FROM series_member",
			"SELECT count(*) AS n FROM series_gap",
			"SELECT count(*) AS n FROM series_input",
			"SELECT count(*) AS n FROM conversion_skip",
			"SELECT count(*) AS n FROM series_conversion",
			"SELECT count(*) AS n FROM series_crosswalk",
			"SELECT count(*) AS n FROM area_relationship",
			"SELECT count(*) AS n FROM candidacy",
			"SELECT count(*) AS n FROM contest",
			"SELECT count(*) AS n FROM election",
			"SELECT count(*) AS n FROM postcode_unit",
			"SELECT count(*) AS n FROM payloads",
			"SELECT total AS n FROM observation_totals WHERE measure = 'population'",
		])
			assert.equal(count(assembled, sql), count(atlas, sql), sql);
		const sample =
			"SELECT series_id, code, measure, value FROM observation_labelled ORDER BY series_id, code";
		assert.deepEqual(
			assembled.prepare(sample).all(),
			atlas.prepare(sample).all(),
		);
		assert.equal(
			(
				assembled
					.prepare(
						"SELECT value FROM meta WHERE key = 'assembledModules'",
					)
					.get() as { value: string }
			).value,
			"economy,health,politics,politics-sharealike,postcodes",
		);
		assert.deepEqual(
			assembled.prepare("PRAGMA foreign_key_check").all(),
			[],
		);
	} finally {
		atlas.close();
		assembled.close();
	}
});

test("a subset leaves out the views and tables of the modules not chosen", async (t) => {
	const root = scratch(t);
	await buildFixtureRelease(root);
	const out = join(root, "subset.sqlite");
	await assembleModules({
		root: join(root, "release"),
		modules: ["health"],
		out,
	});
	const assembled = open(out);
	try {
		const names = readSchema(assembled).map((row) => row.name);
		assert.ok(names.includes("observation"));
		assert.ok(!names.includes("postcode_unit"));
		// Only the chosen module's rows of the series tables are present, and every key resolves.
		assert.equal(
			count(assembled, "SELECT count(*) AS n FROM series_gap"),
			1,
		);
		assert.equal(
			count(assembled, "SELECT count(*) AS n FROM series_input"),
			0,
		);
		assert.deepEqual(
			assembled.prepare("PRAGMA foreign_key_check").all(),
			[],
		);
		assert.equal(count(assembled, "SELECT count(*) AS n FROM dataset"), 1);
		assert.equal(
			count(
				assembled,
				"SELECT count(*) AS n FROM module WHERE installed = 1",
			),
			2,
		);
	} finally {
		assembled.close();
	}
});

test("assembling twice gives the same bytes, whatever the order asked", async (t) => {
	const root = scratch(t);
	await buildFixtureRelease(root);
	const release = join(root, "release");
	await assembleModules({
		root: release,
		modules: ["health", "economy"],
		out: join(root, "one.sqlite"),
	});
	await assembleModules({
		root: release,
		modules: ["economy", "health", "economy"],
		out: join(root, "two.sqlite"),
	});
	assert.equal(
		await sha256OfFile(join(root, "one.sqlite")),
		await sha256OfFile(join(root, "two.sqlite")),
	);
});

test("rebuilding the modules gives the same bytes", async (t) => {
	const root = scratch(t);
	await buildFixtureRelease(root);
	const first = await sha256OfFile(
		join(root, "release", sqlitePath("economy")),
	);
	rmSync(join(root, "release"), { recursive: true });
	rmSync(join(root, "atlas.sqlite"));
	await buildFixtureRelease(root);
	assert.equal(
		await sha256OfFile(join(root, "release", sqlitePath("economy"))),
		first,
	);
});

test("the assembler refuses a module built for another core", async (t) => {
	const root = scratch(t);
	await buildFixtureRelease(root);
	const release = join(root, "release");
	const manifestPath = join(release, manifestFilePath("health"));
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
		compatibility: { core: string };
	};
	manifest.compatibility.core = "atlas-core-0";
	writeFileSync(manifestPath, JSON.stringify(manifest));
	await assert.rejects(
		assembleModules({
			root: release,
			modules: ["health", "economy"],
			out: join(root, "out.sqlite"),
		}),
		(error) =>
			error instanceof AssembleError &&
			/health: its manifest needs core atlas-core-0/.test(
				error.message,
			) &&
			!/economy/.test(error.message),
	);
	assert.throws(() => readFileSync(join(root, "out.sqlite")));
});

test("the assembler refuses a module file written for another core", async (t) => {
	const root = scratch(t);
	await buildFixtureRelease(root);
	const release = join(root, "release");
	const file = new DatabaseSync(join(release, sqlitePath("economy")));
	file.exec(
		"UPDATE module_info SET value = 'atlas-core-0' WHERE key = 'coreCompatibility'",
	);
	file.close();
	await assert.rejects(
		assembleModules({
			root: release,
			modules: ["economy"],
			out: join(root, "out.sqlite"),
		}),
		/economy: its database needs core atlas-core-0/,
	);
});

test("the assembler needs a built module and at least one", async (t) => {
	const root = scratch(t);
	await buildFixtureRelease(root);
	const release = join(root, "release");
	await assert.rejects(
		assembleModules({
			root: release,
			modules: ["core"],
			out: join(root, "o"),
		}),
		/at least one module/,
	);
	await assert.rejects(
		assembleModules({
			root: release,
			modules: ["transport"],
			out: join(root, "o"),
		}),
		/transport.*not built/,
	);
});

test("modules with share-alike data beside other terms need a flag", async (t) => {
	const root = scratch(t);
	await buildFixtureRelease(root);
	const release = join(root, "release");
	// No registry module has a conflict now, so mark one in its manifest.
	const manifestPath = join(release, manifestFilePath("health"));
	const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as object;
	writeFileSync(
		manifestPath,
		JSON.stringify({
			...manifest,
			licenceConflict: {
				shareAlike: ["cc-by-sa-4.0"],
				others: ["ogl-3.0"],
			},
		}),
	);
	await assert.rejects(
		assembleModules({
			root: release,
			modules: ["politics", "health"],
			out: join(root, "out.sqlite"),
		}),
		/health.*cannot be offered as one unit/,
	);
	const result = await assembleModules({
		root: release,
		modules: ["politics", "politics-sharealike", "health"],
		out: join(root, "out.sqlite"),
		allowLicenceConflict: true,
	});
	assert.deepEqual(result.modules, [
		"health",
		"politics",
		"politics-sharealike",
	]);
	const assembled = open(join(root, "out.sqlite"));
	try {
		assert.equal(
			(
				assembled
					.prepare(
						"SELECT value FROM meta WHERE key = 'assembledLicences'",
					)
					.get() as { value: string }
			).value,
			"cc-by-sa-4.0,ogl-3.0",
		);
	} finally {
		assembled.close();
	}
});

test("an add-on and its parent split the licensed rows, none shared or lost", async (t) => {
	const root = scratch(t);
	await buildFixtureRelease(root);
	const atlas = open(join(root, "atlas.sqlite"));
	const parent = open(join(root, "release", sqlitePath("politics")));
	const addOn = open(
		join(root, "release", sqlitePath("politics-sharealike")),
	);
	try {
		const tables = readSchema(addOn)
			.filter((row) => row.type === "table")
			.map((row) => row.name)
			.sort();
		assert.deepEqual(tables, [
			"area_relationship",
			"candidacy",
			"contest",
			"election",
			"module_info",
			"observation",
			"series_gap",
		]);
		for (const [table, rows] of [
			["election", 1],
			["contest", 1],
			["candidacy", 1],
			["observation", 2],
			["series_gap", 1],
			["area_relationship", 1],
		] as const)
			assert.equal(
				count(addOn, `SELECT count(*) AS n FROM ${table}`),
				rows,
				table,
			);
		// Together the two files hold exactly the rows atlas.sqlite has for the politics datasets.
		for (const [table, where] of [
			["election", ""],
			["contest", ""],
			["candidacy", ""],
			["observation", " WHERE series_id IN (6, 7)"],
			["series_gap", " WHERE series_id = 7"],
			["area_relationship", " WHERE dataset_id = 5"],
		] as const)
			assert.equal(
				count(parent, `SELECT count(*) AS n FROM ${table}${where}`) +
					count(addOn, `SELECT count(*) AS n FROM ${table}${where}`),
				count(atlas, `SELECT count(*) AS n FROM ${table}${where}`),
				table,
			);
		// No licensed period is left in the parent, and the add-on holds only those.
		assert.equal(
			count(
				parent,
				"SELECT count(*) AS n FROM observation WHERE series_id = 7 AND period_id = 3",
			),
			0,
		);
		assert.equal(
			count(
				addOn,
				"SELECT count(*) AS n FROM observation WHERE period_id <> 3",
			),
			0,
		);
		assert.equal(
			count(
				addOn,
				"SELECT count(*) AS n FROM election e JOIN contest c ON c.election_id = e.id",
			),
			1,
		);
	} finally {
		atlas.close();
		parent.close();
		addOn.close();
	}
});

test("an add-on is not assembled without the module it adds to", async (t) => {
	const root = scratch(t);
	await buildFixtureRelease(root);
	const release = join(root, "release");
	await assert.rejects(
		assembleModules({
			root: release,
			modules: ["politics-sharealike", "health"],
			out: join(root, "out.sqlite"),
		}),
		/politics-sharealike: it adds to politics, which is not in this assembly/,
	);
	const result = await assembleModules({
		root: release,
		modules: ["politics-sharealike", "politics"],
		out: join(root, "out.sqlite"),
	});
	assert.deepEqual(result.modules, ["politics", "politics-sharealike"]);
	const assembled = open(join(root, "out.sqlite"));
	try {
		assert.deepEqual(
			assembled.prepare("PRAGMA foreign_key_check").all(),
			[],
		);
	} finally {
		assembled.close();
	}
});

test("a module that points at another module's series is not built", async (t) => {
	const root = scratch(t);
	const atlas = join(root, "atlas.sqlite");
	writeFixtureAtlas(atlas);
	const database = new DatabaseSync(atlas);
	database.exec("UPDATE series SET derived_from_id = 4 WHERE id = 3");
	database.close();
	mkdirSync(join(root, "release"), { recursive: true });
	const { buildModules } = await import("../../src/modules/buildModules");
	const { fixtureManifests } = await import("../fixtures/moduleFixtures");
	await assert.rejects(
		buildModules({
			atlasPath: atlas,
			outDir: join(root, "release"),
			manifests: fixtureManifests(),
		}),
		/Module economy: 1 series are derived from a series of another module/,
	);
});
