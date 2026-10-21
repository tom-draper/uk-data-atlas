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
	assert.match(listedData?.note ?? "", /publisher-observation/);

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
		JSON.parse(String(downloaded.representation?.body ?? "{}")),
		measureObservations[0],
	);
	for (const format of ["csv", "parquet"] as const) {
		const file = {
			format,
			artifact: `exports/fixture.${format}`,
			bytes: 42,
			contentHash: "sha256:download",
			href: `/v1/exports/small-area-fixture?format=${format}`,
		};
		const entry = { ...manifest.exports[0], formats: [file] };
		const stored = {
			path: `/tmp/fixture.${format}`,
			bytes: file.bytes,
			contentHash: file.contentHash,
		};
		const response = routeWithCatalog(
			file.href,
			dataCatalog,
			measureObservations,
			{
				exportManifest: { ...manifest, exports: [entry] },
				exportFiles: new Map([[file.artifact, stored]]),
			},
		);
		assert.equal(response.status, 200);
		assert.equal(response.representation?.body, stored);
		assert.equal(
			response.representation?.contentType,
			format === "csv"
				? "text/csv; charset=utf-8"
				: "application/vnd.apache.parquet",
		);
		assert.equal(
			response.representation?.headers?.["content-disposition"],
			`attachment; filename="small-area-fixture.${format}"`,
		);
		assert.equal(
			routeWithCatalog(file.href, dataCatalog, measureObservations, {
				exportManifest: manifest,
			}).status,
			503,
		);
		// A stored file that does not match the listed encoding is refused.
		assert.equal(
			routeWithCatalog(file.href, dataCatalog, measureObservations, {
				exportManifest: { ...manifest, exports: [entry] },
				exportFiles: new Map([
					[file.artifact, { ...stored, gzipBytes: 7 }],
				]),
			}).status,
			503,
		);
	}
	const gzipped = {
		format: "csv" as const,
		artifact: "exports/fixture.csv.gz",
		bytes: 42,
		gzipBytes: 12,
		contentHash: "sha256:download",
		href: "/v1/exports/small-area-fixture?format=csv",
	};
	const gzippedStored = {
		path: "/tmp/fixture.csv.gz",
		bytes: 42,
		gzipBytes: 12,
		contentHash: "sha256:download",
	};
	const gzippedResponse = routeWithCatalog(
		gzipped.href,
		dataCatalog,
		measureObservations,
		{
			exportManifest: {
				...manifest,
				exports: [{ ...manifest.exports[0], formats: [gzipped] }],
			},
			exportFiles: new Map([[gzipped.artifact, gzippedStored]]),
		},
	);
	assert.equal(gzippedResponse.status, 200);
	assert.equal(gzippedResponse.representation?.body, gzippedStored);
	assert.equal(
		routeWithCatalog(
			"/v1/exports/small-area-fixture?format=xlsx",
			dataCatalog,
			measureObservations,
			{ exportManifest: manifest },
		).status,
		400,
	);
});
