import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { httpResponse } from "../../src/httpResponse";
import { route } from "../../src/routes";
import { readApiCatalogues } from "../../src/server";
import { readParquet } from "../parquetFixtures";
import { decodeTile } from "../vectorTileFixtures";

/**
 * Serving the published map resource: the descriptor a client reads, the
 * TileJSON a renderer is configured with, and the tiles themselves.
 */

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
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

test("serves each tier flat, as the GeoParquet its descriptor lists", () => {
	const descriptor = data(`/v1/map-resources/${RESOURCE}`) as {
		areaCount: number;
		features: Array<{
			tier: string;
			href: string;
			bytes: number;
			rowCount: number;
		}>;
	};
	assert.deepEqual(descriptor.features.map((entry) => entry.tier).sort(), [
		"full",
		"high",
		"low",
		"medium",
	]);
	for (const entry of descriptor.features) {
		const response = get(entry.href);
		assert.equal(response.status, 200, entry.href);
		assert.equal(
			response.headers["content-type"],
			"application/vnd.apache.parquet",
		);
		assert.match(
			response.headers["content-disposition"]!,
			new RegExp(`filename=".*-${entry.tier}\\.parquet"`),
		);
		const body = response.body as Buffer;
		assert.equal(body.length, entry.bytes);
		assert.equal(entry.rowCount, descriptor.areaCount);
	}
	// Asking for the default format by name is the same request.
	const low = descriptor.features.find((entry) => entry.tier === "low")!;
	assert.equal(
		get(`${low.href}&format=geoparquet`).headers.etag,
		get(low.href).headers.etag,
	);
});

test("refuses a features download without a tier it publishes", () => {
	for (const query of ["", "?tier=", "?tier=coarse"]) {
		const refused = route(
			"GET",
			`/v1/map-resources/${RESOURCE}/features${query}`,
			catalogues,
		);
		assert.equal(refused.status, 400, query);
		assert.match(
			(refused.body as { detail: string }).detail,
			/full, high, medium, low/,
		);
	}
	const format = route(
		"GET",
		`/v1/map-resources/${RESOURCE}/features?tier=low&format=geojson`,
		catalogues,
	);
	assert.equal(format.status, 400);
	assert.equal((format.body as { code: string }).code, "invalid_format");
});

test("serves a join table as Parquet holding exactly the JSON values", () => {
	const url =
		`/v1/map-resources/${RESOURCE}/join/travel-to-work-car` +
		"?period=2021&geography=localAuthority&boundaryYear=2023";
	const json = data(url) as unknown as {
		values: Array<{
			id: number;
			code: string;
			value: number;
			status: string;
		}>;
		provenance: { contentHash: string };
	};
	const response = get(`${url}&format=parquet`);
	assert.equal(response.status, 200);
	assert.equal(
		response.headers["content-type"],
		"application/vnd.apache.parquet",
	);
	const file = readParquet(response.body as Buffer);
	assert.deepEqual(file.rows, json.values);
	// A copy loaded on its own still says what it is and where it came from.
	const about = JSON.parse(file.metadata["uk-data-atlas"]!) as {
		atlasRelease: string;
		mapResource: string;
		join: { method: string };
		provenance: { contentHash: string };
	};
	assert.equal(
		about.atlasRelease,
		(route("GET", url, catalogues).body as { atlasRelease: string })
			.atlasRelease,
	);
	assert.equal(about.mapResource, RESOURCE);
	assert.equal(about.join.method, "code-match");
	assert.equal(about.provenance.contentHash, json.provenance.contentHash);

	const refused = route("GET", `${url}&format=csv`, catalogues);
	assert.equal(refused.status, 400);
	assert.equal((refused.body as { code: string }).code, "invalid_format");
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

test("answers a pinned request immutably and keeps its links pinned", () => {
	const release = (
		route("GET", "/v1/atlas-release", catalogues).body as {
			data: { releaseId: string };
		}
	).data.releaseId;
	const pinned = `/v1/atlas-releases/${release}/map-resources/${RESOURCE}`;

	// The same answer as the unpinned path, but never needing revalidation.
	const descriptor = get(pinned);
	assert.equal(descriptor.status, 200);
	assert.equal(
		descriptor.headers["cache-control"],
		"public, max-age=31536000, immutable",
	);

	// A renderer configured from the pinned TileJSON must fetch pinned tiles,
	// or every tile it draws falls back to being revalidated.
	const tileJson = data(`${pinned}/tiles.json`) as unknown as {
		tiles: string[];
	};
	assert.ok(
		tileJson.tiles[0]!.startsWith(`/v1/atlas-releases/${release}/`),
		`pinned TileJSON points at ${tileJson.tiles[0]}`,
	);
	const tile = get(
		tileJson.tiles[0]!.replace("{z}", "0")
			.replace("{x}", "0")
			.replace("{y}", "0"),
	);
	assert.equal(tile.status, 200);
	assert.equal(
		tile.headers["cache-control"],
		"public, max-age=31536000, immutable",
	);

	// The unpinned descriptor says how to pin, so a client never has to
	// assemble that URL itself.
	const unpinned = data(`/v1/map-resources/${RESOURCE}`) as {
		pinned: { atlasRelease: string; href: string };
	};
	assert.equal(unpinned.pinned.atlasRelease, release);
	assert.equal(unpinned.pinned.href, pinned);
});

test("refuses a release it no longer serves rather than answering from another", () => {
	// Quietly serving the current release under an older release's URL is the
	// one thing a pinned URL must never do.
	const archived = (
		route("GET", "/v1/atlas-releases", catalogues).body as {
			data: Array<{ releaseId: string }>;
		}
	).data;
	const current = (
		route("GET", "/v1/atlas-release", catalogues).body as {
			data: { releaseId: string };
		}
	).data.releaseId;
	const older = archived.find((entry) => entry.releaseId !== current);
	if (older) {
		const gone = route(
			"GET",
			`/v1/atlas-releases/${older.releaseId}/map-resources/${RESOURCE}`,
			catalogues,
		);
		assert.equal(gone.status, 410);
		assert.match(
			(gone.body as { detail: string }).detail,
			/no longer served/,
		);
	}

	const unknown = route(
		"GET",
		`/v1/atlas-releases/sha256:0000/map-resources/${RESOURCE}`,
		catalogues,
	);
	assert.equal(unknown.status, 404);
	assert.equal(
		get(`/v1/atlas-releases/sha256:0000/map-resources/${RESOURCE}`).headers[
			"cache-control"
		],
		"no-store",
	);

	// A refusal from the resource itself, reached through a good pin, is not
	// immutable either: it may well succeed once that resource is published.
	const missing = get(
		`/v1/atlas-releases/${current}/map-resources/ward/1066`,
	);
	assert.equal(missing.status, 404);
	assert.equal(missing.headers["cache-control"], "no-store");
});
