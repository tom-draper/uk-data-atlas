import {
	fixtureObservationDatabase,
	writeObservationFixture,
	removeObservationFixture,
} from "./observationFixtures";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readMeasureObservations } from "../src/observationLoader";
import type {
	DataCatalog,
	AnyMeasureObservationArtifact,
} from "../src/dataCatalog";
import {
	lazySourceObservations,
	ObservationCache,
	observationTableOf,
	periodRecordLookup,
	readSourceObservations,
	tableMeasureObservations,
	type MeasureTableArtifact,
} from "../src/observationTables";
import { artifactDirectory } from "../../../shared/dataLayout";

const table: MeasureTableArtifact = {
	schemaVersion: 1,
	kind: "measure-table",
	id: "fixture-table",
	datasetId: "fixture",
	sourceGeography: { type: "lsoa", boundaryYear: 2021 },
	period: "2021",
	measures: ["owned", "rented"],
	records: [
		["E01000001", 10, 5],
		["E01000002", 7, null],
	],
	contentHash: "sha256:table",
};

test("serves one measure's column as an ordinary observation artifact", () => {
	const rented = tableMeasureObservations(table, "rented");

	assert.equal(rented.measureId, "rented");
	assert.equal(rented.contentHash, "sha256:table");
	assert.deepEqual(rented.sourceGeography, table.sourceGeography);
	// An unpublished value is left out rather than served as zero.
	assert.deepEqual(rented.periods[0]?.records, [
		{ areaCode: "E01000001", value: 5, status: "observed" },
	]);
	// A download of the view is the whole table it came from.
	assert.equal(observationTableOf(rented), table);
	assert.throws(
		() => tableMeasureObservations(table, "unknown"),
		/does not serve unknown/,
	);
});

test("builds a view's records only when first read", () => {
	let reads = 0;
	const counted = {
		...table,
		get records() {
			reads += 1;
			return table.records;
		},
	} as MeasureTableArtifact;
	const view = tableMeasureObservations(counted, "owned");

	assert.equal(reads, 0);
	assert.equal(view.periods[0]?.records.length, 2);
	assert.equal(view.periods[0]?.records.length, 2);
	assert.equal(reads, 1);
});

test("answers one area from the table's rows without building the records", () => {
	let builds = 0;
	const records = [
		...table.records,
		["E01000001", 99, 99],
	] as MeasureTableArtifact["records"];
	const rented = tableMeasureObservations({ ...table, records }, "rented");
	const period = rented.periods[0];
	assert.ok(period);
	const readRecords = Object.getOwnPropertyDescriptor(period, "records")?.get;
	assert.ok(readRecords);
	Object.defineProperty(period, "records", {
		get() {
			builds++;
			return readRecords.call(period);
		},
	});
	const lookup = periodRecordLookup(period)!;

	assert.deepEqual(lookup("E01000001"), {
		areaCode: "E01000001",
		value: 5,
		status: "observed",
	});
	// A null value and an unknown code are both absent; the first row for a
	// code is the one a scan of the records would have found.
	assert.equal(lookup("E01000002"), undefined);
	assert.equal(lookup("E09999999"), undefined);
	assert.equal(builds, 0);
	assert.equal(rented.periods[0]?.records.length, 2);
	assert.equal(builds, 1);
	assert.equal(
		periodRecordLookup({ period: "2021", records: [] }),
		undefined,
	);
});

test("retains zeros and row order while omitting unpublished column values", () => {
	const view = tableMeasureObservations(
		{
			...table,
			records: [
				["E01000004", 99, 0],
				["E01000002", 99, null],
				["E01000003", 99],
				["E01000001", 99, -2],
			],
		},
		"rented",
	);
	assert.deepEqual(view.periods[0]?.records, [
		{ areaCode: "E01000004", value: 0, status: "observed" },
		{ areaCode: "E01000001", value: -2, status: "observed" },
	]);
	assert.equal(view.periods[0]?.records, view.periods[0]?.records);
});

