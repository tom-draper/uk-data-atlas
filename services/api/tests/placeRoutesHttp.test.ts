import { createGeographyServices } from "@uk-data-atlas/atlas-loader";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, expect, test } from "vitest";
import { AreaGeometryCache } from "@uk-data-atlas/geometry";
import { createAreaLookup } from "@uk-data-atlas/areas";
import type { BoundaryRegistry } from "@uk-data-atlas/catalogue";
import { createGeographyResolver } from "@uk-data-atlas/atlas-loader";
import { compilePlaceIndex } from "@uk-data-atlas/places";
import type { NamedLocationInventory } from "@uk-data-atlas/places";
import {
	parsePostcode,
	toWgs84Point,
	type PostcodeShard,
} from "@uk-data-atlas/geography";
import { PostcodeIndex, postcodeLookupPoint } from "@uk-data-atlas/postcodes";
import type { RouteContext } from "../src/runtime/index.ts";
import {
	characterize,
	startCharacterization,
	type CharacterizedRequest,
} from "./httpCharacterization";
import { postcodeIndexFor, postcodeRow } from "./postcodeFixtures";

// Areas a kilometre or so across, west and east of a point in London, so the
// postcodes below can carry real British National Grid references.
const [lng, lat] = toWgs84Point([530000, 180000], "EPSG:27700").position;
const D = 0.02;
const square = (x0: number, x1: number) => ({
	type: "Polygon",
	coordinates: [
		[
			[lng + x0 * D, lat - D],
			[lng + x1 * D, lat - D],
			[lng + x1 * D, lat + D],
			[lng + x0 * D, lat + D],
			[lng + x0 * D, lat - D],
		],
	],
});

const release = (geography: string, id: string) => ({
	id,
	geography,
	title: `${geography} ${id}`,
	coverage: { countries: ["GB-ENG"] },
	source: {
		publisher: "ONS",
		url: "https://example.com",
		licence: { name: "Open Government Licence" },
	},
	metadataHash: `sha256:${id}`,
});

const layers = {
	"localAuthority/2026-05-uk-bgc": [
		{ code: "E09000001", name: "West borough", geometry: square(-1, 0) },
		{ code: "E09000002", name: "East borough", geometry: square(0, 1) },
	],
	// Newer than the directory's edition, so chosen only when asked for.
	"localAuthority/2026-12-uk-bgc": [
		{ code: "E09000003", name: "Merged borough", geometry: square(-1, 1) },
	],
	"ward/2026-05-uk-bgc": [
		{ code: "E05000001", name: "West ward", geometry: square(-1, 0) },
		{ code: "E05000002", name: "East ward", geometry: square(0, 1) },
	],
	"constituency/2024-07-uk-bgc": [
		{ code: "E14000001", name: "Constituency", geometry: square(-1, 1) },
	],
	"country/2025-12-uk-bgc": [
		{ code: "E92000001", name: "England", geometry: square(-1, 1) },
	],
};

const boundaryRegistry: BoundaryRegistry = {
	schemaVersion: 1,
	contentHash: "sha256:registry",
	releases: Object.keys(layers).map((key) => {
		const [geography, id] = key.split("/");
		return release(geography!, id!);
	}),
};

const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-postcodes-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const geometrySources = new Map<
	string,
	{ input: string; crs: string; codeProperty: string }
>();
for (const [key, features] of Object.entries(layers)) {
	mkdirSync(join(root, "data/source", "boundaries", key), {
		recursive: true,
	});
	writeFileSync(
		join(root, "data/source", "boundaries", key, "areas.geojson"),
		JSON.stringify({
			type: "FeatureCollection",
			features: features.map(({ code, geometry }) => ({
				properties: { CODE: code },
				geometry,
			})),
		}),
	);
	geometrySources.set(key, {
		input: `boundaries/${key}/areas.geojson`,
		crs: "EPSG:4326",
		codeProperty: "CODE",
	});
}
const areaLookup = createAreaLookup(
	Object.entries(layers).map(([key, features]) => {
		const [geography, boundaryRelease] = key.split("/");
		return {
			schemaVersion: 1 as const,
			contentHash: `sha256:${key}`,
			geography: geography!,
			boundaryRelease: boundaryRelease!,
			codeProperty: "CODE",
			nameProperty: "NAME",
			areas: features.map(({ code, name }) => ({ code, name })),
		};
	}),
);

