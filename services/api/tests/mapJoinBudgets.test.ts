import assert from "node:assert/strict";
import test from "node:test";
import type { PopulationObservation } from "../src/dataCatalog";
import type { MapResourceDescriptor } from "@uk-data-atlas/map-tiles/mapResources";
import { TOPOLOGY_METHOD } from "@uk-data-atlas/map-tiles/topologyTiers";
import {
	MAX_MAP_JOIN_ROWS,
	MAX_MAP_JOIN_COLUMN_BYTES,
} from "../src/mapResourceRoutes";
import { route } from "../src/routes";
import { readParquet } from "./parquetFixtures";
import {
	compatibleWardAreaLookup,
	dataCatalog,
	measureCompatibilityInventory,
	populationObservations,
	testContext,
} from "./routeFixtures";

const resource: MapResourceDescriptor = {
	id: "ward/2023-05-uk-bgc",
	geography: "ward",
	boundaryRelease: "2023-05-uk-bgc",
	title: "Fixture wards",
	topology: "shared-arc",
	areaCount: 3,
	arcCount: 0,
	bounds: [-1, 50, 1, 54],
	tiles: {
		artifact: "fixture.pmtiles",
		href: "/v1/map-resources/ward/2023-05-uk-bgc.pmtiles",
		format: "pmtiles-3",
		tileFormat: "mvt-2.1",
		layer: "areas",
		minZoom: 0,
		maxZoom: 0,
		zooms: [],
		tileCount: 0,
		bytes: 0,
		contentHash: "sha256:fixture",
	},
	tiers: [],
	features: [],
	generalisation: TOPOLOGY_METHOD,
	geometrySource: {},
	attribution: {
		text: "Fixture",
		publisher: "Fixture",
		sourceUrl: "https://example.com",
		licence: { name: "Fixture" },
		href: "/v1/attribution",
	},
};
const url =
	"/v1/map-resources/ward/2023-05-uk-bgc/join/population?period=2022&geography=ward&codeYear=2023";
const contextFor = (records: PopulationObservation[]) =>
	testContext({
		areaLookup: compatibleWardAreaLookup,
		dataCatalog,
		measureCompatibilityInventory,
		measureObservations: [
			{
				...populationObservations,
				periods: [{ period: "2022", records }],
			},
		],
		mapResources: { resources: [resource] },
	});
const record: PopulationObservation = {
	areaCode: "E05000001",
	value: 5,
	status: "observed",
};

test("refuses oversized joins before reading records for either representation", () => {
	const records = new Array<PopulationObservation>(MAX_MAP_JOIN_ROWS + 1);
	Object.defineProperty(records, "0", {
		get() {
			throw new Error("oversized join was traversed");
		},
	});
	const context = contextFor(records);
	for (const format of ["json", "parquet"]) {
		const response = route("GET", `${url}&format=${format}`, context);
		assert.equal(response.status, 422);
		assert.ok("title" in response.body && "links" in response.body);
		assert.equal(response.body.title, "Map Join Budget Exceeded");
		assert.match(
			response.body.links!.data!,
			/period=2022&geography=ward&codeYear=2023&datasetId=population/,
		);
		assert.equal(response.representation, undefined);
	}
});

test("accepts the row limit and preserves JSON and Parquet row order and values", () => {
	const small = contextFor([
		record,
		{ ...record, areaCode: "W05000001", value: 9 },
	]);
	const json = route("GET", `${url}&format=json`, small);
	const parquet = route("GET", `${url}&format=parquet`, small);
	assert.equal(json.status, 200);
	assert.equal(parquet.status, 200);
	assert.ok("data" in json.body);
	assert.ok(Buffer.isBuffer(parquet.representation?.body));
	const data = json.body.data;
	assert.ok(typeof data === "object" && data !== null && "values" in data);
	assert.deepEqual(
		readParquet(parquet.representation.body).rows,
		data.values,
	);
	const boundary = route(
		"GET",
		`${url}&format=json`,
		contextFor(Array(MAX_MAP_JOIN_ROWS).fill(record)),
	);
	assert.equal(boundary.status, 200);
});

test("counts UTF-8 column bytes and refuses without a partial response", () => {
	const areaCode = "é".repeat(1000);
	const bytesPerRow =
		20 + Buffer.byteLength(areaCode) + Buffer.byteLength(record.status);
	const records = Array<PopulationObservation>(
		Math.floor(MAX_MAP_JOIN_COLUMN_BYTES / bytesPerRow) + 1,
	).fill({ ...record, areaCode });
	const context = contextFor(records);
	for (const format of ["json", "parquet"]) {
		const response = route("GET", `${url}&format=${format}`, context);
		assert.equal(response.status, 422);
		assert.equal(response.representation, undefined);
	}
});
