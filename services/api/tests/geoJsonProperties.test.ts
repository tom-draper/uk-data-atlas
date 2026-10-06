import assert from "node:assert/strict";
import test from "node:test";
import { parseGeoJsonProperties } from "../src/geoJsonProperties";

test("reads each feature's properties without its geometry", () => {
	const text = JSON.stringify({
		type: "FeatureCollection",
		crs: { type: "name", properties: { name: "EPSG:27700" } },
		features: [
			{
				type: "Feature",
				geometry: {
					type: "Polygon",
					coordinates: [
						[
							[0, 0],
							[1, 0],
							[0, 0],
						],
					],
				},
				properties: { code: "E05000001", name: 'Quoted "name" } ]' },
			},
			{ type: "Feature", properties: null, geometry: null },
			{
				type: "Feature",
				geometry: { type: "Point", coordinates: [1e-7, -2] },
			},
		],
	});
	assert.deepEqual(parseGeoJsonProperties(text), {
		type: "FeatureCollection",
		properties: [
			{ code: "E05000001", name: 'Quoted "name" } ]' },
			null,
			undefined,
		],
	});
});

test("tolerates whitespace and an empty collection", () => {
	assert.deepEqual(
		parseGeoJsonProperties(
			' {\n "features" : [ ] ,\n\t"type": "FeatureCollection" }\n',
		),
		{ type: "FeatureCollection", properties: [] },
	);
});

test("reports a document that is not a FeatureCollection", () => {
	assert.deepEqual(
		parseGeoJsonProperties('{"type":"Feature","properties":{}}'),
		{ type: "invalid" },
	);
	assert.deepEqual(parseGeoJsonProperties("[]"), { type: "invalid" });
});

test("refuses malformed JSON rather than guess", () => {
	assert.throws(
		() =>
			parseGeoJsonProperties('{"type":"FeatureCollection","features":[{'),
		SyntaxError,
	);
	assert.throws(
		() => parseGeoJsonProperties('{"type":"FeatureCollection"} trailing'),
		SyntaxError,
	);
});

test("decodes UTF-8 bytes, escapes and all, as JSON.parse would", () => {
	const collection = {
		type: "FeatureCollection",
		features: [
			{
				type: "Feature",
				properties: { name: "Ynys Môn", alias: 'Ynys \\ "Môn" 🏝' },
				geometry: { type: "Point", coordinates: [-4.3, 53.3] },
			},
		],
	};
	const text = JSON.stringify(collection);
	const expected = {
		type: "FeatureCollection",
		properties: [collection.features[0]!.properties],
	};
	assert.deepEqual(parseGeoJsonProperties(text), expected);
	assert.deepEqual(parseGeoJsonProperties(Buffer.from(text)), expected);
});