const placeIndex = compilePlaceIndex(
	areaLookup,
	{
		schemaVersion: 1,
		contentHash: "sha256:locations",
		source: {
			artifact: "data/datasets/gazetteer.core.json",
			gazetteerVersion: 1,
		},
		locations: [],
	} as unknown as NamedLocationInventory,
	"sha256:areas",
);

const { index: sourceIndex, texts } = postcodeIndexFor([
	// 300 m west and east of the centre line.
	postcodeRow("EC1A 1AA", { east1m: "529700" }),
	postcodeRow("EC1A 1AB", { east1m: "530300", doterm: "201905" }),
	postcodeRow("EC1A 1AD", { east1m: "529700", gridind: "5" }),
	// Ten kilometres east, beyond every area.
	postcodeRow("EC1A 1AE", { east1m: "540000" }),
	postcodeRow("GY1 1AA", {
		gridind: "9",
		east1m: "",
		north1m: "",
		ctry: "L93000001",
	}),
	postcodeRow("BT1 1AA", { ctry: "N92000002" }),
]);

// Exercise the stored-coordinate path in the HTTP snapshots as well as the
// shard-backed fallback. The SQLite integration test checks the actual reader.
const index = new PostcodeIndex(sourceIndex.artifact, (path) => {
	const text = texts.get(path)!;
	const shard = JSON.parse(text) as PostcodeShard;
	const points = shard.postcodes.map((postcode): [number, number] | null => {
		const parsed = parsePostcode(postcode);
		if (!parsed || parsed.kind !== "unit") return null;
		const result = sourceIndex.lookup(parsed);
		if (result.status !== "found" || !result.record.centroid) return null;
		const point = postcodeLookupPoint(result.record.centroid);
		return [point.lng, point.lat];
	});
	return { text, points };
});

const context = (withPostcodes = true): RouteContext => ({
	boundaryRegistry,
	areaValidation: createGeographyServices({}).validation,
	postcodes: createGeographyServices({
		postcodeIndex: withPostcodes ? index : undefined,
	}).postcodes,
	geographyResolver: createGeographyResolver({
		boundaryRegistry,
		areaLookup,
		placeIndex,
		areaGeometryCache: new AreaGeometryCache(root, geometrySources, 6),
		...(withPostcodes ? { postcodeIndex: index } : {}),
	}),
});

const postcodeContext = context();
const bare = context(false);

const BATCH = "/v1/postcodes:batch";
const json = (path: string, value: unknown): CharacterizedRequest => ({
	path,
	method: "POST",
	headers: { "content-type": "application/json" },
	body: typeof value === "string" ? value : JSON.stringify(value),
});

test("place lookups keep their HTTP responses", async (t) => {
	const send = await startCharacterization(t, postcodeContext);
	const requests: CharacterizedRequest[] = [
		{ path: "/v1/places" },
		{ path: "/v1/places?q=" },
		{ path: "/v1/places?q=west" },
		{ path: "/v1/places?q=West%20borough" },
		{ path: "/v1/places?q=west", method: "HEAD" },
		{ path: "/v1/places?q=west&limit=1" },
		{ path: "/v1/places?q=west&limit=0" },
		{ path: "/v1/places?q=west&limit=abc" },
		{ path: "/v1/places?q=west&limit=1000" },
		{ path: "/v1/places?q=E09000001" },
		{ path: "/v1/places?q=localAuthority/E09000001" },
		{ path: "/v1/places?q=EC1A1AA" },
		{ path: "/v1/places?q=EC1A%201AB" },
		{ path: "/v1/places?q=nowhere" },
		{ path: "/v1/places?q=west&asOf=2026-06-01" },
		{ path: "/v1/places?q=west&asOf=soon" },
		{ path: "/v1/places?q=west&geography=ward" },
		{ path: "/v1/places?q=west&release=ward/2026-05-uk-bgc" },
		{ path: "/v1/places?q=west&date=2026-06" },
		{ path: "/v1/places?q=west&country=E92000001" },
		{ path: "/v1/places?q=west&unexpected=1" },
		{ path: "/v1/places?q=west&q=east" },
		{
			path: "/v1/places?q=west",
			headers: {
				"accept-encoding": "gzip",
				origin: "https://example.test",
			},
		},
		{
			path: "/v1/places?q=west",
			headers: { "if-none-match": '"unknown"' },
		},
		{ path: "/v1/places/" },
		{ path: "/v1/places/?q=west" },
		{ path: "/v1/Places?q=west" },
		{ path: "/v1/places/extra?q=west" },
		{ path: "/v1/places?q=west", method: "POST", body: "{}" },
		{ path: "/v1/places?q=west", method: "PUT" },
		{ path: "/v1/places?q=west", method: "DELETE" },
		{
			path: "/v1/places",
			method: "OPTIONS",
			headers: {
				origin: "https://example.test",
				"access-control-request-method": "GET",
			},
		},
	];
	expect(await characterize(send, requests)).toMatchSnapshot();
});

