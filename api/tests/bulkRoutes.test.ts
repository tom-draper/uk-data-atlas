import assert from "node:assert/strict";
import test from "node:test";
import {
	dataCatalog,
	measureObservations,
	routeWithCatalog,
} from "./routeFixtures";

test("lists and downloads release-pinned whole observation artifacts", () => {
	const measure = dataCatalog.measures.find(
		(candidate) => candidate.id === "small-area-fixture",
	);
	const source = measure?.sources[0];
	assert.ok(measure && source);
	const manifest = {
		schemaVersion: 1 as const,
		contentHash: "sha256:export-manifest",
		dataCatalogHash: dataCatalog.contentHash,
		fields: {},
		datasets: {},
		exports: [
			{
				id: "small-area-fixture",
				measureId: measure.id,
				datasetId: source.datasetId,
				periods: source.periods,
				sourceGeography: source.sourceGeography,
				format: "json" as const,
				artifact: "small-area-fixture",
				contentHash: "sha256:small-area-observations",
				bytes: 123,
				href: "/v1/exports/small-area-fixture",
				recordCount: 2,
				recordCountByPeriod: { [source.periods[0]]: 2 },
				schema: {
					version: 1,
					layout: "periods" as const,
					recordType: "numeric" as const,
					fields: [],
				},
				provenance: {
					measure: `/v1/measures/${measure.id}`,
					datasets: [],
				},
			},
		],
	};
	const listed = routeWithCatalog(
		"/v1/exports",
		dataCatalog,
		measureObservations,
		{ exportManifest: manifest },
	);
	assert.equal(listed.status, 200);
	const listedData =
		"data" in listed.body
			? (listed.body.data as {
					exports: typeof manifest.exports;
					note: string;
				})
			: undefined;
	assert.deepEqual(listedData?.exports, manifest.exports);
	assert.match(listedData?.note ?? "", /source-exact/);

	const downloaded = routeWithCatalog(
		"/v1/exports/small-area-fixture",
		dataCatalog,
		measureObservations,
		{ exportManifest: manifest },
	);
	assert.equal(downloaded.status, 200);
	assert.equal(downloaded.representation?.contentType, "application/json");
	assert.equal(
		downloaded.representation?.headers?.["content-disposition"],
		'attachment; filename="small-area-fixture.json"',
	);
	assert.deepEqual(
		JSON.parse(downloaded.representation?.body ?? "{}"),
		measureObservations[0],
	);
});
