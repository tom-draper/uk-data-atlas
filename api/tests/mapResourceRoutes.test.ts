import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { httpResponse } from "../src/httpResponse";
import { route } from "../src/routes";
import { readApiCatalogues } from "../src/server";
import { decodeTile } from "./vectorTileFixtures";

/**
 * Serving the published map resource: the descriptor a client reads, the
 * TileJSON a renderer is configured with, and the tiles themselves.
 */

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalogues = readApiCatalogues(apiRoot);
const RESOURCE = "localAuthority/2023-05-uk-bgc-v2";

const get = (url: string) =>
	httpResponse({ method: "GET", headers: {} }, (method) =>
		route(method, url, catalogues),
	);

const data = (url: string) => {
	const response = route("GET", url, catalogues);
	assert.equal(response.status, 200, url);
	return (response.body as { data: Record<string, unknown> }).data;
};

test("lists the published map resources", () => {
	const listed = data("/v1/map-resources") as unknown as Array<{
		id: string;
		href: string;
	}>;
	assert.ok(listed.length > 0);
	const entry = listed.find((resource) => resource.id === RESOURCE);
	assert.ok(entry, "the local authority resource is not listed");
	// Every entry links to a descriptor the API actually serves.
	for (const resource of listed)
		assert.equal(
			route("GET", resource.href, catalogues).status,
			200,
			resource.href,
		);
});

test("describes the resource with its hashes and attribution", () => {
	const descriptor = data(`/v1/map-resources/${RESOURCE}`) as {
		topology: string;
		tiles: Record<string, unknown>;
		attribution: { text: string; licence: { name: string } };
		geometrySource: { inputHash: string };
	};
	assert.equal(descriptor.topology, "shared-arc");
	assert.match(
		descriptor.tiles.contentHash as string,
		/^sha256:[0-9a-f]{64}$/,
	);
	assert.equal(descriptor.tiles.format, "pmtiles-3");
	assert.ok(descriptor.attribution.text.length > 0);
	assert.ok(descriptor.attribution.licence.name.length > 0);
	// The publisher file behind the shapes is named, so a drawing can be
	// traced back without trusting this API.
	assert.match(descriptor.geometrySource.inputHash, /^sha256:/);
});

test("gives a renderer TileJSON that carries the attribution", () => {
	const tileJson = data(`/v1/map-resources/${RESOURCE}/tiles.json`) as {
		tilejson: string;
		tiles: string[];
		attribution: string;
		minzoom: number;
		maxzoom: number;
	};
	assert.equal(tileJson.tilejson, "3.0.0");
	assert.ok(
		tileJson.attribution.length > 0,
		"a map would have nothing to cite",
	);
	assert.deepEqual(tileJson.tiles, [
		`/v1/map-resources/${RESOURCE}/tiles/{z}/{x}/{y}.mvt`,
	]);
	// The advertised template resolves to a tile that is really served.
	const served = get(
		tileJson.tiles[0]!.replace("{z}", "0")
			.replace("{x}", "0")
			.replace("{y}", "0"),
	);
	assert.equal(served.status, 200);
	assert.ok(tileJson.minzoom <= tileJson.maxzoom);
});