test("postcode lookups keep their HTTP responses", async (t) => {
	const send = await startCharacterization(t, postcodeContext);
	const requests: CharacterizedRequest[] = [
		{ path: "/v1/postcodes/EC1A1AA" },
		{ path: "/v1/postcodes/ec1a1aa" },
		{ path: "/v1/postcodes/EC1A%201AA" },
		{ path: "/v1/postcodes/EC1A+1AA" },
		{ path: "/v1/postcodes/EC1A1AA", method: "HEAD" },
		{
			path: "/v1/postcodes/EC1A1AA",
			headers: {
				"accept-encoding": "gzip",
				origin: "https://example.test",
			},
		},
		{
			path: "/v1/postcodes/EC1A1AA",
			headers: { "if-none-match": '"unknown"' },
		},
		{ path: "/v1/postcodes/EC1A1AA?view=compact" },
		{ path: "/v1/postcodes/EC1A1AA?view=full" },
		{ path: "/v1/postcodes/EC1A1AA?view=short" },
		{
			path: "/v1/postcodes/EC1A1AB?geography=localAuthority&date=2027-01-01",
		},
		{ path: "/v1/postcodes/EC1A1AB?release=ward/2026-05-uk-bgc" },
		{ path: "/v1/postcodes/EC1A1AD?geography=ward" },
		{ path: "/v1/postcodes/EC1A1AD?geography=ward&view=compact" },
		{ path: "/v1/postcodes/EC1A1AE" },
		{ path: "/v1/postcodes/GY11AA" },
		{ path: "/v1/postcodes/GY11AA?view=compact" },
		{ path: "/v1/postcodes/EC1A1AA?date=soon" },
		{ path: "/v1/postcodes/EC1A1AA?date=2026-08-01" },
		{ path: "/v1/postcodes/EC1A1AA?geography=nowhere" },
		{ path: "/v1/postcodes/EC1A1AA?geography=ward&geography=constituency" },
		{ path: "/v1/postcodes/EC1A1AA?unexpected=1" },
		{ path: "/v1/postcodes/Bristol" },
		{ path: "/v1/postcodes/EC1A" },
		{ path: "/v1/postcodes/EC1A%201" },
		{ path: "/v1/postcodes/EC1A9ZZ" },
		{ path: "/v1/postcodes/BT11AA" },
		{ path: "/v1/postcodes/%E0%A4%A" },
		{ path: "/v1/postcodes/a.b" },
		{ path: "/v1/postcodes/.." },
		{ path: `/v1/postcodes/${"x".repeat(150)}` },
		{ path: "/v1/postcodes" },
		{ path: "/v1/postcodes/" },
		{ path: "/v1/postcodes/EC1A1AA/" },
		{ path: "/v1/postcodes/EC1A1AA/extra" },
		{ path: "/v1/Postcodes/EC1A1AA" },
		{ path: "/v1/postcodes/EC1A1AA", method: "POST", body: "{}" },
		{ path: "/v1/postcodes/EC1A1AA", method: "PUT" },
		{ path: "/v1/postcodes/EC1A1AA", method: "DELETE" },
		{
			path: "/v1/postcodes/EC1A1AA",
			method: "OPTIONS",
			headers: {
				origin: "https://example.test",
				"access-control-request-method": "GET",
			},
		},
	];
	expect(await characterize(send, requests)).toMatchSnapshot();
});

