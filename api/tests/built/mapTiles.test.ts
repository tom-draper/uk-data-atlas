import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
	AreaGeometryCache,
	type GeoJsonGeometry,
} from "../../src/areaGeometry";
import { readGeometrySourceLookup } from "../../src/geometrySources";
import { simplifyGeometry } from "../../src/simplifyGeometry";
import { decomposeArcs } from "../../src/mapResource/arcs";
import { compileTier } from "../../src/mapResource/topologyTiers";
import {
	tileBounds,
	tilesCovering,
	type TileAddress,
	type TileBox,
} from "../../src/mapResource/tileGrid";
import {
	boundsOf,
	buildTile,
	MAX_ZOOM,
	MIN_ZOOM,
	tierForZoom,
	ZOOM_TIERS,
	type MapFeature,
} from "../../src/mapResource/tileset";
import { decodeTile } from "../vectorTileFixtures";

/**
 * The tiles a map actually loads.
 *
 * The guarantee that neighbours share a border is proved on the tier geometry
 * in `mapTopology.test.ts`, where it is exact. A tile adds two lossy steps on
 * top: coordinates are rounded to the tile's 4,096-unit grid, and rings are cut
 * to the tile. Both are functions of the coordinates alone, so they treat two
 * areas along a border identically, but a polygon can round down to fewer than
 * three distinct points and then cannot be drawn at all. That is a part too
 * small for the zoom rather than a border drawn differently on each side, so
 * what is checked here is that no tile ever draws one area over another, and
 * that a coarse zoom still carries far more shared borders than generalising
 * each area alone would.
 */

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const RELEASE = { geography: "localAuthority", id: "2023-05-uk-bgc-v2" };
const UNITED_KINGDOM: TileBox = [-8.7, 49.8, 1.9, 61.0];

const release = (() => {
	const cache = new AreaGeometryCache(
		resolve(apiRoot, ".."),
		readGeometrySourceLookup(apiRoot),
	);
	return new Map(
		cache.codes(RELEASE.geography, RELEASE.id).flatMap((code) => {
			const geometry = cache.get(RELEASE.geography, RELEASE.id, code);
			return geometry ? [[code, geometry] as const] : [];
		}),
	);
})();

const topology = decomposeArcs(release);

const mapFeatures = (areas: Map<string, GeoJsonGeometry>): MapFeature[] =>
	[...areas].map(([code, geometry], index) => ({
		id: index + 1,
		code,
		name: code,
		geometry,
		bounds: boundsOf(geometry),
	}));

/** An even spread of the tiles a zoom covers, so a test stays quick. */
const sampleTiles = (zoom: number, wanted: number): TileAddress[] => {
	const all = tilesCovering(UNITED_KINGDOM, zoom);
	const step = Math.max(1, Math.floor(all.length / wanted));
	return all.filter((_, index) => index % step === 0).slice(0, wanted);
};

type Drawn = {
	tiles: number;
	/** Edges drawn by more than two areas: one area drawn over another. */
	overlapping: number;
	/** Pairs of areas both drawn in a tile, and how many still share an edge. */
	together: number;
	sharing: number;
};

const drawn = (
	features: MapFeature[],
	zoom: number,
	adjacent: Set<string>,
): Drawn => {
	const result: Drawn = {
		tiles: 0,
		overlapping: 0,
		together: 0,
		sharing: 0,
	};
	for (const address of sampleTiles(zoom, 12)) {
		const tile = buildTile(
			"boundaries",
			features,
			address,
			tileBounds(address),
		);
		if (!tile) continue;
		result.tiles += 1;
		const [layer] = decodeTile(tile);
		const owners = new Map<string, Set<string>>();
		const present = new Set<string>();
		for (const feature of layer!.features) {
			const code = feature.properties.code as string;
			present.add(code);
			for (const ring of feature.rings)
				for (let i = 0; i < ring.length; i += 1) {
					const from = ring[i]!.join(",");
					const to = ring[(i + 1) % ring.length]!.join(",");
					if (from === to) continue;
					const key = from < to ? `${from}|${to}` : `${to}|${from}`;
					const set = owners.get(key);
					if (set) set.add(code);
					else owners.set(key, new Set([code]));
				}
		}
		const shares = new Set<string>();
		for (const set of owners.values()) {
			if (set.size > 2) result.overlapping += 1;
			if (set.size !== 2) continue;
			const [left, right] = [...set].sort();
			shares.add(`${left}|${right}`);
		}
		for (const pair of adjacent) {
			const [left, right] = pair.split("|");
			if (!present.has(left!) || !present.has(right!)) continue;
			result.together += 1;
			if (shares.has(pair)) result.sharing += 1;
		}
	}
	return result;
};

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

