import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
	AreaGeometryCache,
	type GeoJsonGeometry,
} from "../../src/areaGeometry";
import { readGeometrySourceLookup } from "../../src/geometrySources";
import { GEOMETRY_TIERS, simplifyGeometry } from "../../src/simplifyGeometry";
import { decomposeArcs, rebuildAreas } from "../../src/mapResource/arcs";
import { compileTier } from "../../src/mapResource/topologyTiers";

/**
 * The release gate for a map resource: neighbours share edges at every tier.
 *
 * `simplifyGeometry` cannot meet it, because it redraws each area from its own
 * vertices and the two sides of a border drift apart. The last test here holds
 * it to the same gate and requires it to fail, so this file is testing a real
 * difference rather than restating whatever both happen to do.
 */

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const TIERS = Object.keys(GEOMETRY_TIERS) as Array<keyof typeof GEOMETRY_TIERS>;

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

const vertexKey = (coordinate: unknown) =>
	(coordinate as number[]).join(",") as string;

const ringsOf = (geometry: GeoJsonGeometry): unknown[][] => {
	if (geometry.type === "GeometryCollection")
		return (geometry.geometries ?? []).flatMap(ringsOf);
	const polygons =
		geometry.type === "Polygon"
			? [geometry.coordinates]
			: geometry.type === "MultiPolygon"
				? geometry.coordinates
				: [];
	return (polygons as unknown[][][]).flatMap((polygon) => polygon);
};

/**
 * Which areas own each edge of a release, and from that which pairs of areas
 * share a border. Edge ownership is the question a map actually cares about:
 * two areas that own the same edge draw the same line, and a pair that stops
 * sharing an edge is a crack in the map.
 */
const edgeOwners = (areas: Map<string, GeoJsonGeometry>) => {
	const owners = new Map<string, Set<string>>();
	for (const [code, geometry] of areas) {
		for (const ring of ringsOf(geometry)) {
			for (let i = 0; i < ring.length - 1; i += 1) {
				const from = vertexKey(ring[i]);
				const to = vertexKey(ring[i + 1]);
				if (from === to) continue;
				const key = from < to ? `${from}|${to}` : `${to}|${from}`;
				const set = owners.get(key);
				if (set) set.add(code);
				else owners.set(key, new Set([code]));
			}
		}
	}
	return owners;
};

const sharedPairs = (areas: Map<string, GeoJsonGeometry>) => {
	const pairs = new Set<string>();
	for (const owners of edgeOwners(areas).values()) {
		if (owners.size < 2) continue;
		const codes = [...owners].sort();
		for (let i = 0; i < codes.length; i += 1)
			for (let j = i + 1; j < codes.length; j += 1)
				pairs.add(`${codes[i]}|${codes[j]}`);
	}
	return pairs;
};

/** Every edge of a release with the areas that draw it, in a comparable form. */
const ownedEdges = (areas: Map<string, GeoJsonGeometry>) =>
	[...edgeOwners(areas)]
		.map(([edge, owners]) => `${edge} ${[...owners].sort().join(",")}`)
		.sort();

test("finds one arc for a border two areas draw", () => {
	// Two squares meeting along x = 0.1, each corner of the join a junction.
	const topology = decomposeArcs(
		new Map([
			["left", square(0, 0, 0.1, 0.1)],
			["right", square(0.1, 0, 0.2, 0.1)],
		]),
	);
	const arcsOf = (code: string) =>
		new Set(
			topology.areas
				.get(code)!
				.flatMap((polygon) =>
					polygon.flatMap((ring) => ring.map((ref) => ref.arc)),
				),
		);
	const shared = [...arcsOf("left")].filter((arc) =>
		arcsOf("right").has(arc),
	);
	assert.equal(shared.length, 1, "the shared border should be a single arc");
	assert.equal(topology.overlappingEdges, 0);
	// The border runs between the two junctions and belongs to both areas.
	assert.deepEqual(topology.arcs[shared[0]!], [
		[0.1, 0],
		[0.1, 0.1],
	]);
});

