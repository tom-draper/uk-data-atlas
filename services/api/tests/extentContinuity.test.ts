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
	type ExtentContinuityCrosswalkAdapter,
} from "../src/crosswalkAdapters";
import { compileCrosswalks } from "../src/crosswalkInventory";
import { createGeographyResolver } from "../src/geographyResolver";
import {
	compileRelationshipPaths,
	createRelationshipPathIndex,
	crosswalkShape,
} from "../src/relationshipPaths";
import {
	compileExtentContinuityCrosswalk,
	MINIMUM_NOISE_SAMPLE,
} from "../src/extentContinuity";

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
// each side though 2% of its area. W2 loses a strip that measures 101 m to
// the new W4, where the build will not decide, and W6 one that measures 256 m
// to the new W7, a boundary that moved. W8 loses a strip as wide that no area
// takes, as a coast one outline draws and the next leaves out. W3 is
// abolished. W9 loses a strip that measures 97 m to the new W10, but keeps
// 90% of its extent: not identity, but realigned.
const writeFixture = (root: string) => {
	writeCollection(root, "ward-1.geojson", [
		["W1", box(0, D)],
		["W2", box(D, 2 * D)],
		["W3", box(2 * D, 3 * D)],
		["W5", box(4 * D, 5 * D)],
		["W6", box(6 * D, 7 * D)],
		["W8", box(8 * D, 9 * D)],
		["W9", box(10 * D, 11 * D)],
	]);
	writeCollection(root, "ward-2.geojson", [
		["W1", box(0, 1.005 * D)],
		["W2", box(1.005 * D, 1.9 * D)],
		["W4", box(1.9 * D, 4 * D)],
		["W5", box(4.02 * D, 5.02 * D)],
		["W6", box(6 * D, 6.7 * D)],
		["W7", box(6.7 * D, 7 * D)],
		["W8", box(8 * D, 8.7 * D)],
		["W9", box(10 * D, 10.905 * D)],
		["W10", box(10.905 * D, 11 * D)],
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
			{ code: "W8", name: "Ward Eight" },
			{ code: "W9", name: "Ward Nine" },
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
			{ code: "W7", name: "Ward Seven" },
			{ code: "W8", name: "Ward Eight" },
			{ code: "W9", name: "Ward Nine" },
			{ code: "W10", name: "Ward Ten" },
		],
	},
]);

const adapter: ExtentContinuityCrosswalkAdapter = {
	id: "ward-1-to-2-extent-continuity",
	method: "extent-continuity",
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
		const artifact = compileExtentContinuityCrosswalk(
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
						match: "same-code",
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
						match: "same-code",
						widestDifferenceM: 21.8,
						sourceShare: 0.98,
						targetShare: 0.98,
					},
				],
			},
			{
				source: { code: "W8", labels: ["Ward Eight"] },
				targets: [
					{
						code: "W8",
						labels: ["Ward Eight"],
						match: "same-code",
						widestDifferenceM: 256.5,
						claimedDifferenceM: 0,
						sourceShare: 0.7,
						targetShare: 1,
					},
				],
			},
		]);
		assert.deepEqual(artifact.validation.continuity, {
			sliverWidthM: 100,
			differenceRule: "claimed-by-another-area",
			sourceAreaCount: 7,
			targetAreaCount: 9,
			sharedCodeCount: 6,
			continuousCount: 3,
			changedExtent: [
				{
					code: "W6",
					relation: "changed",
					widestDifferenceM: 256.5,
					claimedDifferenceM: 256.5,
					sourceShare: 0.7,
					targetShare: 1,
				},
				{
					code: "W2",
					relation: "indeterminate",
					widestDifferenceM: 101.1,
					claimedDifferenceM: 101.1,
					sourceShare: 0.895,
					targetShare: 1,
				},
				{
					code: "W9",
					relation: "indeterminate",
					widestDifferenceM: 96.5,
					claimedDifferenceM: 96.5,
					sourceShare: 0.905,
					targetShare: 1,
				},
			],
			unmeasured: [],
			recoded: {
				status: "not-compared",
				reason: "Only 3 same-code pairs were published, fewer than the 50 needed to measure how far the releases' generalisation drifts.",
			},
			realignedShare: 0.9,
			realigned: [
				{
					code: "W9",
					successor: "W9",
					match: "same-code",
					widestDifferenceM: 96.5,
					sourceShare: 0.905,
					targetShare: 1,
				},
			],
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
			[["equivalent-to", "ward/2/W1"]],
		);
		assert.equal(index.get("ward/1/W2"), undefined);
	});
});

