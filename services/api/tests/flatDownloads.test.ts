import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import { AreaGeometryCache } from "../src/areaGeometry";
import { compileFlatDownloads } from "../src/flatDownloads";

const square = (west: number, south: number) => [
	[
		[west, south],
		[west + 1, south],
		[west + 1, south + 1],
		[west, south + 1],
		[west, south],
	],
];

test("writes a release that cannot be tiled whole, at full detail", (t) => {
	const root = mkdtempSync(join(tmpdir(), "atlas-flat-downloads-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const directory = join(root, "data", "boundaries", "ward");
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
	const compiled = compileFlatDownloads(
		cache,
		{
			id: "2017-12-gb-bgc",
			geography: "ward",
			title: "Wards, December 2017",
			source: {
				publisher: "ONS",
				url: "https://example.com",
				licence: { name: "Open Government Licence v3.0" },
			},
		},
		new Map([
			["A", "Ay"],
			["B", "Bee"],
		]),
		"map-resources/ward-2017-12-gb-bgc",
		"ward/2017-12-gb-bgc is not a coverage.",
	)!;
	assert.equal(
		compiled.downloads.reason,
		"ward/2017-12-gb-bgc is not a coverage.",
	);
	assert.deepEqual(
		compiled.downloads.features.map(
			({ tier, format, rowCount, coordinates }) => ({
				tier,
				format,
				rowCount,
				coordinates,
			}),
		),
		[
			{
				tier: "full",
				format: "geoparquet-1.1",
				rowCount: 2,
				coordinates: 15,
			},
			{ tier: "full", format: "geojson", rowCount: 2, coordinates: 15 },
		],
	);
	assert.deepEqual(
		compiled.files.map((file) => file.artifact),
		[
			"map-resources/ward-2017-12-gb-bgc-full.parquet",
			"map-resources/ward-2017-12-gb-bgc-full.geojson.gz",
		],
	);
	const geoJson = JSON.parse(
		gunzipSync(compiled.files[1]!.body).toString(),
	) as {
		features: Array<{
			id: number;
			properties: { code: string; name: string };
			geometry: { type: string; coordinates: unknown[] };
		}>;
	};
	// Numbered as the tiles number areas, by sorted code, and the two
	// features of B written as the one multipolygon they are.
	assert.deepEqual(
		geoJson.features.map(({ id, properties, geometry }) => ({
			id,
			code: properties.code,
			type: geometry.type,
			parts:
				geometry.type === "MultiPolygon"
					? geometry.coordinates.length
					: 1,
		})),
		[
			{ id: 1, code: "A", type: "Polygon", parts: 1 },
			{ id: 2, code: "B", type: "MultiPolygon", parts: 2 },
		],
	);
});
