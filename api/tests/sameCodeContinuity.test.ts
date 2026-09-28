import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import type { Polygon } from "polygon-clipping";
import type { GeometrySourceLookup } from "../src/areaGeometry";
import { createAreaLookup } from "../src/areaInventory";
import { createAreaRelationshipIndex } from "../src/areaRelationships";
import {
	readCrosswalkAdapters,
	type SameCodeContinuityCrosswalkAdapter,
} from "../src/crosswalkAdapters";
import { compileCrosswalks } from "../src/crosswalkInventory";
import { compileRelationshipPaths } from "../src/relationshipPaths";
import { compileSameCodeContinuityCrosswalk } from "../src/sameCodeContinuity";

// Squares near the equator, in degrees; D is about 1.1 km.
const D = 0.01;

const box = (west: number, east: number): Polygon => [
	[
		[west, 0],
		[east, 0],
		[east, D],
		[west, D],
		[west, 0],
	],
];

const writeCollection = (
	root: string,
	path: string,
	features: Array<[string, Polygon]>,
) => {
	const file = join(root, "data", path);
	mkdirSync(join(file, ".."), { recursive: true });
	writeFileSync(
		file,
		JSON.stringify({
			type: "FeatureCollection",
			features: features.map(([code, coordinates]) => ({
				type: "Feature",
				properties: { WDCD: code },
				geometry: { type: "Polygon", coordinates },
			})),
		}),
	);
};

// Widths are twice area over perimeter. W1 keeps its code while renamed, its
// east edge 5.6 m out: generalisation noise. W5 shifts 22 m east, a sliver on
// each side though 2% of its area. W2 loses a strip that measures 101 m,
// where the build will not decide, and W6 one that measures 256 m, a boundary
// that moved. W3 is abolished and W4 is new.
const writeFixture = (root: string) => {
	writeCollection(root, "ward-1.geojson", [
		["W1", box(0, D)],
		["W2", box(D, 2 * D)],
		["W3", box(2 * D, 3 * D)],
		["W5", box(4 * D, 5 * D)],
		["W6", box(6 * D, 7 * D)],
	]);
	writeCollection(root, "ward-2.geojson", [
		["W1", box(0, 1.005 * D)],
		["W2", box(1.005 * D, 1.9 * D)],
		["W4", box(3 * D, 4 * D)],
		["W5", box(4.02 * D, 5.02 * D)],
		["W6", box(6 * D, 6.7 * D)],
	]);
};

const geometrySources: GeometrySourceLookup = new Map([
	[
		"ward/1",
		{ input: "ward-1.geojson", crs: "EPSG:4326", codeProperty: "WDCD" },
	],
	[
		"ward/2",
		{ input: "ward-2.geojson", crs: "EPSG:4326", codeProperty: "WDCD" },
	],
]);

const areaLookup = createAreaLookup([
	{
		schemaVersion: 1,
		contentHash: "sha256:ward-1",
		geography: "ward",
		boundaryRelease: "1",
		codeProperty: "WDCD",
		nameProperty: "WDNM",
		areas: [
			{ code: "W1", name: "Ward One" },
			{ code: "W2", name: "Ward Two" },
			{ code: "W3", name: "Ward Three" },
			{ code: "W5", name: "Ward Five" },
			{ code: "W6", name: "Ward Six" },
		],
	},
	{
		schemaVersion: 1,
		contentHash: "sha256:ward-2",
		geography: "ward",
		boundaryRelease: "2",
		codeProperty: "WDCD",
		nameProperty: "WDNM",
		areas: [
			{ code: "W1", name: "Ward One North" },
			{ code: "W2", name: "Ward Two" },
			{ code: "W4", name: "Ward Four" },
			{ code: "W5", name: "Ward Five" },
			{ code: "W6", name: "Ward Six" },
		],
	},
]);

