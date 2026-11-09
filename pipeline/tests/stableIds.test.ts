import assert from "node:assert/strict";
import {
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "vitest";
import { STATUSES } from "@uk-data-atlas/atlas-runtime/measures";
import { type StatisticsDataset } from "@uk-data-atlas/atlas-runtime/measures";
import {
	keysOf,
	findIdMismatches,
	verifyStableIds,
} from "../src/ids/databaseKeys";
import {
	IdRegistries,
	idDirectory,
	idNamespaces,
	idRegistryPath,
	type IdNamespace,
} from "../src/ids/idRegistries";
import { registryProblems } from "../src/ids/checkRegistries";
import { seedIdRegistries } from "../src/ids/seedIds";
import {
	areaTables,
	crosswalkTables,
	readAreas,
	writeSqliteIndex,
} from "../src/storage/index";
import { registerStatistics } from "../src/storage/statisticsRegistry";
import { collectParties } from "../src/storage/statisticsParties";
import { closeAllReadOnlyDatabases } from "@uk-data-atlas/atlas-db";

type Release = { id: string; codes: string[] };
type Crosswalk = { from: string; to: string };
type Spec = { releases: Release[]; crosswalks: Crosswalk[] };

const crosswalkId = ({ from, to }: Crosswalk) => `ward-${from}-to-ward-${to}`;

/** Write the inventories and artifacts a spec describes. */
const write = (artifacts: string, spec: Spec) => {
	mkdirSync(join(artifacts, "areas/ward"), { recursive: true });
	mkdirSync(join(artifacts, "crosswalks"), { recursive: true });
	const json = (path: string, value: unknown) =>
		writeFileSync(join(artifacts, path), JSON.stringify(value));
	json("area-inventory.json", {
		schemaVersion: 1,
		contentHash: "sha256:inventory",
		boundaryRegistryHash: "sha256:registry",
		releases: spec.releases.map(({ id, codes }) => ({
			id,
			geography: "ward",
			status: "available",
			recordCount: codes.length,
			artifact: `areas/ward/${id}.json`,
			contentHash: `sha256:${id}`,
			codeProperty: "code",
			nameProperty: "name",
		})),
	});
	for (const { id, codes } of spec.releases)
		json(`areas/ward/${id}.json`, {
			schemaVersion: 1,
			contentHash: `sha256:${id}`,
			areas: codes.map((code) => ({ code, name: `${code} ${id}` })),
		});
	const codesOf = (id: string) =>
		spec.releases.find((release) => release.id === id)!.codes;
	for (const crosswalk of spec.crosswalks) {
		// Each source area goes to the same code in the target if it has one.
		const target = new Set(codesOf(crosswalk.to));
		const content = {
			schemaVersion: 1,
			id: crosswalkId(crosswalk),
			method: "clean-containment",
			quality: "derived",
			weighting: { status: "not-provided", reason: "Containment" },
			from: { geography: "ward", boundaryRelease: crosswalk.from },
			to: { geography: "ward", boundaryRelease: crosswalk.to },
			records: [...codesOf(crosswalk.from)].sort().map((code) => ({
				source: { code, labels: [`${code} ${crosswalk.from}`] },
				targets: target.has(code)
					? [{ code, labels: [`${code} ${crosswalk.to}`] }]
					: [],
			})),
			contentHash: `sha256:${crosswalkId(crosswalk)}`,
		};
		json(`crosswalks/${content.id}.json`, content);
	}
	json("crosswalk-inventory.json", {
		schemaVersion: 1,
		contentHash: "sha256:crosswalks",
		crosswalks: spec.crosswalks.map((crosswalk) => ({
			id: crosswalkId(crosswalk),
			from: { geography: "ward", boundaryRelease: crosswalk.from },
			to: { geography: "ward", boundaryRelease: crosswalk.to },
			method: "clean-containment",
			quality: "derived",
			weighting: { status: "not-provided", reason: "Containment" },
			recordCount: codesOf(crosswalk.from).length,
			artifact: `crosswalks/${crosswalkId(crosswalk)}.json`,
			contentHash: `sha256:${crosswalkId(crosswalk)}`,
		})),
	});
};

const fixture = (context: { onTestFinished: (run: () => void) => void }) => {
	const root = mkdtempSync(join(tmpdir(), "stable-ids-"));
	context.onTestFinished(() => {
		closeAllReadOnlyDatabases();
		rmSync(root, { recursive: true, force: true });
	});
	const artifacts = join(root, "data/build/artifacts");
	const ids = idDirectory(root);
	/** Build a database the way the build does: from the committed registries. */
	const build = (spec: Spec, name: string) => {
		rmSync(artifacts, { recursive: true, force: true });
		write(artifacts, spec);
		const registries = IdRegistries.load(ids);
		const path = join(root, `${name}.sqlite`);
		rmSync(path, { force: true });
		writeSqliteIndex(
			path,
			{},
			{
				...areaTables(artifacts, registries),
				...crosswalkTables(artifacts, registries),
			},
		);
		registries.save();
		return path;
	};
	return { root, artifacts, ids, build };
};

/** Every registry file under a directory, by path inside it. */
const registryFiles = (directory: string, prefix = ""): Map<string, string> => {
	const found = new Map<string, string>();
	for (const entry of readdirSync(join(directory, prefix), {
		withFileTypes: true,
	}))
		if (entry.isDirectory())
			for (const [path, text] of registryFiles(
				directory,
				`${prefix}${entry.name}/`,
			))
				found.set(path, text);
		else
			found.set(
				`${prefix}${entry.name}`,
				readFileSync(join(directory, prefix, entry.name), "utf8"),
			);
	return found;
};

/** Every id by natural key, for the namespaces a database of areas holds. */
const snapshot = (path: string) => {
	const database = new DatabaseSync(path, { readOnly: true });
	try {
		const keys = keysOf(database);
		const found = new Map<string, number>();
		for (const namespace of [
			"release",
			"geography",
			"area",
			"area_version",
			"crosswalk",
		] as const) {
			const { sql, key } = keys[namespace];
			for (const row of database.prepare(sql).all())
				found.set(`${namespace}:${key(row).join("/")}`, Number(row.id));
		}
		return found;
	} finally {
		database.close();
	}
};

const before: Spec = {
	releases: [
		{ id: "2023", codes: ["E1", "E2", "E3"] },
		{ id: "2025", codes: ["E2", "E3", "E5"] },
	],
	crosswalks: [{ from: "2023", to: "2025" }],
};

// A release in the middle of the inventory, a code at the front of an existing
// release, and a crosswalk in the middle of the inventory.
const after: Spec = {
	releases: [
		{ id: "2023", codes: ["E1", "E2", "E3"] },
		{ id: "2024", codes: ["E1", "E2", "E4"] },
		{ id: "2025", codes: ["E0", "E2", "E3", "E5"] },
	],
	crosswalks: [
		{ from: "2023", to: "2025" },
		{ from: "2023", to: "2024" },
		{ from: "2024", to: "2025" },
	].sort((a, b) => (a.to < b.to ? -1 : 1)),
};

test("adding a release in the middle of the inventory leaves every existing id unchanged", (context) => {
	const { ids, build } = fixture(context);
	const first = snapshot(build(before, "before"));
	const filesBefore = registryFiles(ids);
	const second = snapshot(build(after, "after"));
	// The new release added files, and no file there was changed.
	const filesAfter = registryFiles(ids);
	for (const [path, text] of filesBefore) {
		if (path.startsWith("area") && path.includes("/"))
			assert.equal(filesAfter.get(path), text, `${path} is unchanged`);
	}
	assert.ok(filesAfter.has("area-version/ward/2024.txt"));
	assert.ok(!filesBefore.has("area-version/ward/2024.txt"));
	assert.ok(first.size > 10);
	for (const [key, id] of first)
		assert.equal(second.get(key), id, `${key} kept its id`);
	// What is new takes ids above every one already given.
	const newKeys = [...second].filter(([key]) => !first.has(key));
	assert.ok(newKeys.length > 0);
	for (const [key, id] of newKeys) {
		const namespace = key.slice(0, key.indexOf(":"));
		const used = [...first]
			.filter(([other]) => other.startsWith(`${namespace}:`))
			.map(([, other]) => other);
		assert.ok(id > Math.max(...used), `${key} got a new id`);
	}
	// ...which is the release the new one was put between.
	assert.equal(second.get("release:ward/2023"), 0);
	assert.equal(second.get("release:ward/2025"), 1);
	assert.equal(second.get("release:ward/2024"), 2);
	assert.equal(second.get("area_version:ward/2024/E4"), 9);
});

test("without the registry the same inventory would renumber every later release", (context) => {
	const { artifacts } = fixture(context);
	write(artifacts, after);
	const ids = IdRegistries.memory();
	areaTables(artifacts, ids);
	// This is what the ids were before the registry: positions in the list.
	assert.equal(ids.release.id("ward", "2025"), 2);
	assert.equal(ids.release.id("ward", "2024"), 1);
});

test("the inventory keeps its own order whatever ids the releases have", (context) => {
	const { root, build } = fixture(context);
	build(before, "before");
	const path = build(after, "after");
	const database = new DatabaseSync(path, { readOnly: true });
	try {
		assert.deepEqual(
			database
				.prepare(
					"SELECT release FROM area_releases ORDER BY inventory_position",
				)
				.all()
				.map((row) => row.release),
			["2023", "2024", "2025"],
		);
		assert.deepEqual(
			database
				.prepare(
					"SELECT slug FROM crosswalk ORDER BY inventory_position",
				)
				.all()
				.map((row) => row.slug),
			after.crosswalks.map(crosswalkId),
		);
		// A code added to a release keeps the place the artifact gives it.
		assert.deepEqual(
			database
				.prepare(
					"SELECT a.code FROM area_version v JOIN area a ON a.id = v.area_id JOIN area_releases r ON r.id = v.release_id WHERE r.release = '2025' AND v.in_inventory = 1 ORDER BY v.inventory_position",
				)
				.all()
				.map((row) => row.code),
			["E0", "E2", "E3", "E5"],
		);
	} finally {
		database.close();
	}
	copyFileSync(path, join(root, "data/build/atlas-base.sqlite"));
	rmSync(join(root, "data/build/artifacts"), { recursive: true });
	write(join(root, "data/build/artifacts"), after);
	assert.deepEqual(
		[...readAreas(root, { geography: "ward", release: "2025" })].map(
			(area) => area.code,
		),
		["E0", "E2", "E3", "E5"],
	);
});

test("an area version is found by its geography, release and code", (context) => {
	const { build } = fixture(context);
	const database = new DatabaseSync(build(after, "after"), {
		readOnly: true,
	});
	try {
		const find =
			"SELECT area_version_id FROM v_area_version WHERE geography = ? AND release = ? AND code = ?";
		assert.equal(
			database.prepare(find).get("ward", "2024", "E4")?.area_version_id,
			6,
		);
		assert.equal(
			database.prepare(find).get("ward", "2024", "E9"),
			undefined,
		);
		// Every one of the three is looked up in an index, none by scanning.
		const plan = database
			.prepare(`EXPLAIN QUERY PLAN ${find}`)
			.all("ward", "2024", "E4")
			.map((row) => String(row.detail))
			.join("\n");
		assert.doesNotMatch(
			plan,
			/SCAN (v|a|g|r|area|area_version|geography|area_releases)\b(?! USING)/,
		);
		assert.equal(
			database
				.prepare(
					"SELECT count(*) AS n FROM (SELECT geography, release, code FROM v_area_version GROUP BY 1, 2, 3 HAVING count(*) > 1)",
				)
				.get()?.n,
			0,
		);
	} finally {
		database.close();
	}
});

test("a registry that no longer matches a database is found", (context) => {
	const { ids, build } = fixture(context);
	const path = build(before, "before");
	const database = new DatabaseSync(path, { readOnly: true });
	try {
		const file = join(idRegistryPath(ids, "area_version"), "ward/2023.txt");
		const original = readFileSync(file, "utf8");
		assert.equal(
			findIdMismatches(database, IdRegistries.load(ids)).mismatches
				.length,
			0,
		);
		// Two codes swapped: every id after them is renumbered or reused.
		const lines = original.split("\n");
		const first = lines.indexOf("E1");
		const second = lines.indexOf("E2");
		[lines[first], lines[second]] = [lines[second]!, lines[first]!];
		const swapped = lines.join("\n");
		writeFileSync(file, swapped);
		assert.equal(
			registryProblems(
				new Map([["area-version/ward/2023.txt", swapped]]),
				new Map([["area-version/ward/2023.txt", original]]),
			).length,
			1,
		);
		const { mismatches } = findIdMismatches(
			database,
			IdRegistries.load(ids),
		);
		assert.ok(mismatches.length >= 2);
		assert.throws(
			() => verifyStableIds(database, IdRegistries.load(ids)),
			/Ids differ from the id registry/,
		);
	} finally {
		database.close();
	}
});

test("a database from before area_releases.id was renamed is still checked", (context) => {
	const { ids, build, root } = fixture(context);
	const path = join(root, "legacy.sqlite");
	copyFileSync(build(after, "after"), path);
	const database = new DatabaseSync(path);
	try {
		// The earlier layout: `position` was the id and `id` the release's name.
		database.exec(
			"ALTER TABLE area_releases RENAME COLUMN id TO position; ALTER TABLE area_releases RENAME COLUMN release TO id",
		);
		const { mismatches, checked } = findIdMismatches(
			database,
			IdRegistries.load(ids),
		);
		assert.deepEqual(mismatches, []);
		assert.equal(checked.release, 3);
		assert.equal(checked.area_version, 10);
	} finally {
		database.close();
	}
});

test("a registry cannot list one key twice", (context) => {
	const { ids, build } = fixture(context);
	build(before, "before");
	// A file of its own, numbered to follow the rest, that lists E1 again.
	const next = IdRegistries.load(ids).area.size + 1;
	writeFileSync(
		join(idRegistryPath(ids, "area"), "ward/2099.txt"),
		`@ward\n=${next}\nE1\n`,
	);
	assert.throws(() => IdRegistries.load(ids), /lists ward\/E1 twice/);
});

test("a frozen build refuses a key the registry lacks", (context) => {
	const { artifacts, ids, build } = fixture(context);
	build(before, "before");
	rmSync(artifacts, { recursive: true, force: true });
	write(artifacts, after);
	const frozen = IdRegistries.load(ids, { frozen: true });
	assert.throws(
		() => areaTables(artifacts, frozen),
		/Id registry release has no id for ward\/2024/,
	);
});

test("a database seeded into registries is read back unchanged", (context) => {
	const { root, build } = fixture(context);
	const path = build(after, "after");
	const database = new DatabaseSync(path, { readOnly: true });
	try {
		const seeded = IdRegistries.load(idDirectory(join(root, "seeded")));
		seedIdRegistries(database, seeded);
		assert.equal(findIdMismatches(database, seeded).mismatches.length, 0);
		for (const namespace of idNamespaces as IdNamespace[])
			assert.equal(
				seeded.registries[namespace].added,
				seeded.registries[namespace].size,
			);
	} finally {
		database.close();
	}
});

const dataset = (
	slug: string,
	measures: string[],
	series: string[],
): StatisticsDataset =>
	({
		slug,
		module: "population",
		title: slug,
		description: slug,
		source: {
			publisher: "ONS",
			url: "https://example.org",
			licence: "OGL",
		},
		fingerprint: slug,
		measures: measures.map((measure) => ({
			slug: measure,
			label: measure,
			description: measure,
			unit: "people",
			valueKind: "count",
			aggregation: "sum",
		})),
		dimensions: [
			{
				slug: "sex",
				label: "Sex",
				members: [
					{ code: "female", label: "Female" },
					{ code: "male", label: "Male" },
				],
			},
		],
		periods: [
			{
				label: "2021",
				kind: "year",
				start: "2021-01-01",
				end: "2021-12-31",
			},
		],
		series: series.map((measure) => ({
			measure,
			release: { geography: "ward", id: "2023" },
			members: { sex: "male" },
		})),
		observations: () => [],
	}) as unknown as StatisticsDataset;

test("adding a dataset, measure or series in the middle leaves every statistics id unchanged", (context) => {
	const root = mkdtempSync(join(tmpdir(), "stable-statistics-ids-"));
	context.onTestFinished(() =>
		rmSync(root, { recursive: true, force: true }),
	);
	const directory = idDirectory(root);
	const idsOf = (datasets: StatisticsDataset[]) => {
		const registries = IdRegistries.load(directory);
		const registered = registerStatistics(datasets, registries);
		registries.save();
		return new Map<string, number>([
			...datasets.map(
				(item, index) =>
					[
						`dataset:${item.slug}`,
						registered.datasetIds[index]!,
					] as const,
			),
			...registered.measures.entries.map(
				({ id, item }) => [`measure:${item.slug}`, id] as const,
			),
			...registered.seriesRows.map(
				({ id, key }) => [`series:${key}`, id] as const,
			),
			...registered.members.entries.map(
				({ id, item }) => [`member:${item.code}`, id] as const,
			),
			...registered.periods.entries.map(
				({ id, item }) => [`period:${item.label}`, id] as const,
			),
		]);
	};
	const first = idsOf([
		dataset("alpha", ["people"], ["people"]),
		dataset("omega", ["homes"], ["homes"]),
	]);
	const second = idsOf([
		dataset("alpha", ["people", "births"], ["births", "people"]),
		dataset("beta", ["deaths"], ["deaths"]),
		dataset("omega", ["homes"], ["homes"]),
	]);
	for (const [key, id] of first)
		assert.equal(second.get(key), id, `${key} kept its id`);
	assert.equal(second.get("dataset:beta"), 3);
	assert.equal(second.get("measure:births"), 3);
	assert.ok(second.size > first.size);
});

test("parties keep their ids when another sorts before them", (context) => {
	const root = mkdtempSync(join(tmpdir(), "stable-party-ids-"));
	context.onTestFinished(() =>
		rmSync(root, { recursive: true, force: true }),
	);
	const directory = idDirectory(root);
	const contests = (codes: string[]) =>
		({
			parties: [],
			elections: () => [
				{
					label: "2024",
					kind: "general",
					date: "2024-07-04",
					release: { geography: "constituency", id: "2024" },
					contests: codes.map((code, index) => ({
						release: { geography: "constituency", id: "2024" },
						code: `E${index}`,
						contest: { first_party: code },
					})),
				},
			],
		}) as unknown as StatisticsDataset;
	const idsOf = (codes: string[]) => {
		const registries = IdRegistries.load(directory);
		const { rows } = collectParties([contests(codes)], registries.party);
		registries.save();
		return new Map(rows.map((row) => [row.code, row.id]));
	};
	const first = idsOf(["Lab", "Con"]);
	const second = idsOf(["Lab", "Con", "Green", "Alliance"]);
	for (const [code, id] of first) assert.equal(second.get(code), id);
	assert.equal(first.get("Con"), 1);
	assert.equal(first.get("Lab"), 2);
	assert.equal(second.get("Alliance"), 3);
	assert.equal(second.get("Green"), 4);
});

test("a status keeps the id it has, because the list only grows at the end", () => {
	// `status.id` is the position in STATUSES. Do not reorder or remove these:
	// add a new status after the last one.
	assert.deepEqual(
		STATUSES.slice(0, 6).map(([slug]) => slug),
		[
			"observed",
			"estimated",
			"provisional",
			"suppressed",
			"not_applicable",
			"derived",
		],
	);
});
