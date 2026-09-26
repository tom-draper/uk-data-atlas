import assert from "node:assert/strict";
import test from "node:test";
import type { MultiPolygon } from "polygon-clipping";
import { BoundedClipper } from "../src/boundedClipping";

const square = (west: number, east: number): MultiPolygon => [
	[
		[
			[west, 0],
			[east, 0],
			[east, 1],
			[west, 1],
			[west, 0],
		],
	],
];

test("clips in a worker and reports a clipper failure rather than throwing", () => {
	const clipper = new BoundedClipper(10_000);
	try {
		const clipped = clipper.clip(
			"intersection",
			square(0, 2),
			square(1, 3),
		);
		assert.deepEqual(
			clipped.status === "clipped" ? clipped.geometry : clipped,
			square(1, 2),
		);
		const difference = clipper.clip("xor", square(0, 2), square(1, 3));
		assert.equal(
			difference.status === "clipped" ? difference.geometry.length : 0,
			2,
		);
		const failed = clipper.clip(
			"intersection",
			{ type: "not a polygon" } as unknown as MultiPolygon,
			square(0, 1),
		);
		assert.deepEqual(failed, {
			status: "failed",
			reason: "Input geometry is not a valid Polygon or MultiPolygon",
		});
		// The worker survives a failure and serves the next clip.
		assert.equal(
			clipper.clip("intersection", square(0, 1), square(0, 1)).status,
			"clipped",
		);
	} finally {
		clipper.close();
	}
});

test("clips against a registered geometry, and keeps it across a restart", () => {
	const clipper = new BoundedClipper(10_000);
	try {
		clipper.register("wide", square(0, 2));
		const clipped = clipper.clip("intersection", square(1, 3), "wide");
		assert.deepEqual(
			clipped.status === "clipped" ? clipped.geometry : clipped,
			square(1, 2),
		);
		// A timeout replaces the worker; registrations must follow it.
		clipper.close();
		assert.equal(
			clipper.clip("intersection", "wide", square(1, 3)).status,
			"clipped",
		);
		assert.deepEqual(
			clipper.clip("intersection", "missing", square(0, 1)),
			{
				status: "failed",
				reason: "No geometry is registered as missing.",
			},
		);
	} finally {
		clipper.close();
	}
});