test("reads a shared table once and a measure's own artifact as it is", () => {
	const directory = mkdtempSync(join(tmpdir(), "observation-tables-"));
	try {
		writeObservationFixture(
			join(directory, "fixture-table.json"),
			JSON.stringify(table),
		);
		const own = {
			schemaVersion: 1,
			contentHash: "sha256:own",
			measureId: "population",
			sourceGeography: { type: "ward", boundaryYear: 2023 },
			periods: [
				{
					period: "2022",
					records: [
						{ areaCode: "E05000001", value: 5, status: "observed" },
					],
				},
			],
		};
		writeObservationFixture(
			join(directory, "population-observations.json"),
			JSON.stringify(own),
		);
		const tables = new Map<string, MeasureTableArtifact>();

		const owned = readSourceObservations(
			fixtureObservationDatabase(directory),
			"fixture-table",
			"owned",
			tables,
		);
		assert.equal(tables.size, 1);
		// The second measure comes from the cached table, not SQLite.
		removeObservationFixture(join(directory, "fixture-table.json"));
		const rented = readSourceObservations(
			fixtureObservationDatabase(directory),
			"fixture-table",
			"rented",
			tables,
		);
		assert.deepEqual(
			[
				owned.measureId,
				rented.measureId,
				rented.periods[0]?.records.length,
			],
			["owned", "rented", 1],
		);
		assert.deepEqual(
			readSourceObservations(
				fixtureObservationDatabase(directory),
				"population-observations",
				"population",
				tables,
			),
			own,
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("reads a lazy source's payload only when its hash or periods are asked for", () => {
	const directory = mkdtempSync(join(tmpdir(), "observation-lazy-"));
	try {
		const own = {
			schemaVersion: 1,
			contentHash: "sha256:own",
			measureId: "population",
			sourceGeography: { type: "ward", boundaryYear: 2023 },
			periods: [
				{
					period: "2022",
					records: [
						{ areaCode: "E05000001", value: 5, status: "observed" },
					],
				},
			],
		};
		const path = join(directory, "population-observations.json");
		writeObservationFixture(path, JSON.stringify(own));
		const view = lazySourceObservations(
			fixtureObservationDatabase(directory),
			"population-observations",
			"population",
			{ type: "ward", boundaryYear: 2023 },
		);

		// What the catalogue says is known, so the row can be gone until a
		// caller wants its content.
		removeObservationFixture(path);
		assert.equal(view.measureId, "population");
		assert.deepEqual(view.sourceGeography, own.sourceGeography);
		writeObservationFixture(path, JSON.stringify(own));

		assert.equal(view.contentHash, "sha256:own");
		assert.deepEqual(view.periods, own.periods);
		// Once read, its serialized contract matches the stored artifact.
		assert.deepEqual(JSON.parse(JSON.stringify(view)), own);
		assert.deepEqual(Object.keys({ ...view }), Object.keys(own));
		assert.equal(observationTableOf(view), undefined);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("a lazy table view resolves to its table and a missing or mismatched payload is refused", () => {
	const directory = mkdtempSync(join(tmpdir(), "observation-lazy-"));
	try {
		writeObservationFixture(join(directory, "placeholder.json"), "{}");
		assert.throws(
			() =>
				lazySourceObservations(
					fixtureObservationDatabase(directory),
					"absent-observations",
					"population",
					{ type: "ward", boundaryYear: 2023 },
				),
			/Missing measure observations at /,
		);
		writeObservationFixture(
			join(directory, "fixture-table.json"),
			JSON.stringify(table),
		);
		const tables = new ObservationCache();
		const rented = lazySourceObservations(
			fixtureObservationDatabase(directory),
			"fixture-table",
			"rented",
			table.sourceGeography,
			tables,
		);
		assert.equal(observationTableOf(rented)?.id, "fixture-table");
		assert.equal(rented.periods[0]?.records.length, 1);

		const wrongYear = lazySourceObservations(
			fixtureObservationDatabase(directory),
			"fixture-table",
			"owned",
			{ type: "lsoa", boundaryYear: 2011 },
		);
		assert.throws(
			() => wrongYear.periods,
			/Invalid measure observations at /,
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("evicts least recently used artifacts and reloads through live lazy views", (t) => {
	const directory = mkdtempSync(join(tmpdir(), "observation-budget-"));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	const text = JSON.stringify(table);
	for (const name of ["a", "b", "c"])
		writeObservationFixture(join(directory, `${name}.json`), text);
	const cache = new ObservationCache(
		(Buffer.byteLength(text) + text.length * 2) * 2,
	);
	const a = lazySourceObservations(
		fixtureObservationDatabase(directory),
		"a",
		"owned",
		table.sourceGeography,
		cache,
	);
	const rented = lazySourceObservations(
		fixtureObservationDatabase(directory),
		"a",
		"rented",
		table.sourceGeography,
		cache,
	);
	const b = lazySourceObservations(
		fixtureObservationDatabase(directory),
		"b",
		"owned",
		table.sourceGeography,
		cache,
	);
	const aTable = observationTableOf(a);
	const bPeriods = b.periods;
	assert.equal(observationTableOf(rented), aTable);
	const aPeriods = a.periods;
	cache.read(fixtureObservationDatabase(directory), "c", "owned");
	assert.equal(a.periods, aPeriods);
	assert.equal(observationTableOf(a), aTable);
	assert.notEqual(b.periods, bPeriods);
	assert.deepEqual(b.periods, bPeriods);
	// An active caller's period and lookup remain usable after eviction.
	assert.deepEqual(periodRecordLookup(bPeriods[0]!)!("E01000001"), {
		areaCode: "E01000001",
		value: 10,
		status: "observed",
	});
});

test("does not retain oversized observations or displace a cached small artifact", (t) => {
	const directory = mkdtempSync(join(tmpdir(), "observation-budget-"));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	const text = JSON.stringify(table);
	writeObservationFixture(join(directory, "small.json"), text);
	writeObservationFixture(
		join(directory, "large.json"),
		JSON.stringify({
			...table,
			records: [...table.records, ...table.records],
		}),
	);
	const cache = new ObservationCache(
		Buffer.byteLength(text) + text.length * 2,
	);
	const small = cache.read(
		fixtureObservationDatabase(directory),
		"small",
		"owned",
	);
	const large = lazySourceObservations(
		fixtureObservationDatabase(directory),
		"large",
		"owned",
		table.sourceGeography,
		cache,
	);
	assert.notEqual(large.periods, large.periods);
	assert.equal(
		cache.read(fixtureObservationDatabase(directory), "small", "owned"),
		small,
	);
	const uncached = lazySourceObservations(
		fixtureObservationDatabase(directory),
		"small",
		"owned",
		table.sourceGeography,
		new ObservationCache(0),
	);
	assert.notEqual(uncached.periods, uncached.periods);
});

test("bounds ordinary observation artifacts as well as shared tables", (t) => {
	const directory = mkdtempSync(join(tmpdir(), "observation-budget-"));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	const own: AnyMeasureObservationArtifact = {
		schemaVersion: 1,
		contentHash: "sha256:own",
		measureId: "population",
		sourceGeography: { type: "ward", boundaryYear: 2023 },
		periods: [
			{
				period: "2022",
				records: [
					{ areaCode: "E05000001", value: 5, status: "observed" },
				],
			},
		],
	};
	const text = `${JSON.stringify(own)}\n`;
	for (const name of ["a", "b"])
		writeObservationFixture(join(directory, `${name}.json`), text);
	const cache = new ObservationCache(
		Buffer.byteLength(text) + text.length * 2,
	);
	const view = lazySourceObservations(
		fixtureObservationDatabase(directory),
		"a",
		"population",
		own.sourceGeography,
		cache,
	);
	const periods = view.periods;
	assert.equal(view.periods, periods);
	cache.read(fixtureObservationDatabase(directory), "b", "population");
	assert.notEqual(view.periods, periods);
	assert.deepEqual(view.periods, periods);
	for (const bytes of [-1, 0.5, NaN, Infinity])
		assert.throws(
			() => new ObservationCache(bytes),
			/non-negative safe integer/,
		);
});

test("catalogue views share the configured observation budget", (t) => {
	const directory = mkdtempSync(join(tmpdir(), "observation-catalogue-"));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	mkdirSync(artifactDirectory(directory), { recursive: true });
	const text = JSON.stringify(table);
	for (const name of ["a", "b"])
		writeObservationFixture(join(directory, `${name}.json`), text);
	const catalogue: DataCatalog = {
		schemaVersion: 1,
		contentHash: "sha256:catalogue",
		source: {
			artifact: "data/datasets/dataset-manifest.json",
			manifestVersion: 1,
		},
		datasets: [],
		measures: ["owned", "rented"].map((id) => ({
			id,
			label: id,
			valueKind: "count",
			unit: "people",
			aggregation: {
				kind: "extensive",
				operation: "sum",
				available: true,
			},
			availability: {
				sourceExact: true,
				conversion: false,
				aggregation: true,
			},
			links: { data: `/v1/data/${id}` },
			sources: (id === "owned" ? ["a", "b"] : ["a"]).map(
				(observationArtifact) => ({
					datasetId: "fixture",
					periods: ["2021"],
					sourceGeography: table.sourceGeography,
					observationArtifact,
					coverage: {
						kind: "partial",
						countries: ["GB-ENG"],
						recordCount: 2,
						note: "Fixture",
					},
				}),
			),
		})),
	};
	mkdirSync(join(directory, "data/build"), { recursive: true });
	renameSync(
		fixtureObservationDatabase(directory),
		join(directory, "data/build/atlas.sqlite"),
	);
	const [a, b, rented] = readMeasureObservations(
		join(directory, "services/api"),
		catalogue,
		Buffer.byteLength(text) + text.length * 2,
	);
	const first = observationTableOf(a!);
	assert.equal(observationTableOf(rented!), first);
	const periods = a!.periods;
	assert.equal(b!.periods.length, 1);
	assert.notEqual(a!.periods, periods);
	assert.deepEqual(a!.periods, periods);
});

test("bulk text shares the LRU budget and refreshes recency", (t) => {
	const directory = mkdtempSync(join(tmpdir(), "observation-text-"));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	const text = JSON.stringify(table);
	for (const name of ["a", "b", "c"])
		writeObservationFixture(join(directory, `${name}.json`), text);
	const path = fixtureObservationDatabase(directory);
	const cache = new ObservationCache(
		(Buffer.byteLength(text) + text.length * 2) * 2,
	);
	assert.equal(
		cache.text(path, "a"),
		`${JSON.stringify({ ...table, id: "a" })}\n`,
	);
	const parsed = cache.read(path, "a", "owned");
	cache.text(path, "b");
	assert.equal(
		cache.text(path, "a"),
		`${JSON.stringify({ ...table, id: "a" })}\n`,
	);
	cache.text(path, "c");
	assert.equal(cache.read(path, "a", "owned"), parsed);
	for (const name of ["a", "b", "c"])
		removeObservationFixture(join(directory, `${name}.json`));
	assert.equal(
		cache.text(path, "a"),
		`${JSON.stringify({ ...table, id: "a" })}\n`,
	);
	assert.equal(
		cache.text(path, "c"),
		`${JSON.stringify({ ...table, id: "c" })}\n`,
	);
	assert.throws(
		() => cache.text(path, "b"),
		/Missing SQLite measure observations/,
	);
});

test("oversized bulk text is rebuilt without evicting a smaller cached entry", (t) => {
	const directory = mkdtempSync(join(tmpdir(), "observation-text-"));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	const text = JSON.stringify(table);
	writeObservationFixture(join(directory, "small.json"), text);
	writeObservationFixture(
		join(directory, "large.json"),
		JSON.stringify({
			...table,
			records: [...table.records, ...table.records],
		}),
	);
	const path = fixtureObservationDatabase(directory);
	const cache = new ObservationCache(
		Buffer.byteLength(text) + text.length * 2,
	);
	cache.text(path, "small");
	cache.text(path, "large");
	removeObservationFixture(join(directory, "large.json"));
	removeObservationFixture(join(directory, "small.json"));
	assert.equal(
		cache.text(path, "small"),
		`${JSON.stringify({ ...table, id: "small" })}\n`,
	);
	assert.throws(
		() => cache.text(path, "large"),
		/Missing SQLite measure observations/,
	);
});
