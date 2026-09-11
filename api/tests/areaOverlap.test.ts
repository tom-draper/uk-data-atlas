import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import type { Polygon } from "polygon-clipping";
import {
	compileAreaOverlapCrosswalk,
	polygonAreaM2,
	polygonWidthM,
	projectEqualArea,
} from "../src/areaOverlap";
import type { GeometrySourceLookup } from "../src/areaGeometry";
import { createAreaLookup } from "../src/areaInventory";
import type { AreaOverlapCrosswalkAdapter } from "../src/crosswalkAdapters";
import { compileCrosswalks } from "../src/crosswalkInventory";

// Squares near the equator, in degrees. D is about 1.1 km; SLIVER is about
// 5.6 m, the kind of disagreement two generalised boundaries leave behind.
const D = 0.01;
const SLIVER = 0.00005;

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
	codeProperty: string,
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
				properties: { [codeProperty]: code },
				geometry: { type: "Polygon", coordinates },
			})),
		}),
	);
};

// S1 spans T1 and T2 equally. S2 meets T2 only in a sliver, because T2's
// east edge overshoots S2's west edge by SLIVER, and otherwise lies in T3,
// which is published as two features.
const writeFixture = (root: string) => {
	writeCollection(root, "sources.geojson", "SRC", [
		["S1", box(0, 2 * D)],
		["S2", box(2 * D, 3 * D)],
	]);
	writeCollection(root, "targets.geojson", "TGT", [
		["T1", box(0, D)],
		["T2", box(D, 2 * D + SLIVER)],
		["T3", box(2 * D + SLIVER, 2.5 * D)],
		["T3", box(2.5 * D, 3 * D)],
	]);
};

const geometrySources = (crs = "EPSG:4326"): GeometrySourceLookup =>
	new Map([
		["source/1", { input: "sources.geojson", crs, codeProperty: "SRC" }],
		["target/1", { input: "targets.geojson", crs, codeProperty: "TGT" }],
	]);

const areaLookup = (targetCodes = ["T1", "T2", "T3"]) =>
	createAreaLookup([
		{
			schemaVersion: 1,
			contentHash: "sha256:sources",
			geography: "source",
			boundaryRelease: "1",
			codeProperty: "SRC",
			nameProperty: "SRCNM",
			areas: [
				{ code: "S1", name: "Source One" },
				{ code: "S2", name: "Source Two" },
			],
		},
		{
			schemaVersion: 1,
			contentHash: "sha256:targets",
			geography: "target",
			boundaryRelease: "1",
			codeProperty: "TGT",
			nameProperty: "TGTNM",
			areas: targetCodes.map((code) => ({
				code,
				name: `Target ${code}`,
			})),
		},
	]);

const adapter = (
	overrides: Partial<AreaOverlapCrosswalkAdapter> = {},
): AreaOverlapCrosswalkAdapter => ({
	id: "source-1-to-target-1-area-overlap",
	method: "area-overlap",
	quality: "derived",
	weighting: {
		status: "provided",
		basis: "area",
		normalisation: "per-source",
	},
	from: { geography: "source", boundaryRelease: "1" },
	to: { geography: "target", boundaryRelease: "1" },
	sliverWidthM: 100,
	minimumCoverage: 0.99,
	...overrides,
});

const withFixture = (run: (root: string) => void) => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		writeFixture(root);
		run(root);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
};

test("projects to an equal-area plane whose whole extent is the WGS 84 ellipsoid's area", () => {
	const [x, y] = projectEqualArea([180, 90]);
	// Published surface area of the WGS 84 ellipsoid.
	assert.ok(Math.abs((2 * x * 2 * y) / 510_065_621_724_089 - 1) < 1e-9);
});

test("measures a polygon's area on the ellipsoid and its strip width", () => {
	const square = box(0, D);
	// About 1113.2 m by 1105.7 m at the equator.
	assert.ok(Math.abs(polygonAreaM2(square) / 1_230_888 - 1) < 1e-4);
	// Twice a square's area over its perimeter is half its side.
	assert.ok(Math.abs(polygonWidthM(square) - 554.7) < 1);
});

