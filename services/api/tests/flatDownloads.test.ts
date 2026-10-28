import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { AreaGeometryCache } from "../src/areaGeometry";
import { sha256 } from "../src/contentHash";
import { compileFlatDownloads } from "../../../pipeline/src/flatDownloads";
import { FullDetailDownloads } from "../src/fullDetailDownloads";
import { readParquet } from "./parquetFixtures";

const square = (west: number, south: number) => [
	[
		[west, south],
		[west + 1, south],
		[west + 1, south + 1],
		[west, south + 1],
		[west, south],
	],
];

test("publishes a release that cannot be tiled whole, at full detail, built on request", (t) => {
	const root = mkdtempSync(join(tmpdir(), "atlas-flat-downloads-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const directory = join(root, "data/source", "boundaries", "ward");
	mkdirSync(directory, { recursive: true });
	writeFileSync(
		join(directory, "wards.geojson"),
		JSON.stringify({
			type: "FeatureCollection",
			features: [
				// One code published as two features, as some releases do.
				{
					properties: { CODE: "B" },
					geometry: { type: "Polygon", coordinates: square(2, 50) },
				},
				{
					properties: { CODE: "B" },
					geometry: { type: "Polygon", coordinates: square(4, 50) },
				},
				{
					properties: { CODE: "A" },
					geometry: { type: "Polygon", coordinates: square(0, 50) },
				},
			],
		}),
	);
	const cache = new AreaGeometryCache(
		root,
		new Map([
			[
				"ward/2017-12-gb-bgc",
				{
					input: "boundaries/ward/wards.geojson",
					crs: "EPSG:4326",
					codeProperty: "CODE",
				},
			],
		]),
	);
	const release = {
		id: "2017-12-gb-bgc",
		geography: "ward",
		title: "Wards, December 2017",
		source: {
			publisher: "ONS",
			url: "https://example.com",
			licence: { name: "Open Government Licence v3.0" },
		},
	};
	const names = new Map([
		["A", "Ay"],
		["B", "Bee"],
	]);
	const compiled = compileFlatDownloads(
		cache,
		release,
		names,
		"ward/2017-12-gb-bgc is not a coverage.",
	)!;
	assert.equal(compiled.reason, "ward/2017-12-gb-bgc is not a coverage.");
	// GeoParquet only, and no file: it is built from the store when asked for.
	assert.deepEqual(
		compiled.features.map(
			({ tier, format, rowCount, coordinates, artifact }) => ({
				tier,
				format,
				rowCount,
				coordinates,
				artifact,
			}),
		),
		[
			{
				tier: "full",
				format: "geoparquet-1.1",
				rowCount: 2,
				coordinates: 15,
				artifact: undefined,
			},
		],
	);
	const downloads = new FullDetailDownloads(cache, {
		boundaryRelease: () => release as never,
		releaseAreas: () =>
			new Map(
				[...names].map(([code, name]) => [code, { code, name }]),
			) as never,
	});
	const entry = compiled.features[0]!;
	const built = downloads.get(
		"ward",
		"2017-12-gb-bgc",
		"none",
		entry.contentHash,
	);
	assert.equal(built.status, "built");
	const body = (built as { body: Buffer }).body;
	assert.equal(body.length, entry.bytes);
	assert.equal(sha256(body), entry.contentHash);
	// Numbered as the tiles number areas, by sorted code, and the two
	// features of B written as the one multipolygon they are.
	const rows = readParquet(body).rows as Array<{
		id: number;
		code: string;
		name: string;
		geometry: Buffer;
	}>;
	assert.deepEqual(
		rows.map(({ id, code, name, geometry }) => ({
			id,
			code,
			name,
			wkbType: Buffer.from(geometry).readUInt32LE(1),
		})),
		[
			{ id: 1, code: "A", name: "Ay", wkbType: 3 },
			{ id: 2, code: "B", name: "Bee", wkbType: 6 },
		],
	);
	// Built once, then held.
	assert.equal(
		(
			downloads.get(
				"ward",
				"2017-12-gb-bgc",
				"none",
				entry.contentHash,
			) as { body: Buffer }
		).body,
		body,
	);
	// A store that no longer matches the published hash is refused.
	assert.deepEqual(
		downloads.get("ward", "2017-12-gb-bgc", "none", "sha256:other"),
		{ status: "stale" },
	);
});

test("builds a full-detail download off the main thread, once for callers asking together", async (t) => {
	const root = mkdtempSync(join(tmpdir(), "atlas-full-detail-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	mkdirSync(join(root, "data/source"), { recursive: true });
	writeFileSync(
		join(root, "data/source", "wards.geojson"),
		JSON.stringify({
			type: "FeatureCollection",
			features: ["A", "B", "C"].map((code, index) => ({
				properties: { CODE: code },
				geometry: {
					type: "Polygon",
					coordinates: square(index * 2, 50),
				},
			})),
		}),
	);
	const cache = new AreaGeometryCache(
		root,
		new Map([
			[
				"ward/2017-12-gb-bgc",
				{
					input: "wards.geojson",
					crs: "EPSG:4326",
					codeProperty: "CODE",
				},
			],
		]),
	);
	const release = {
		id: "2017-12-gb-bgc",
		geography: "ward",
		source: {
			publisher: "ONS",
			licence: { name: "Open Government Licence v3.0" },
		},
	};
	const resolver = {
		boundaryRelease: () => release as never,
		releaseAreas: () =>
			new Map(
				["A", "B", "C"].map((code) => [code, { code, name: code }]),
			) as never,
	};
	const expected = compileFlatDownloads(
		cache,
		{ ...release, title: "Wards" } as never,
		new Map(["A", "B", "C"].map((code) => [code, code])),
		"",
	)!.features[0]!.contentHash;
	const downloads = new FullDetailDownloads(cache, resolver);
	const asked = ["ward", "2017-12-gb-bgc", "none", expected] as const;
	const first = downloads.build(...asked);
	assert.equal(downloads.build(...asked), first);
	const built = await first;
	assert.equal(built.status, "built");
	assert.equal(sha256((built as { body: Buffer }).body), expected);
	// Held once built, for the synchronous route too.
	assert.equal(
		(downloads.get(...asked) as { body: Buffer }).body,
		(built as { body: Buffer }).body,
	);
});
