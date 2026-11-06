import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "vitest";
import {
	areaTables,
	crosswalkTables,
	namedLocationTables,
	readAreaInventory,
	readAreaReleaseArtifacts,
	readAreas,
	readCrosswalk,
	readCrosswalkById,
	readCrosswalkInventory,
	readCrosswalks,
	readNamedLocations,
	writeSqliteIndex,
} from "../src/storage/index";
import { closeAllReadOnlyDatabases } from "@uk-data-atlas/atlas-runtime/storage";

const release = (id: string, recordCount: number) => ({
	id,
	geography: "ward",
	status: "available" as const,
	recordCount,
	artifact: `areas/ward/${id}.json`,
	contentHash: `sha256:${id}`,
	codeProperty: "code",
	nameProperty: "name",
});

const areas2024 = [
	{ code: "A", name: "Alpha", aliases: ["Alffa"] },
	{ code: "B", name: "Beta" },
	{ code: "C", name: "Gamma" },
];
const areas2025 = [
	{ code: "A", name: "Alpha" },
	{ code: "D", name: "Delta" },
];

const crosswalk = {
	schemaVersion: 1,
	id: "ward-2024-to-ward-2025",
	method: "clean-containment",
	quality: "derived",
	weighting: { status: "not-provided", reason: "Containment" },
	from: { geography: "ward", boundaryRelease: "2024" },
	to: { geography: "ward", boundaryRelease: "2025" },
	records: [
		{
			source: { code: "A", labels: ["Alpha", "Alffa"] },
			targets: [{ code: "A", labels: ["Alpha"] }],
		},
		{
			source: { code: "B", labels: ["Beta"] },
			targets: [{ code: "D", labels: ["Delta"] }],
		},
		{ source: { code: "C", labels: ["Gamma"] }, targets: [] },
	],
	contentHash: "sha256:crosswalk",
};

const namedLocations = {
	schemaVersion: 1,
	contentHash: "sha256:locations",
	source: {
		artifact: "data/datasets/gazetteer.core.json",
		gazetteerVersion: 1,
	},
	locations: [
		{
			id: "north",
			label: "North",
			kind: "editorial-grouping",
			definitionRevision: 1,
			memberGeography: "ward",
			memberCodes: ["A", "B"],
			validity: { from: null, to: null },
			bbox: [0, 0, 1, 1],
		},
	],
};

const fixture = (context: { onTestFinished: (run: () => void) => void }) => {
	const root = mkdtempSync(join(tmpdir(), "build-intermediates-"));
	context.onTestFinished(() => {
		closeAllReadOnlyDatabases();
		rmSync(root, { recursive: true, force: true });
	});
	const artifacts = join(root, "data/build/artifacts");
	mkdirSync(join(artifacts, "areas/ward"), { recursive: true });
	mkdirSync(join(artifacts, "crosswalks"), { recursive: true });
	const write = (path: string, value: unknown) =>
		writeFileSync(join(artifacts, path), JSON.stringify(value));
	write("area-inventory.json", {
		schemaVersion: 1,
		contentHash: "sha256:inventory",
		boundaryRegistryHash: "sha256:registry",
		releases: [
			release("2024", areas2024.length),
			release("2025", areas2025.length),
			{
				id: "2026",
				geography: "ward",
				status: "not-compiled",
				reason: "No source",
			},
		],
	});
	for (const [id, areas] of [
		["2024", areas2024],
		["2025", areas2025],
	] as const)
		write(`areas/ward/${id}.json`, {
			schemaVersion: 1,
			contentHash: `sha256:${id}`,
			areas,
		});
	write(`crosswalks/${crosswalk.id}.json`, crosswalk);
	write("crosswalk-inventory.json", {
		schemaVersion: 1,
		contentHash: "sha256:crosswalks",
		crosswalks: [
			{
				id: crosswalk.id,
				from: crosswalk.from,
				to: crosswalk.to,
				method: crosswalk.method,
				quality: crosswalk.quality,
				weighting: crosswalk.weighting,
				recordCount: crosswalk.records.length,
				artifact: `crosswalks/${crosswalk.id}.json`,
				contentHash: crosswalk.contentHash,
			},
		],
	});
	write("named-locations.json", namedLocations);
	writeSqliteIndex(
		join(root, "data/build/atlas-base.sqlite"),
		{},
		{
			...areaTables(artifacts),
			...crosswalkTables(artifacts),
			...namedLocationTables(artifacts),
		},
	);
	// The reader must not need the JSON it was built from.
	rmSync(artifacts, { recursive: true });
	return root;
};