const adjacentInSource = (() => {
	const owners = new Map<string, Set<string>>();
	for (const [code, geometry] of release)
		for (const ring of ringsOf(geometry))
			for (let i = 0; i < ring.length - 1; i += 1) {
				const from = (ring[i] as number[]).join(",");
				const to = (ring[i + 1] as number[]).join(",");
				if (from === to) continue;
				const key = from < to ? `${from}|${to}` : `${to}|${from}`;
				const set = owners.get(key);
				if (set) set.add(code);
				else owners.set(key, new Set([code]));
			}
	const pairs = new Set<string>();
	for (const set of owners.values()) {
		if (set.size !== 2) continue;
		const [left, right] = [...set].sort();
		pairs.add(`${left}|${right}`);
	}
	return pairs;
})();

test("publishes a tier for every zoom it claims to cover", () => {
	assert.equal(MIN_ZOOM, 0);
	assert.equal(MAX_ZOOM, 12);
	for (let zoom = MIN_ZOOM; zoom <= MAX_ZOOM; zoom += 1)
		assert.ok(tierForZoom(zoom), `zoom ${zoom} has no tier`);
	assert.throws(() => tierForZoom(MAX_ZOOM + 1));
	// Coarser zooms must not ask for finer geometry than finer zooms do.
	const order = ["low", "medium", "high", "full"];
	const used = ZOOM_TIERS.map((band) => order.indexOf(band.tier));
	assert.deepEqual(
		[...used].sort((a, b) => a - b),
		used,
	);
});

test("draws no area over another once the grid is finer than the boundaries", () => {
	// Both ends of every band except the whole-world zoom, which the next test
	// covers: at zoom 5 a tile unit is already under 200 metres.
	for (const band of ZOOM_TIERS) {
		const features = mapFeatures(compileTier(topology, band.tier).areas);
		for (const zoom of [Math.max(band.minZoom, 5), band.maxZoom]) {
			const result = drawn(features, zoom, adjacentInSource);
			assert.ok(result.tiles > 0, `zoom ${zoom} produced no tiles`);
			assert.equal(
				result.overlapping,
				0,
				`zoom ${zoom} drew an edge on more than two areas`,
			);
		}
	}
});

test("merges borders only where the grid is coarser than they are", () => {
	// The whole country in one tile puts about 5.7km of ground on each unit of
	// the grid, so borders that are closer together than that round onto the
	// same edge and it ends up on three areas. This is the grid being coarser
	// than the geometry, not a tier drawing a border two ways, and it is
	// confined to this zoom: it is recorded here rather than left for someone
	// to find in a renderer.
	const features = mapFeatures(compileTier(topology, tierForZoom(0)).areas);
	const result = drawn(features, 0, adjacentInSource);
	assert.equal(result.tiles, 1);
	assert.ok(result.overlapping > 0, "zoom 0 no longer merges any border");
	assert.ok(
		result.overlapping < 200,
		`zoom 0 merged ${result.overlapping} edges, far more than the grid explains`,
	);
});

test("carries the code, name and a stable id into the tile", () => {
	const features = mapFeatures(compileTier(topology, "low").areas);
	const address = sampleTiles(4, 12).find((tile) =>
		buildTile("boundaries", features, tile, tileBounds(tile)),
	)!;
	const [layer] = decodeTile(
		buildTile("boundaries", features, address, tileBounds(address))!,
	);
	assert.equal(layer!.name, "boundaries");
	assert.ok(layer!.features.length > 0);
	for (const feature of layer!.features) {
		const code = feature.properties.code as string;
		assert.match(code, /^[A-Z]\d{8}$/);
		assert.equal(
			feature.id,
			features.find((entry) => entry.code === code)!.id,
			"a feature's id must be the one the join table publishes",
		);
	}
});

test("keeps more borders through a coarse tile than generalising alone does", () => {
	// The reason the arcs exist, measured where a map would show it: the
	// coarsest published zoom, where each area generalised on its own loses
	// borders wholesale.
	const band = ZOOM_TIERS[0]!;
	const zoom = band.maxZoom;
	const shared = drawn(
		mapFeatures(compileTier(topology, band.tier).areas),
		zoom,
		adjacentInSource,
	);
	const alone = drawn(
		mapFeatures(
			new Map(
				[...release].flatMap(([code, geometry]) => {
					const simplified = simplifyGeometry(geometry, band.tier);
					return simplified
						? [[code, simplified.geometry] as const]
						: [];
				}),
			),
		),
		zoom,
		adjacentInSource,
	);
	// The two draw slightly different sets of areas, so the counts are
	// compared as shares of the borders each one actually drew.
	assert.ok(shared.together > 100, "too few borders drawn to compare");
	assert.ok(alone.together > 100, "too few borders drawn to compare");
	const keptByArcs = shared.sharing / shared.together;
	const keptAlone = alone.sharing / alone.together;
	assert.ok(
		keptByArcs > keptAlone * 1.2,
		`shared arcs kept ${(keptByArcs * 100).toFixed(1)}% of the borders they drew, generalising alone kept ${(keptAlone * 100).toFixed(1)}%`,
	);
});