test("serves a tile as gzipped vector tile bytes", () => {
	const response = get(`/v1/map-resources/${RESOURCE}/tiles/0/0/0.mvt`);
	assert.equal(response.status, 200);
	assert.equal(
		response.headers["content-type"],
		"application/vnd.mapbox-vector-tile",
	);
	assert.equal(response.headers["content-encoding"], "gzip");
	assert.match(response.headers.etag!, /^"sha256-/);
	const [layer] = decodeTile(gunzipSync(response.body as Buffer));
	assert.equal(layer!.name, "boundaries");
	assert.ok(layer!.features.length > 0);
	const [feature] = layer!.features;
	assert.ok(feature!.properties.code);
	assert.ok(feature!.properties.name);
});

test("answers an empty tile with 204 and a zoom it does not publish with 404", () => {
	// Well inside the published zooms, over sea: an ordinary answer, and one
	// worth caching rather than refetching.
	const empty = get(`/v1/map-resources/${RESOURCE}/tiles/6/0/0.mvt`);
	assert.equal(empty.status, 204);
	assert.equal(empty.body, undefined);
	assert.equal(
		empty.headers["cache-control"],
		"public, max-age=300, must-revalidate",
	);

	const tooDeep = route(
		"GET",
		`/v1/map-resources/${RESOURCE}/tiles/14/0/0.mvt`,
		catalogues,
	);
	assert.equal(tooDeep.status, 404);
	assert.match(
		(tooDeep.body as { detail: string }).detail,
		/over-zoom/,
		"a renderer should be told what to do past the last zoom",
	);

	const nonsense = route(
		"GET",
		`/v1/map-resources/${RESOURCE}/tiles/6/x/0.mvt`,
		catalogues,
	);
	assert.equal(nonsense.status, 400);
});

test("serves the whole archive with the hash its descriptor gives", () => {
	const descriptor = data(`/v1/map-resources/${RESOURCE}`) as {
		tiles: { bytes: number; contentHash: string };
	};
	const response = get(`/v1/map-resources/${RESOURCE}.pmtiles`);
	assert.equal(response.status, 200);
	assert.equal(response.headers["content-type"], "application/vnd.pmtiles");
	assert.match(
		response.headers["content-disposition"]!,
		/attachment; filename=".*\.pmtiles"/,
	);
	const archive = response.body as Buffer;
	assert.equal(archive.length, descriptor.tiles.bytes);
	assert.equal(archive.subarray(0, 7).toString("ascii"), "PMTiles");
});

test("refuses a resource it does not publish", () => {
	const missing = route("GET", "/v1/map-resources/ward/1066", catalogues);
	assert.equal(missing.status, 404);
	assert.match(
		(missing.body as { detail: string }).detail,
		/\/v1\/map-resources/,
		"a refusal should say where the published ones are listed",
	);
});

test("numbers join values with the ids the tiles actually carry", () => {
	// The whole join contract rests on this: a renderer looks a value up by
	// the feature id it read from the tile. If the two are numbered from
	// different sets of codes, every value lands on the wrong shape.
	// Deliberately a measure that does not cover every area in the release:
	// 318 values against 361 areas. Numbering the values on their own codes
	// would give a different answer here and the same answer for a measure
	// that covers everything, so this is the case that discriminates.
	const join = data(
		`/v1/map-resources/${RESOURCE}/join/travel-to-work-car` +
			"?period=2021&geography=localAuthority&boundaryYear=2023",
	) as unknown as {
		values: Array<{ id: number; code: string }>;
		areasWithoutValue: number;
		join: { method: string; boundaryRelease: string };
	};
	assert.equal(join.join.method, "code-match");
	assert.ok(join.areasWithoutValue > 0, "this measure no longer has gaps");
	assert.ok(join.values.length > 0);
	const byCode = new Map(
		join.values.map((value) => [value.code, value.id] as const),
	);

	const tile = get(`/v1/map-resources/${RESOURCE}/tiles/0/0/0.mvt`);
	const [layer] = decodeTile(gunzipSync(tile.body as Buffer));
	let checked = 0;
	for (const feature of layer!.features) {
		const expected = byCode.get(feature.properties.code as string);
		if (expected === undefined) continue;
		assert.equal(
			feature.id,
			expected,
			`${feature.properties.code} is ${feature.id} in the tile and ${expected} in the join`,
		);
		checked += 1;
	}
	assert.ok(checked > 300, `only ${checked} features were cross-checked`);
	assert.ok(
		checked < layer!.features.length,
		"every feature had a value, so the gap case was not exercised",
	);
});

test("refuses a join the geometry cannot carry, and says what would work", () => {
	// A measure published on LSOAs cannot be drawn on local authorities. The
	// refusal has to name the releases that would carry it, or the caller is
	// left guessing.
	const refused = route(
		"GET",
		`/v1/map-resources/${RESOURCE}/join/imd-rank?period=2019`,
		catalogues,
	);
	assert.equal(refused.status, 422);
	const body = refused.body as {
		code: string;
		alternatives?: { releases?: string[] };
	};
	assert.equal(body.code, "incompatible_geometry");
	assert.ok(
		(body.alternatives?.releases ?? []).length > 0,
		"the refusal names no release that would work",
	);
});

test("refuses an ambiguous source rather than taking the first", () => {
	// population-estimate publishes several partitions for 2022. Choosing one
	// by catalogue order would make the answer depend on file ordering.
	const refused = route(
		"GET",
		`/v1/map-resources/${RESOURCE}/join/population-estimate?period=2022`,
		catalogues,
	);
	assert.equal(refused.status, 400);
	const body = refused.body as {
		detail: string;
		alternatives?: { partitions?: unknown[] };
	};
	assert.match(body.detail, /name the geography and boundary year/);
	assert.ok((body.alternatives?.partitions ?? []).length > 1);
});