const adapter: SameCodeContinuityCrosswalkAdapter = {
	id: "ward-1-to-2-same-code-continuity",
	method: "same-code-continuity",
	quality: "derived",
	relationshipPurpose: "identity",
	weighting: { status: "not-applicable" },
	from: { geography: "ward", boundaryRelease: "1" },
	to: { geography: "ward", boundaryRelease: "2" },
	sliverWidthM: 100,
};

const withFixture = (run: (root: string) => void) => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		writeFixture(root);
		run(root);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
};

test("publishes a shared code as identity only where its extent held", () => {
	withFixture((root) => {
		const artifact = compileSameCodeContinuityCrosswalk(
			root,
			adapter,
			geometrySources,
			areaLookup,
		);
		assert.deepEqual(artifact.records, [
			{
				source: { code: "W1", labels: ["Ward One"] },
				targets: [
					{
						code: "W1",
						labels: ["Ward One North"],
						widestDifferenceM: 5.5,
						sourceShare: 1,
						targetShare: 0.995025,
					},
				],
			},
			{
				source: { code: "W5", labels: ["Ward Five"] },
				targets: [
					{
						code: "W5",
						labels: ["Ward Five"],
						widestDifferenceM: 21.8,
						sourceShare: 0.98,
						targetShare: 0.98,
					},
				],
			},
		]);
		assert.deepEqual(artifact.validation.continuity, {
			sliverWidthM: 100,
			sourceAreaCount: 5,
			targetAreaCount: 5,
			sharedCodeCount: 4,
			continuousCount: 2,
			changedExtent: [
				{
					code: "W6",
					relation: "changed",
					widestDifferenceM: 256.5,
					sourceShare: 0.7,
					targetShare: 1,
				},
				{
					code: "W2",
					relation: "indeterminate",
					widestDifferenceM: 101.1,
					sourceShare: 0.895,
					targetShare: 1,
				},
			],
			unmeasured: [],
		});
		assert.equal(artifact.relationshipPurpose, "identity");
		assert.equal(artifact.validation.endpoints.to.status, "verified");
		assert.equal(artifact.provenance.areaProjection, "EPSG:6933");
	});
});

test("compiles through the inventory as a derived identity path of history", () => {
	withFixture((root) => {
		const { inventory, artifacts } = compileCrosswalks(
			root,
			[adapter],
			areaLookup,
			geometrySources,
		);
		const paths = compileRelationshipPaths(inventory).paths;
		assert.deepEqual(
			paths.map((path) => [path.id, path.purpose, path.quality]),
			[
				[`${adapter.id}/forward/identity`, "identity", "derived"],
				[`${adapter.id}/reverse/identity`, "identity", "derived"],
			],
		);
		const index = createAreaRelationshipIndex(artifacts);
		assert.deepEqual(
			index
				.get("ward/1/W1")
				?.map(({ relation, counterpart }) => [
					relation,
					counterpart.id,
				]),
			[["successor", "ward/2/W1"]],
		);
		assert.equal(index.get("ward/1/W2"), undefined);
	});
});

test("refuses to compile same-code continuity without geometry", () => {
	assert.throws(
		() => compileCrosswalks(".", [adapter], areaLookup),
		/same-code-continuity crosswalks need the geometry source registry/,
	);
});

test("reads a same-code adapter only between two releases of one geography", () => {
	const directory = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	const read = (crosswalks: unknown[]) => {
		const path = join(directory, "crosswalk-adapters.json");
		writeFileSync(path, JSON.stringify({ schemaVersion: 1, crosswalks }));
		return readCrosswalkAdapters(path);
	};
	try {
		assert.deepEqual(read([adapter]), [adapter]);
		for (const invalid of [
			{
				...adapter,
				to: { geography: "localAuthority", boundaryRelease: "2" },
			},
			{ ...adapter, to: adapter.from },
			{ ...adapter, quality: "publisher-supplied" },
			{ ...adapter, relationshipPurpose: "membership" },
			{ ...adapter, sliverWidthM: 0 },
			{ ...adapter, sliverWidthM: undefined, minimumCoverage: 0.99 },
		]) {
			assert.throws(() => read([invalid]), /Invalid crosswalk adapter/);
		}
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
