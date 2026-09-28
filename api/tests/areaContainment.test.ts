import assert from "node:assert/strict";
import test from "node:test";
import {
	containPoint,
	geometryBounds,
	pointInBounds,
} from "../src/areaContainment";

const polygonWithHole = {
	type: "Polygon",
	coordinates: [
		[
			[0, 0],
			[4, 0],
			[4, 4],
			[0, 4],
			[0, 0],
		],
		[
			[1, 1],
			[3, 1],
			[3, 3],
			[1, 3],
			[1, 1],
		],
	],
};

test("distinguishes polygon interiors, holes and boundary rings", () => {
	assert.equal(containPoint([0.5, 0.5], polygonWithHole), "interior");
	assert.equal(containPoint([2, 2], polygonWithHole), "outside");
	assert.equal(containPoint([1, 2], polygonWithHole), "boundary");
	assert.equal(containPoint([0, 2], polygonWithHole), "boundary");
	assert.equal(containPoint([5, 2], polygonWithHole), "outside");
});

test("finds a point in any polygon fragment and prefers interior to boundary", () => {
	const geometry = {
		type: "GeometryCollection",
		geometries: [
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
			{
				type: "MultiPolygon",
				coordinates: [
					[
						[
							[1, 0],
							[2, 0],
							[2, 1],
							[1, 1],
							[1, 0],
						],
					],
				],
			},
		],
	};
	assert.equal(containPoint([1, 0.5], geometry), "boundary");
	assert.equal(containPoint([1.5, 0.5], geometry), "interior");
});

test("builds a geometry bounding box before exact containment", () => {
	const bounds = geometryBounds(polygonWithHole);
	assert.deepEqual(bounds, [0, 0, 4, 4]);
	assert.equal(
		pointInBounds([4, 2], bounds as [number, number, number, number]),
		true,
	);
	assert.equal(
		pointInBounds([4.1, 2], bounds as [number, number, number, number]),
		false,
	);
});
