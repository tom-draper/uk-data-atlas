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
	assert.equal(
		resolver.areaGeometry({ ...identity, code: "missing" }),
		undefined,
	);
});

test("SpatialResolver reports absent cache data without inventing geometry", () => {
	const resolver = new SpatialResolver(undefined, () => undefined);
	assert.equal(resolver.hasAreaGeometryCache(), false);
	assert.equal(resolver.geometryFor(identity), undefined);
	assert.equal(resolver.areaGeometry(identity), undefined);
	assert.equal(resolver.releaseGeometrySource("ward", "2024"), undefined);
});

test("SpatialResolver only loads geometry for the bounded result page", () => {
	const geometryReads: string[] = [];
	const candidates = ["W001", "W002", "W003"].map((code, index) => ({
		code,
		relation: "within" as const,
		bounds: [-2 + index, 53, -1 + index, 54] as [
			number,
			number,
			number,
			number,
		],
	}));
	const cache = {
		findIntersecting: () => candidates,
		get: (_geography: string, _release: string, code: string) => {
			geometryReads.push(code);
			return geometry;
		},
		provenance: () => provenance,
	} as unknown as AreaGeometryCache;
	const resolver = new SpatialResolver(cache, ({ code }) => ({
		code,
		name: `Ward ${code}`,
	}));

	const identities = resolver.intersectingAreas(
		"ward",
		"2024",
		[-3, 52, 3, 55],
		2,
		false,
	)!;
	assert.equal(identities.matched, 3);
	assert.deepEqual(
		identities.matches.map(({ code }) => code),
		["W001", "W002"],
	);
	assert.deepEqual(geometryReads, []);

	const withGeometry = resolver.intersectingAreas(
		"ward",
		"2024",
		[-3, 52, 3, 55],
		2,
		true,
	)!;
	assert.deepEqual(
		withGeometry.matches.map(({ code }) => code),
		["W001", "W002"],
	);
	assert.deepEqual(geometryReads, ["W001", "W002"]);
});
