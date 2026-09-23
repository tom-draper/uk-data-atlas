import assert from "node:assert/strict";
import test from "node:test";
import type { AreaGeometryCache } from "../src/areaGeometry";
import { SpatialResolver } from "../src/resolver/spatial";

const identity = {
	geography: "ward",
	boundaryRelease: "2024",
	code: "W001",
};
const geometry = { type: "Point", coordinates: [-2.2, 53.5] };
const provenance = { sourceCrs: "EPSG:4326", input: "wards.geojson" };

test("SpatialResolver joins cached geometry to area identity and provenance", () => {
	const cache = {
		get: (_geography: string, _release: string, code: string) =>
			code === identity.code ? geometry : undefined,
		provenance: () => provenance,
	} as unknown as AreaGeometryCache;
	const resolver = new SpatialResolver(cache, (candidate) =>
		candidate.code === identity.code
			? { code: identity.code, name: "Current ward" }
			: undefined,
	);

	assert.equal(resolver.hasAreaGeometryCache(), true);
	assert.deepEqual(resolver.geometryFor(identity), {
		geometry,
		geometrySource: provenance,
	});
	assert.deepEqual(resolver.areaGeometry(identity), {
		id: "ward/2024/W001",
		code: "W001",
		name: "Current ward",
		geometry,
		geometrySource: provenance,
	});
	assert.equal(resolver.areaGeometry({ ...identity, code: "missing" }), undefined);
});

test("SpatialResolver reports absent cache data without inventing geometry", () => {
	const resolver = new SpatialResolver(undefined, () => undefined);
	assert.equal(resolver.hasAreaGeometryCache(), false);
	assert.equal(resolver.geometryFor(identity), undefined);
	assert.equal(resolver.areaGeometry(identity), undefined);
	assert.equal(resolver.releaseGeometrySource("ward", "2024"), undefined);
});
