import assert from "node:assert/strict";
import test from "node:test";
import { SpatialQueries } from "@uk-data-atlas/geometry";
import type { GeoJsonGeometry } from "@uk-data-atlas/geography/geometry-types";
import type { GeometryBounds } from "@uk-data-atlas/geography/geometry-point-containment";

const bounds = new Map<string, GeometryBounds>([
	["A", [0, 0, 1, 1]],
	["B", [1, 0, 2, 1]],
]);
const geometry = new Map<string, GeoJsonGeometry>([
	[
		"A",
		{
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
		},
	],
	[
		"B",
		{
			type: "Polygon",
			coordinates: [
				[
					[1, 0],
					[2, 0],
					[2, 1],
					[1, 1],
					[1, 0],
				],
			],
		},
	],
]);

test("spatial queries use a supplied in-memory release", () => {
	const reads: string[] = [];
	const queries = new SpatialQueries({
		candidates: () => bounds.keys(),
		bounds: (code) => bounds.get(code),
		geometry: (code) => {
			reads.push(code);
			return geometry.get(code);
		},
	});
	assert.deepEqual(queries.findContaining([0.5, 0.5]), [
		{ code: "A", containment: "interior" },
	]);
	assert.deepEqual(
		queries
			.findIntersecting([-0.5, -0.5, 2.5, 1.5])
			.map((area) => [area.code, area.relation]),
		[
			["A", "within"],
			["B", "within"],
		],
	);
	assert.deepEqual(
		queries.findNearest([0.5, 0.5], 10).map((area) => area.code),
		["A"],
	);
	assert.deepEqual(
		queries.findNeighbours("A")?.map((area) => [area.code, area.touch]),
		[["B", "edge"]],
	);
	assert.equal(queries.findNeighbours("missing"), undefined);
	assert.ok(reads.includes("A") && reads.includes("B"));
});