test("areas stream in inventory order with only the requested fields", (context) => {
	const root = fixture(context);
	assert.deepEqual(
		[...readAreas(root, { geography: "ward", release: "2024" })],
		areas2024,
	);
	assert.deepEqual(
		[
			...readAreas(root, {
				geography: "ward",
				release: "2024",
				fields: ["code"],
			}),
		],
		[{ code: "A" }, { code: "B" }, { code: "C" }],
	);
	assert.deepEqual(
		[
			...readAreas(root, {
				geography: "ward",
				release: "2025",
				fields: ["code", "name"],
			}),
		],
		areas2025,
	);
	assert.throws(
		() => [...readAreas(root, { geography: "ward", release: "2026" })],
		/Unknown area release ward\/2026/,
	);
});

test("an area release read is checked against the recorded count", (context) => {
	const root = fixture(context);
	const iterator = readAreas(root, { geography: "ward", release: "2024" });
	// Stopping early is not an error, and releases the connection.
	assert.equal(iterator.next().value?.code, "A");
	iterator.return(undefined);
});

test("area release artifacts match the compiled shape, one release at a time", (context) => {
	const root = fixture(context);
	const inventory = readAreaInventory(root);
	assert.equal(inventory.contentHash, "sha256:inventory");
	const artifacts = [...readAreaReleaseArtifacts(root, inventory)];
	assert.deepEqual(
		artifacts.map((artifact) => [
			artifact.geography,
			artifact.boundaryRelease,
			artifact.contentHash,
			artifact.areas.length,
		]),
		[
			["ward", "2024", "sha256:2024", 3],
			["ward", "2025", "sha256:2025", 2],
		],
	);
	assert.deepEqual(artifacts[0]!.areas, areas2024);
});

test("crosswalks are read by endpoints or id and rebuild the artifact", (context) => {
	const root = fixture(context);
	const inventory = readCrosswalkInventory(root);
	assert.equal(inventory.crosswalks.length, 1);
	const [byEndpoints] = readCrosswalk(
		root,
		{ geography: "ward", boundaryRelease: "2024" },
		{ geography: "ward", boundaryRelease: "2025" },
	);
	assert.deepEqual(byEndpoints, crosswalk);
	assert.deepEqual(
		[
			...readCrosswalk(
				root,
				{ geography: "ward", boundaryRelease: "2025" },
				{ geography: "ward", boundaryRelease: "2024" },
			),
		],
		[],
	);
	assert.deepEqual(
		readCrosswalkById(root, inventory.crosswalks[0]!),
		crosswalk,
	);
	assert.deepEqual([...readCrosswalks(root, inventory)], [crosswalk]);
	assert.throws(
		() =>
			readCrosswalkById(root, {
				...inventory.crosswalks[0]!,
				contentHash: "sha256:other",
			}),
		/Invalid crosswalk artifact/,
	);
});

test("named locations keep their members", (context) => {
	const root = fixture(context);
	const inventory = readNamedLocations(root);
	assert.equal(inventory.contentHash, "sha256:locations");
	assert.deepEqual(
		inventory.locations.map((location) => [
			location.id,
			location.memberCodes,
		]),
		[["north", ["A", "B"]]],
	);
});

test("a database path overrides the build database", (context) => {
	const root = fixture(context);
	const other = join(root, "elsewhere.sqlite");
	assert.throws(() => readAreaInventory(root, other));
});
