import assert from "node:assert/strict";
import { test } from "vitest";
import { distanceToBoundaryM } from "@uk-data-atlas/geography";
import { containPoint } from "@uk-data-atlas/geography";
import type { GeoJsonGeometry } from "@uk-data-atlas/geometry";
import {
	placePoints,
	toCentimetres,
} from "../src/postcodes/postcodeAreaCompiler";
import { checkPlacements } from "../src/checks/verifyPostcodeAreas";

const square = (
	west: number,
	south: number,
	east: number,
	north: number,
): GeoJsonGeometry => ({
	type: "Polygon",
	coordinates: [
		[
			[west, south],
			[east, south],
			[east, north],
			[west, north],
			[west, south],
		],
	],
});

const areas: Record<string, GeoJsonGeometry> = {
	W1: square(-1, 50, 0, 51),
	E1: square(0, 50, 1, 51),
};
const points: Array<[number, number]> = [
	[-0.8, 50.2], // west
	[0.3, 50.7], // east
	[0, 50.5], // on the shared edge, so in several areas
	[3, 3], // nowhere
];

/** What a live containment test finds, in the form the stored placements take. */
const live = (_at: number, point: [number, number]) =>
	Object.entries(areas)
		.sort(([left], [right]) => (left < right ? -1 : 1))
		.flatMap(([code, geometry]) => {
			const containment = containPoint(point, geometry);
			return containment === "outside"
				? []
				: [
						[
							code,
							containment,
							toCentimetres(distanceToBoundaryM(point, geometry)),
						] as [string, string, number],
					];
		});

const placed = () => {
	const longitudes = Float64Array.from(points.map(([x]) => x));
	const latitudes = Float64Array.from(points.map(([, y]) => y));
	return {
		longitudes,
		latitudes,
		placements: placePoints(
			longitudes,
			latitudes,
			Object.keys(areas),
			(code) => areas[code],
		),
	};
};

test("accepts placements a live lookup agrees with, checking every postcode in several areas", () => {
	const { longitudes, latitudes, placements } = placed();
	// Every fourth point, here just the first, and the one on the shared edge.
	assert.equal(
		checkPlacements(
			"ward/2026",
			placements,
			longitudes,
			latitudes,
			live,
			4,
		),
		2,
	);
	assert.equal(
		checkPlacements(
			"ward/2026",
			placements,
			longitudes,
			latitudes,
			live,
			1,
		),
		points.length + 1,
	);
});

test("skips postcodes with no centroid", () => {
	const { longitudes, latitudes, placements } = placed();
	longitudes[3] = Number.NaN;
	latitudes[3] = Number.NaN;
	assert.equal(
		checkPlacements(
			"ward/2026",
			placements,
			longitudes,
			latitudes,
			live,
			1,
		),
		points.length,
	);
});

test("fails with the point and both answers when a placement is wrong", () => {
	const { longitudes, latitudes, placements } = placed();
	placements.area[0] = placements.codes.indexOf("E1");
	assert.throws(
		() =>
			checkPlacements(
				"ward/2026",
				placements,
				longitudes,
				latitudes,
				live,
				1,
			),
		/ward\/2026: point 0 at -0\.8,50\.2 is placed in .*E1.*but a live lookup finds .*W1/,
	);
});

test("fails when a postcode in several areas is placed in one", () => {
	const { longitudes, latitudes, placements } = placed();
	placements.several.get(2)!.pop();
	assert.throws(
		() =>
			checkPlacements(
				"ward/2026",
				placements,
				longitudes,
				latitudes,
				live,
				100,
			),
		/point 2 at 0,50\.5/,
	);
});
