import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import type { Polygon } from "polygon-clipping";
import type { GeometrySourceLookup } from "../src/areaGeometry";
import { createAreaLookup } from "../src/areaInventory";
import { convertObservations } from "../src/conversion";
import type {
	AreaOverlapCrosswalkAdapter,
	PopulationOverlapCrosswalkAdapter,
} from "../src/crosswalkAdapters";
import { compileCrosswalks } from "../src/crosswalkInventory";

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

// Source S spans targets T1 and T2 equally by area. Block B1, all in T1, holds
// 900 people and B2, all in T2, 100; B3 straddles the border with 200. So by
// people T1 gets 900 + 100 of 1,200 and T2 100 + 100.
const writeFixture = (root: string, counts = "B1,900\nB2,100\nB3,200\n") => {
	writeCollection(root, "sources.geojson", [["S", box(0, 2 * D)]]);
	writeCollection(root, "targets.geojson", [
		["T1", box(0, D)],
		["T2", box(D, 2 * D)],
	]);
	writeCollection(root, "blocks.geojson", [
		["B1", box(0, 0.5 * D)],
		["B2", box(1.5 * D, 2 * D)],
		["B3", box(0.5 * D, 1.5 * D)],
	]);
	writeFileSync(join(root, "data", "people.csv"), `code,people\n${counts}`);
};

const geometrySources: GeometrySourceLookup = new Map([
	[
		"source/1",
		{ input: "sources.geojson", crs: "EPSG:4326", codeProperty: "CD" },
	],
	[
		"target/1",
		{ input: "targets.geojson", crs: "EPSG:4326", codeProperty: "CD" },
	],
	[
		"block/1",
		{ input: "blocks.geojson", crs: "EPSG:4326", codeProperty: "CD" },
	],
]);

const areaLookup = createAreaLookup(
	(
		[
			["source", ["S"]],
			["target", ["T1", "T2"]],
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

const areaOverlap: AreaOverlapCrosswalkAdapter = {
	id: "source-to-target-area-overlap",
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
};

const populationOverlap = (
	overrides: Partial<PopulationOverlapCrosswalkAdapter> = {},
): PopulationOverlapCrosswalkAdapter => ({
	id: "source-to-target-population-overlap",
	method: "population-overlap",
	quality: "derived",
	weighting: {
		status: "provided",
		basis: "population",
		normalisation: "per-source",
		population: "Usual residents",
		date: "2021-03-21",
		blocks: { geography: "block", boundaryRelease: "1" },
	},
	from: areaOverlap.from,
	to: areaOverlap.to,
	pairs: areaOverlap.id,
	population: {
		input: "people.csv",
		codeColumn: "code",
		valueColumn: "people",
	},
	minimumCoverage: 0.99,
	...overrides,
});

const withFixture = (run: (root: string) => void, counts?: string) => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		writeFixture(root, counts);
		run(root);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
};

const compile = (root: string, adapter = populationOverlap()) =>
	compileCrosswalks(root, [areaOverlap, adapter], areaLookup, geometrySources)
		.artifacts;

test("weights each pair by the people its blocks put there, not its land", () => {
	withFixture((root) => {
		const [area, people] = compile(root);
		assert.deepEqual(
			area?.records[0]?.targets.map(
				(target) => (target as { weight: number }).weight,
			),
			[0.5, 0.5],
		);
		assert.equal(people?.method, "population-overlap");
		if (people?.method !== "population-overlap") return;
		const [record] = people.records;
		assert.deepEqual(record?.source, {
			code: "S",
			labels: ["Area S"],
			population: 1200,
			coverage: 1,
		});
		assert.deepEqual(
			record?.targets.map(
				({ code, weight, population, sourceShare, targetShare }) => ({
					code,
					weight,
					population,
					sourceShare,
					targetShare,
				}),
			),
			[
				{
					code: "T1",
					weight: 0.833333,
					population: 1000,
					sourceShare: 0.833333,
					targetShare: 1,
				},
				{
					code: "T2",
					weight: 0.166667,
					population: 200,
					sourceShare: 0.166667,
					targetShare: 1,
				},
			],
		);
		assert.deepEqual(
			{
				...people.validation.population,
				unmeasuredBlocks:
					people.validation.population.unmeasuredBlocks.length,
			},
			{
				minimumCoverage: 0.99,
				blockCount: 3,
				blockPopulation: 1200,
				assignedPopulation: 1200,
				sliverPopulation: 0,
				outsidePopulation: 0,
				unmeasuredBlocks: 0,
				minimumSourceCoverage: 1,
			},
		);
		assert.equal(people.provenance.pairs.crosswalkId, area?.id);
		assert.equal(people.weighting.date, "2021-03-21");
	});
});

test("names a conversion through it population-weighted", () => {
	withFixture((root) => {
		const [, people] = compile(root);
		const converted = convertObservations(people!, [
			{ areaCode: "S", value: 600 } as never,
		]);
		assert.equal(converted.status, "converted");
		if (converted.status !== "converted") return;
		assert.equal(converted.method, "population-weighted");
		assert.deepEqual(
			converted.records.map(({ areaCode, value }) => [
				areaCode,
				Math.round(value),
			]),
			[
				["T1", 500],
				["T2", 100],
			],
		);
	});
});

test("refuses blocks and counts that disagree, and pairs that are not an area overlap", () => {
	withFixture((root) => {
		assert.throws(
			() => compile(root),
			/blocks and population disagree: 1 blocks have no count \(B3\)/,
		);
	}, "B1,900\nB2,100\n");
	withFixture((root) => {
		assert.throws(
			() => compile(root, populationOverlap({ pairs: "missing" })),
			/missing must be a compiled area-overlap crosswalk/,
		);
	});
});