test("weights each source's covered area and drops generalisation slivers", () => {
	withFixture((root) => {
		const artifact = compileAreaOverlapCrosswalk(
			root,
			adapter(),
			geometrySources(),
			areaLookup(),
		);
		assert.deepEqual(
			artifact.records.map((record) => ({
				source: record.source.code,
				labels: record.source.labels,
				targets: record.targets.map((target) => target.code),
			})),
			[
				{ source: "S1", labels: ["Source One"], targets: ["T1", "T2"] },
				{ source: "S2", labels: ["Source Two"], targets: ["T3"] },
			],
		);
		const [s1, s2] = artifact.records;
		assert.equal(s1.source.coverage, 1);
		assert.deepEqual(
			s1.targets.map((target) => [target.weight, target.sourceShare]),
			[
				[0.5, 0.5],
				[0.5, 0.5],
			],
		);
		assert.equal(s1.targets[0].targetShare, 1);
		// T2 is 0.5% wider than the part of it S1 covers.
		assert.equal(s1.targets[1].targetShare, 0.995025);
		// S2 loses its sliver in T2, so its single target carries all its
		// weight while its coverage admits the missing 0.5%.
		assert.equal(s2.targets[0].weight, 1);
		assert.equal(s2.source.coverage, 0.995);
		// T3's two features are measured as one area.
		assert.equal(s2.targets[0].targetShare, 1);
		assert.deepEqual(artifact.validation.endpoints, {
			from: {
				status: "verified",
				availableAreaCount: 2,
				referencedCodeCount: 2,
			},
			to: {
				status: "verified",
				availableAreaCount: 3,
				referencedCodeCount: 3,
			},
		});
		const overlap = artifact.validation.overlap;
		assert.equal(overlap.candidatePairCount, 4);
		assert.equal(overlap.intersectingPairCount, 4);
		assert.equal(overlap.sliverPairCount, 1);
		assert.ok(overlap.widestSliverWidthM !== null);
		assert.ok(Math.abs(overlap.widestSliverWidthM - 5.5) < 0.2);
		assert.ok(overlap.narrowestOverlapWidthM > 500);
		assert.equal(overlap.minimumSourceCoverage, 0.995);
		assert.equal(overlap.minimumTargetCoverage, 0.995025);
		assert.deepEqual(
			artifact.provenance.inputs.map(({ side, input }) => [side, input]),
			[
				["from", "sources.geojson"],
				["to", "targets.geojson"],
			],
		);
		assert.match(artifact.provenance.clipping, /^polygon-clipping@\d/);
		assert.match(artifact.contentHash, /^sha256:[a-f0-9]{64}$/);
		const again = compileAreaOverlapCrosswalk(
			root,
			adapter(),
			geometrySources(),
			areaLookup(),
		);
		assert.equal(again.contentHash, artifact.contentHash);
	});
});

test("fails when a pair sits too close to the sliver threshold", () => {
	withFixture((root) => {
		assert.throws(
			() =>
				compileAreaOverlapCrosswalk(
					root,
					adapter({ sliverWidthM: 10 }),
					geometrySources(),
					areaLookup(),
				),
			/sliver separation is ambiguous around 10 m/,
		);
	});
});

test("fails when an area is less covered than the adapter requires", () => {
	withFixture((root) => {
		assert.throws(
			() =>
				compileAreaOverlapCrosswalk(
					root,
					adapter({ minimumCoverage: 0.999 }),
					geometrySources(),
					areaLookup(),
				),
			/1 source areas are less than 0\.999 covered: S2 \(0\.9950\)/,
		);
	});
});

test("fails on geometry without a compiled identity or outside WGS84", () => {
	withFixture((root) => {
		assert.throws(
			() =>
				compileAreaOverlapCrosswalk(
					root,
					adapter(),
					geometrySources(),
					areaLookup(["T1", "T2"]),
				),
			/T3 has geometry but no compiled identity in target\/1/,
		);
		assert.throws(
			() =>
				compileAreaOverlapCrosswalk(
					root,
					adapter(),
					geometrySources("EPSG:27700"),
					areaLookup(),
				),
			/source\/1 geometry is EPSG:27700, not WGS84/,
		);
	});
});

test("requires the geometry source registry to compile an area-overlap adapter", () => {
	withFixture((root) => {
		assert.throws(
			() => compileCrosswalks(root, [adapter()], areaLookup()),
			/area-overlap crosswalks need the geometry source registry/,
		);
		const { inventory } = compileCrosswalks(
			root,
			[adapter()],
			areaLookup(),
			geometrySources(),
		);
		assert.deepEqual(inventory.crosswalks[0].weighting, {
			status: "provided",
			basis: "area",
			normalisation: "per-source",
		});
		assert.equal(inventory.crosswalks[0].recordCount, 2);
	});
});
