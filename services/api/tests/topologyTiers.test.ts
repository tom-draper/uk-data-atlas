import assert from "node:assert/strict";
import test from "node:test";
import type { GeoJsonGeometry } from "@uk-data-atlas/atlas-runtime/geometry";
import { decomposeArcs } from "@uk-data-atlas/map-tiles/arcs";
import { compileTiers } from "@uk-data-atlas/map-tiles/topologyTiers";

test("refines tiny shared rings without changing their arcs or dropping an area", () => {
	const square = (west: number, east: number): GeoJsonGeometry => ({
		type: "Polygon",
		coordinates: [
			[
				[west, 54],
				[east, 54],
				[east, 54.0001],
				[west, 54.0001],
				[west, 54],
			],
		],
	});
	const topology = decomposeArcs(
		new Map([
			["left", square(-2, -1.9999)],
			["right", square(-1.9999, -1.9998)],
		]),
	);
	const tiers = compileTiers(topology);
	assert.deepEqual([...tiers.keys()], ["full", "high", "medium", "low"]);
	for (const [tier, compiled] of tiers) {
		assert.equal(compiled.areas.size, 2);
		assert.equal(compiled.verticesAfter, 10);
		assert.equal(compiled.refinedArcs, tier === "full" ? 0 : 3);
		assert.deepEqual(compiled.arcs, [
			[
				[-1.9999, 54],
				[-1.9999, 54.0001],
			],
			[
				[-1.9999, 54],
				[-2, 54],
				[-2, 54.0001],
				[-1.9999, 54.0001],
			],
			[
				[-1.9999, 54],
				[-1.9998, 54],
				[-1.9998, 54.0001],
				[-1.9999, 54.0001],
			],
		]);
	}
});