test("postcode batches keep their HTTP responses", async (t) => {
	const send = await startCharacterization(t, postcodeContext);
	const postcodes = ["EC1A1AA", "EC1A 1AB", "EC1A1AD", "EC1A1AE", "GY11AA"];
	const requests: CharacterizedRequest[] = [
		json(BATCH, { postcodes }),
		{
			...json(BATCH, { postcodes }),
			headers: {
				"content-type": "application/json",
				"accept-encoding": "gzip",
				origin: "https://example.test",
			},
		},
		json(BATCH, { postcodes: ["EC1A1AD"] }),
		json(`${BATCH}?geography=ward`, { postcodes }),
		json(`${BATCH}?geography=ward&view=compact`, { postcodes }),
		json(`${BATCH}?view=compact`, { postcodes }),
		json(`${BATCH}?view=short`, { postcodes }),
		json(`${BATCH}?release=ward/2026-05-uk-bgc`, { postcodes }),
		json(`${BATCH}?date=2027-01-01&geography=localAuthority`, {
			postcodes,
		}),
		json(`${BATCH}?date=soon`, { postcodes }),
		json(`${BATCH}?geography=nowhere`, { postcodes }),
		json(`${BATCH}?unexpected=1`, { postcodes }),
		json(BATCH, { postcodes: ["Bristol", "EC1A", "EC1A9ZZ", "BT11AA"] }),
		json(BATCH, { postcodes: [] }),
		json(BATCH, { postcodes: ["", " "] }),
		json(BATCH, {
			postcodes: Array.from({ length: 101 }, () => "EC1A1AA"),
		}),
		json(BATCH, {
			postcodes: Array.from({ length: 100 }, () => "EC1A1AA"),
		}),
		json(BATCH, { postcodes: [7] }),
		json(BATCH, { postcodes: "EC1A1AA" }),
		json(BATCH, { values: ["EC1A1AA"] }),
		json(BATCH, "{"),
		json(BATCH, []),
		{
			path: BATCH,
			method: "POST",
			headers: { "content-type": "text/plain" },
			body: "EC1A1AA",
		},
		{
			path: BATCH,
			method: "POST",
			headers: { "content-type": "text/csv" },
			body: "postcode\nEC1A1AA\n",
		},
		{
			path: BATCH,
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: "postcodes=EC1A1AA",
		},
		{ path: BATCH, method: "POST", body: JSON.stringify({ postcodes }) },
		{ path: BATCH, method: "POST" },
		{
			path: BATCH,
			method: "POST",
			headers: { "content-type": "application/json; charset=utf-8" },
			body: JSON.stringify({ postcodes }),
		},
		{
			path: BATCH,
			method: "POST",
			headers: { "content-type": "APPLICATION/JSON" },
			body: JSON.stringify({ postcodes }),
		},
		json(`${BATCH}/`, { postcodes }),
		json(`${BATCH}/extra`, { postcodes }),
		json("/v1/postcodes:Batch", { postcodes }),
		json("/v1/Postcodes:batch", { postcodes }),
		json("/v1/postcodes%3Abatch", { postcodes }),
		json("/v1/postcodes:batches", { postcodes }),
		{ path: BATCH, method: "GET" },
		{ path: `${BATCH}?postcode=EC1A1AA`, method: "GET" },
		{ path: BATCH, method: "HEAD" },
		{
			path: BATCH,
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ postcodes }),
		},
		{ path: BATCH, method: "DELETE" },
		{
			path: BATCH,
			method: "OPTIONS",
			headers: {
				origin: "https://example.test",
				"access-control-request-method": "POST",
			},
		},
	];
	expect(await characterize(send, requests)).toMatchSnapshot();
});

test("place and postcode routes answer without the services they read", async (t) => {
	const send = await startCharacterization(t, bare);
	const requests: CharacterizedRequest[] = [
		{ path: "/v1/places?q=west" },
		{ path: "/v1/postcodes/EC1A1AA" },
		json(BATCH, { postcodes: ["EC1A1AA"] }),
	];
	expect(await characterize(send, requests)).toMatchSnapshot();
});

test("a postcode batch reads its body under the size limits", async (t) => {
	const send = await startCharacterization(t, postcodeContext);
	const big = JSON.stringify({
		postcodes: ["EC1A1AA"],
		pad: "x".repeat(9_000_000),
	});
	const out: Record<
		string,
		{ status: number; headers: string[]; body: string }
	> = {};
	for (const [name, request] of [
		["oversize json", json(BATCH, big)],
		["after oversize", json(BATCH, { postcodes: ["EC1A1AA"] })],
	] as const) {
		const { status, headers, body } = await send(request);
		out[name] = {
			status,
			headers,
			body: body.length > 600 ? body.slice(0, 600) : body,
		};
	}
	expect(out).toMatchSnapshot();
});
