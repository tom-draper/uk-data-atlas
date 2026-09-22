import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import type { Polygon } from "polygon-clipping";
import type { GeometrySourceLookup } from "../src/areaGeometry";
import { createAreaLookup } from "../src/areaInventory";
import type { GeometricContainmentCrosswalkAdapter } from "../src/crosswalkAdapters";
import { compileCrosswalks } from "../src/crosswalkInventory";
import { measureContainment } from "../src/geometricContainment";

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
				properties: { CD: code },
				geometry: { type: "Polygon", coordinates },
			})),
		}),
	);
};

// Parents P1 and P2 divide the ground. C1 and C2 sit inside P1, C3 inside P2
// but 5.6 m over the line, which is how far two generalised borders drift.
// C4 straddles: a third of it is in P1 and the rest in P2.
const writeFixture = (root: string, straddling = true) => {
	writeCollection(root, "parents.geojson", [
		["P1", box(0, 2 * D)],
		["P2", box(2 * D, 4 * D)],
	]);
	writeCollection(root, "children.geojson", [
		["C1", box(0, D)],
		["C2", box(D, 2 * D)],
		["C3", box(1.995 * D, 3 * D)],
		...(straddling
			? ([["C4", box(1.7 * D, 2.6 * D)]] as Array<[string, Polygon]>)
			: []),
	]);
};

const geometrySources: GeometrySourceLookup = new Map([
	[
		"child/1",
		{ input: "children.geojson", crs: "EPSG:4326", codeProperty: "CD" },
	],
	[
		"parent/1",
		{ input: "parents.geojson", crs: "EPSG:4326", codeProperty: "CD" },
	],
]);

const areaLookup = createAreaLookup(
	(
		[
			["child", ["C1", "C2", "C3", "C4"]],
			["parent", ["P1", "P2"]],
		] as const
	).map(([geography, codes]) => ({
		schemaVersion: 1 as const,
		contentHash: `sha256:${geography}`,
		geography,
		boundaryRelease: "1",
		codeProperty: "CD",
		nameProperty: "NM",
		areas: codes.map((code) => ({ code, name: `Area ${code}` })),
	})),
);

const adapter: GeometricContainmentCrosswalkAdapter = {
	id: "child-1-to-parent-1-geometric-containment",
	method: "geometric-containment",
	quality: "derived",
	relationshipPurpose: "membership",
	weighting: { status: "not-applicable" },
	from: { geography: "child", boundaryRelease: "1" },
	to: { geography: "parent", boundaryRelease: "1" },
	sliverWidthM: 100,
};

const withFixture = (run: (root: string) => void, straddling = true) => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		writeFixture(root, straddling);
		run(root);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
};

const measure = (root: string, abandonAfter?: number) =>
	measureContainment(
		root,
		adapter.id,
		adapter.from,
		adapter.to,
		geometrySources,
		adapter.sliverWidthM,
		abandonAfter,
	);

test("places a child by what it leaves outside, not by the share inside", () => {
	withFixture((root) => {
		const measured = measure(root);
		assert.deepEqual(
			measured.areas.map(({ code, parent, relation }) => ({
				code,
				parent,
				relation,
			})),
			[
				{ code: "C1", parent: "P1", relation: "within" },
				{ code: "C2", parent: "P1", relation: "within" },
				// Over the line by a sliver, so still within its parent.
				{ code: "C3", parent: "P2", relation: "within" },
				{ code: "C4", parent: "P2", relation: "straddles" },
			],
		);
		const [, , c3, c4] = measured.areas;
		assert.ok(c3!.share < 1 && c3!.outsideWidthM < 50);
		// Two thirds of C4 is in P2, which a share of area would accept.
		assert.ok(c4!.share > 0.6 && c4!.outsideWidthM > 200);
	});
});

test("refuses to publish a hierarchy a child straddles", () => {
	withFixture((root) => {
		assert.throws(
			() =>
				compileCrosswalks(root, [adapter], areaLookup, geometrySources),
			/1 of 4 areas do not sit within one parent: C4 \(straddles, \d+(\.\d+)? m outside P2\)/,
		);
	});
});

test("publishes each child under its one parent, with the evidence", () => {
	withFixture((root) => {
		const [artifact] = compileCrosswalks(
			root,
			[adapter],
			areaLookup,
			geometrySources,
		).artifacts;
		assert.equal(artifact?.method, "geometric-containment");
		if (artifact?.method !== "geometric-containment") return;
		assert.deepEqual(
			artifact.records.map((record) => [
				record.source.code,
				record.targets[0]!.code,
			]),
			[
				["C1", "P1"],
				["C2", "P1"],
				["C3", "P2"],
			],
		);
		assert.equal(artifact.relationshipPurpose, "membership");
		assert.deepEqual(
			{
				...artifact.validation.containment,
				widestOutsideM:
					artifact.validation.containment.widestOutsideM < 50,
			},
			{
				sliverWidthM: 100,
				childCount: 3,
				parentCount: 2,
				childlessParentCount: 0,
				minimumContainedShare:
					artifact.validation.containment.minimumContainedShare,
				widestOutsideM: true,
			},
		);
	}, false);
});

test("gives up on a pair that is not a hierarchy", () => {
	withFixture((root) => {
		const measured = measure(root, 1);
		assert.equal(measured.abandoned?.after, 4);
		assert.match(
			measured.abandoned!.reason,
			/1 areas are not within one parent/,
		);
	});
});