test("refuses to compile extent continuity without geometry", () => {
	assert.throws(
		() => compileCrosswalks(".", [adapter], areaLookup),
		/extent-continuity crosswalks need the geometry source registry/,
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

// A row of squares, each D high, starting `row` squares north of the equator.
const rect = (west: number, east: number, row: number): Polygon => [
	[
		[west, row * D],
		[east, row * D],
		[east, (row + 1) * D],
		[west, (row + 1) * D],
		[west, row * D],
	],
];

// Sixty wards keep their codes into release 2, each drifting 5.5 m as W1 does
// above: the releases' generalisation noise. Beside them, R1 is renumbered N1
// with its extent unchanged, R2 is renumbered N2 but 22 m east, R3's extent is
// shared by two new codes, N3A and N3B, and R4 is merged into the larger N4.
const unchanged = Array.from(
	{ length: MINIMUM_NOISE_SAMPLE + 10 },
	(_, index) => `U${index}`,
);
const recodedReleases: Record<string, Array<[string, Polygon]>> = {
	"1": [
		...unchanged.map((code, index): [string, Polygon] => [
			code,
			rect(index * 2 * D, (index * 2 + 1) * D, 2),
		]),
		["R1", rect(0, D, 4)],
		["R2", rect(2 * D, 3 * D, 4)],
		["R3", rect(4 * D, 5 * D, 4)],
		["R4", rect(6 * D, 7 * D, 4)],
	],
	"2": [
		...unchanged.map((code, index): [string, Polygon] => [
			code,
			rect(index * 2 * D, (index * 2 + 1.005) * D, 2),
		]),
		["N1", rect(0, D, 4)],
		["N2", rect(2.02 * D, 3.02 * D, 4)],
		["N3A", rect(4 * D, 5 * D, 4)],
		["N3B", rect(4 * D, 5 * D, 4)],
		["N4", rect(6 * D, 8 * D, 4)],
	],
};
// Release 3 is release 2 again, so N1 keeps its code into it.
recodedReleases["3"] = recodedReleases["2"]!;

const recodedSources: GeometrySourceLookup = new Map(
	Object.keys(recodedReleases).map((release) => [
		`ward/${release}`,
		{
			input: `ward-${release}.geojson`,
			crs: "EPSG:4326",
			codeProperty: "WDCD",
		},
	]),
);

const recodedLookup = createAreaLookup(
	Object.entries(recodedReleases).map(([release, features]) => ({
		schemaVersion: 1 as const,
		contentHash: `sha256:ward-${release}`,
		geography: "ward",
		boundaryRelease: release,
		codeProperty: "WDCD",
		nameProperty: "WDNM",
		areas: features.map(([code]) => ({ code, name: code })),
	})),
);

const continuity = (
	from: string,
	to: string,
): ExtentContinuityCrosswalkAdapter => ({
	...adapter,
	id: `ward-${from}-to-${to}-extent-continuity`,
	from: { geography: "ward", boundaryRelease: from },
	to: { geography: "ward", boundaryRelease: to },
});

const withRecodedFixture = (run: (root: string) => void) => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		for (const [release, features] of Object.entries(recodedReleases))
			writeCollection(root, `ward-${release}.geojson`, features);
		run(root);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
};

test("carries a renumbered area on only where its extent matches within the releases' noise", () => {
	withRecodedFixture((root) => {
		const artifact = compileExtentContinuityCrosswalk(
			root,
			continuity("1", "2"),
			recodedSources,
			recodedLookup,
		);
		const recoded = artifact.records.filter(
			(record) => record.targets[0]?.match === "recoded",
		);
		assert.deepEqual(recoded, [
			{
				source: { code: "R1", labels: ["R1"] },
				targets: [
					{
						code: "N1",
						labels: ["N1"],
						match: "recoded",
						widestDifferenceM: 0,
						sourceShare: 1,
						targetShare: 1,
					},
				],
			},
		]);
		assert.equal(
			artifact.validation.continuity.continuousCount,
			unchanged.length,
		);
		assert.deepEqual(artifact.validation.continuity.recoded, {
			status: "compared",
			widthCeilingM: 5.5,
			noiseSampleCount: unchanged.length,
			retiredCodeCount: 4,
			introducedCodeCount: 5,
			matchedCount: 1,
			ambiguous: [{ code: "R3", candidates: ["N3A", "N3B"] }],
			nearMisses: [
				{
					code: "R2",
					candidate: "N2",
					widestDifferenceM: 21.8,
					sourceShare: 0.98,
					targetShare: 0.98,
				},
			],
			unmeasured: [],
		});
		// R2 is realigned; R3 has two close candidates, so is not.
		assert.deepEqual(artifact.validation.continuity.realigned, [
			{
				code: "R2",
				successor: "N2",
				match: "recoded",
				widestDifferenceM: 21.8,
				sourceShare: 0.98,
				targetShare: 0.98,
			},
		]);
		assert.equal(artifact.validation.endpoints.to.status, "verified");
	});
});

test("translates a renumbered area through a chain of releases as one identity", () => {
	withRecodedFixture((root) => {
		const { inventory, artifacts } = compileCrosswalks(
			root,
			[continuity("1", "2"), continuity("2", "3")],
			recodedLookup,
			recodedSources,
		);
		const resolver = createGeographyResolver({
			areaLookup: recodedLookup,
			crosswalkLookup: new Map(
				artifacts.map((artifact) => [artifact.id, artifact]),
			),
			relationshipPathIndex: createRelationshipPathIndex(
				compileRelationshipPaths(inventory, [], {
					shapes: new Map(
						artifacts.map((artifact) => [
							artifact.id,
							crosswalkShape(artifact),
						]),
					),
					maximumSteps: 8,
				}),
			),
		});
		const translate = (code: string) =>
			resolver
				.translateArea(
					{ geography: "ward", boundaryRelease: "1", code },
					{ geography: "ward", boundaryRelease: "3" },
					"identity",
				)
				.map((translation) =>
					translation.targets.map(({ code }) => code),
				);
		assert.deepEqual(translate("R1"), [["N1"]]);
		assert.deepEqual(translate("U0"), [["U0"]]);
		// Neither a near miss nor an ambiguous extent is carried on.
		assert.deepEqual(translate("R2"), []);
		assert.deepEqual(translate("R3"), []);
		const index = createAreaRelationshipIndex(artifacts);
		assert.deepEqual(
			index
				.get("ward/1/R1")
				?.map(({ relation, counterpart }) => [
					relation,
					counterpart.id,
				]),
			[["equivalent-to", "ward/2/N1"]],
		);
		// Equivalent extent continuity carries an area's history on, but an
		// ambiguous extent or a merger does not.
		const successor = (code: string, from: string, to: string) =>
			resolver.successorArea(
				{ geography: "ward", boundaryRelease: from, code },
				{ geography: "ward", boundaryRelease: to },
			);
		assert.deepEqual(
			[successor("R1", "1", "3"), successor("R2", "1", "3")].map(
				(answer) => answer && [answer.code, answer.realigned],
			),
			[
				["N1", false],
				["N2", true],
			],
		);
		assert.equal(successor("N2", "3", "1")?.code, "R2");
		assert.equal(successor("R3", "1", "3"), undefined);
		assert.equal(successor("R4", "1", "3"), undefined);
		assert.equal(
			resolver.sameArea(
				{ geography: "ward", boundaryRelease: "1", code: "R2" },
				{ geography: "ward", boundaryRelease: "3" },
			),
			undefined,
		);
	});
});
