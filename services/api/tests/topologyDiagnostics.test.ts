import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AreaGeometryCache, type GeoJsonGeometry } from "../src/areaGeometry";
import { decomposeArcs } from "@uk-data-atlas/map-tiles/arcs";
import { compileMapResource } from "../../../pipeline/src/compileMapResource";

const left: GeoJsonGeometry = {
	type: "Polygon",
	coordinates: [
		[
			[-1, 0],
			[0, 0],
			[0, 1],
			[-1, 1],
			[-1, 0],
		],
	],
};
const right: GeoJsonGeometry = {
	type: "Polygon",
	coordinates: [
		[
			[0, 0],
			[1, 0],
			[1, 1],
			[0, 1],
			[0, 0],
		],
	],
};
const spike: GeoJsonGeometry = {
	type: "Polygon",
	coordinates: [
		[
			[0, 0],
			[0, 1],
			[0, 0],
			[0, 0],
		],
	],
};

const assertCompilationError = (
	areas: Map<string, GeoJsonGeometry>,
	expectedError: string,
) => {
	const root = mkdtempSync(join(tmpdir(), "topology-diagnostics-"));
	try {
		mkdirSync(join(root, "data/source"), { recursive: true });
		writeFileSync(
			join(root, "data/source/boundaries.geojson"),
			JSON.stringify({
				type: "FeatureCollection",
				features: [...areas].map(([code, geometry]) => ({
					type: "Feature",
					properties: { code },
					geometry,
				})),
			}),
		);
		const cache = new AreaGeometryCache(
			root,
			new Map([
				[
					"ward/test",
					{
						input: "boundaries.geojson",
						crs: "EPSG:4326",
						codeProperty: "code",
					},
				],
			]),
		);
		assert.throws(
			() =>
				compileMapResource(
					cache,
					{
						geography: "ward",
						id: "test",
						title: "Test wards",
						source: {
							publisher: "Test",
							url: "https://example.com",
							licence: { name: "Test" },
						},
					},
					new Map(),
					"test.pmtiles",
				),
			(error: unknown) => {
				assert.ok(error instanceof Error);
				assert.equal(error.message, expectedError);
				return true;
			},
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
};

for (const order of ["first", "last"]) {
	test(`counts an over-shared edge once with the spike triangle ${order}`, () => {
		const areas = new Map<string, GeoJsonGeometry>(
			order === "first"
				? [
						["spike", spike],
						["left", left],
						["right", right],
					]
				: [
						["left", left],
						["right", right],
						["spike", spike],
					],
		);
		const topology = decomposeArcs(areas);
		assert.equal(topology.overlappingEdges, 1);
		assert.deepEqual(topology.overlappingAreaCodes, [
			"left",
			"right",
			"spike",
		]);
		assertCompilationError(
			areas,
			"ward/test is not a coverage: 1 edges lie on more than two areas, so it cannot be tiled without drawing one over another. Offending area codes: left, right, spike.",
		);
	});
}

test("does not count a repeated edge owned by only two areas as an overlap", () => {
	const topology = decomposeArcs(
		new Map([
			["left", left],
			["spike", spike],
		]),
	);
	assert.equal(topology.overlappingEdges, 0);
	assert.deepEqual(topology.overlappingAreaCodes, []);
});

test("counts each edge once across many owners and caps compilation diagnostics", () => {
	const areas = new Map(
		Array.from(
			{ length: 25 },
			(_, index) => [`W${String(index).padStart(2, "0")}`, left] as const,
		),
	);
	const topology = decomposeArcs(areas);
	assert.equal(topology.overlappingEdges, 4);
	assert.deepEqual(topology.overlappingAreaCodes, [...areas.keys()]);
	assertCompilationError(
		areas,
		"ward/test is not a coverage: 4 edges lie on more than two areas, so it cannot be tiled without drawing one over another. Offending area codes: W00, W01, W02, W03, W04, W05, W06, W07, W08, W09, W10, W11, W12, W13, W14, W15, W16, W17, W18, W19, ... (5 more).",
	);
});