test("rebuilds a release from its arcs without changing a boundary", () => {
	const areas = new Map([
		["left", square(0, 0, 0.1, 0.1)],
		["right", square(0.1, 0, 0.2, 0.1)],
		["island", square(1, 1, 1.1, 1.1)],
	]);
	const topology = decomposeArcs(areas);
	// A ring may come back starting at a different corner or running the other
	// way round, which is the same ring. Its edges are what must not move.
	assert.deepEqual(
		ownedEdges(rebuildAreas(topology, topology.arcs)),
		ownedEdges(areas),
	);
});

test("keeps an island that no junction divides", () => {
	// An island is one closed arc: nothing divides it, and it must survive the
	// coarsest tier rather than vanishing from the map.
	const topology = decomposeArcs(
		new Map([["island", square(1, 1, 1.0001, 1.0001)]]),
	);
	assert.equal(topology.arcs.length, 1);
	assert.equal(topology.closed[0], true);
	for (const tier of TIERS) {
		const compiled = compileTier(topology, tier);
		assert.equal(compiled.areas.size, 1, tier);
	}
});

/**
 * The real release the correct-map path pins. Loaded once: it is 19MB of
 * GeoJSON and every tier is compiled from the same decomposition.
 */
const RELEASE = { geography: "localAuthority", id: "2023-05-uk-bgc-v2" };

const release = (() => {
	const cache = new AreaGeometryCache(
		resolve(apiRoot, ".."),
		readGeometrySourceLookup(apiRoot),
	);
	const codes = cache.codes(RELEASE.geography, RELEASE.id);
	return new Map(
		codes.flatMap((code) => {
			const geometry = cache.get(RELEASE.geography, RELEASE.id, code);
			return geometry ? [[code, geometry] as const] : [];
		}),
	);
})();

const topology = decomposeArcs(release);
const atFullResolution = sharedPairs(release);

test("decomposes the release into a clean coverage", () => {
	assert.equal(release.size, 361);
	assert.equal(
		topology.overlappingEdges,
		0,
		"an edge on three areas means the release is not a coverage",
	);
	assert.ok(atFullResolution.size > 800, "too few borders to be a gate");
	// Splitting the release into arcs and putting it back must not move a
	// single boundary, or nothing generalised from it can be trusted either.
	assert.deepEqual(
		ownedEdges(compileTier(topology, "full").areas),
		ownedEdges(release),
	);
});

test("keeps every neighbour sharing edges at every tier", () => {
	for (const tier of TIERS) {
		const compiled = compileTier(topology, tier);

		// Nothing is taken off the map to make the tier fit.
		assert.equal(
			compiled.areas.size,
			release.size,
			`${tier} dropped an area`,
		);

		const pairs = sharedPairs(compiled.areas);
		assert.deepEqual(
			[...atFullResolution].filter((pair) => !pairs.has(pair)),
			[],
			`${tier} opened a crack between neighbours that share a border`,
		);
		assert.deepEqual(
			[...pairs].filter((pair) => !atFullResolution.has(pair)),
			[],
			`${tier} made neighbours of areas that do not share a border`,
		);

		// No edge lands on three areas, which would be an overlap the tier
		// invented.
		assert.deepEqual(
			[...edgeOwners(compiled.areas).values()]
				.filter((owners) => owners.size > 2)
				.map((owners) => [...owners]),
			[],
			`${tier} put an edge on more than two areas`,
		);
	}
});

test("generalises the release substantially at the coarsest tier", () => {
	const low = compileTier(topology, "low");
	// A gate that every tier passes because nothing was simplified would be
	// worthless, so hold the coarsest tier to a real reduction.
	assert.ok(
		low.verticesAfter < low.verticesBefore / 10,
		`low kept ${low.verticesAfter} of ${low.verticesBefore} coordinates`,
	);
});

test("fails the same gate when each area is generalised on its own", () => {
	// The reason a map resource exists. `simplifyGeometry` is correct for one
	// feature and cannot hold a coverage together, and this proves the gate
	// above is discriminating rather than easy to pass.
	const perFeature = new Map(
		[...release].flatMap(([code, geometry]) => {
			const simplified = simplifyGeometry(geometry, "low");
			return simplified ? [[code, simplified.geometry] as const] : [];
		}),
	);
	const pairs = sharedPairs(perFeature);
	const lost = [...atFullResolution].filter((pair) => !pairs.has(pair));
	assert.ok(
		lost.length > 100,
		`per-feature generalisation lost only ${lost.length} borders; the gate may no longer discriminate`,
	);
});
