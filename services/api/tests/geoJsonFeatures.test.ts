import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { type TestContext } from "node:test";
import {
	parseGeoJsonFeatures,
	readGeoJsonFeatures,
} from "@uk-data-atlas/atlas-runtime/areas";

const read = (t: TestContext, text: string) => {
	const directory = mkdtempSync(join(tmpdir(), "atlas-geojson-features-"));
	t.after(() => rmSync(directory, { recursive: true, force: true }));
	const path = join(directory, "source.geojson");
	writeFileSync(path, text);
	const result = readGeoJsonFeatures(path);
	return result.type === "FeatureCollection" ? [...result.features] : result;
};

test("decodes feature spans with escapes, nested geometry and exact numeric values", (t) => {
	assert.deepEqual(
		read(
			t,
			String.raw` {"metadata":{"features":["ignored"]},"features":[{"properties":{"name":"M\u00f4n 🏝","text":"\"features\":[{}] \\ } ]"},"geometry":{"type":"GeometryCollection","geometries":[{"type":"Point","coordinates":[-0,1.2345678901234567,1e-7]}]}},null,17,[],"features"],"type":"FeatureCollection"} `,
		),
		[
			{
				properties: { name: "Môn 🏝", text: '"features":[{}] \\ } ]' },
				geometry: {
					type: "GeometryCollection",
					geometries: [
						{
							type: "Point",
							coordinates: [-0, 1.2345678901234567, 1e-7],
						},
					],
				},
			},
			null,
			17,
			[],
			"features",
		],
	);
});

test("validates the collection type and uses the last duplicate member", (t) => {
	assert.deepEqual(read(t, '{"type":"FeatureCollection","features":[]}'), []);
	assert.deepEqual(
		read(t, '{"type":"FeatureCollection","features":[1],"features":[2]}'),
		[2],
	);
	for (const text of [
		"null",
		"[]",
		"17",
		'{"type":"Feature"}',
		'{"type":"FeatureCollection"}',
		'{"type":"FeatureCollection","features":{}}',
		'{"type":"FeatureCollection","features":[],"features":null}',
	])
		assert.deepEqual(read(t, text), { type: "invalid" });
});

test("rejects malformed features, metadata, collection structure and trailing JSON", (t) => {
	for (const text of [
		'{"type":"FeatureCollection","features":[{"geometry":}]}',
		'{"type":"FeatureCollection","features":[{"coordinates":[1,2}]}',
		'{"type":"FeatureCollection","features":["\\uZZZZ"]}',
		'{"type":"FeatureCollection","features":[],"metadata":{"x":}}',
		'{"type":"FeatureCollection","features":[1,]}',
		'{"type":"FeatureCollection","features":[{"x":}],"features":[]}',
		'{"type":"FeatureCollection","features":[],}',
		'{"type":"FeatureCollection","features":[{',
		'{"type":"FeatureCollection","features":[]} {}',
	])
		assert.throws(() => read(t, text), SyntaxError, text);
});

test("decodes features from bytes a caller has already read", () => {
	const result = parseGeoJsonFeatures(
		Buffer.from(
			'{"type":"FeatureCollection","features":[{"properties":{"code":"E00000001"},"geometry":null}]}',
		),
	);
	assert.equal(result.type, "FeatureCollection");
	assert.deepEqual(
		result.type === "FeatureCollection" && [...result.features],
		[{ properties: { code: "E00000001" }, geometry: null }],
	);
});
