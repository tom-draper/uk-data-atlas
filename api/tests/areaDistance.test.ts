import assert from "node:assert/strict";
import test from "node:test";
import {
	distanceToBoundaryM,
	distanceToBoundsM,
	distanceToGeometryM,
	metresPerDegree,
} from "../src/areaDistance";

const square = {
	type: "Polygon",
	coordinates: [
		[
			[0, 0],
			[0.01, 0],
			[0.01, 0.01],
			[0, 0.01],
			[0, 0],
		],
	],
};

test("scales degrees to ground metres by latitude", () => {
	const equator = metresPerDegree(0);
	assert.ok(Math.abs(equator.longitude - 111319.5) < 0.1);
	assert.ok(Math.abs(equator.latitude - 110574.3) < 0.1);
	// A degree of longitude at Leeds is a little over half its equatorial length.
	assert.ok(Math.abs(metresPerDegree(53.8).longitude - 65889.7) < 1);
});

test("measures to the nearest edge, and to nothing from inside", () => {
	assert.ok(
		Math.abs(distanceToBoundaryM([0.005, 0.005], square) - 552.9) < 0.1,
	);
	assert.equal(distanceToGeometryM([0.005, 0.005], square), 0);
	assert.equal(distanceToGeometryM([0.01, 0.005], square), 0);
	assert.ok(
		Math.abs(distanceToGeometryM([0.015, 0.005], square) - 556.6) < 0.1,
	);
	// Beyond a corner, the corner itself is nearest.
	assert.ok(
		Math.abs(distanceToGeometryM([0.015, 0.015], square) - 784.6) < 0.1,
	);
});

test("never puts a bounding box further away than what it bounds", () => {
	const bounds: [number, number, number, number] = [0, 0, 0.01, 0.01];
	for (const point of [
		[0.015, 0.005],
		[0.015, 0.015],
		[-0.02, -0.03],
		[0.005, 0.005],
	] as Array<[number, number]>)
		assert.ok(
			distanceToBoundsM(point, bounds) <=
				distanceToGeometryM(point, square) + 1e-9,
		);
});
