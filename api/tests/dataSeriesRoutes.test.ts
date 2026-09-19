import assert from "node:assert/strict";
import test from "node:test";
import type { AnalysisGeographyInventory } from "../src/analysisGeographies";
import type { PropertyCrosswalkArtifact } from "../src/crosswalkInventory";
import {
	crosswalkArtifact,
	dataCatalog,
	measureObservations,
	routeWithCatalog,
	routeWithData,
} from "./routeFixtures";

const analysisCrosswalk: PropertyCrosswalkArtifact = {
	...crosswalkArtifact,
	id: "lsoa-2011-to-local-authority-2023",
	from: { geography: "lsoa", boundaryRelease: "2011-12-ew-bgc" },
	to: {
		geography: "localAuthority",
		boundaryRelease: "2023-05-uk-bgc-v2",
	},
	records: [
		{
			source: { code: "E01000001", labels: ["Example 1"] },
			targets: [{ code: "E08000001", labels: ["Example authority"] }],
		},
		{
			source: { code: "E01000002", labels: ["Example 2"] },
			targets: [{ code: "E08000001", labels: ["Example authority"] }],
		},
	],
};

const analysisInventory: AnalysisGeographyInventory = {
	schemaVersion: 1,
	contentHash: "sha256:analysis-geographies",
	dataCatalogHash: "sha256:data-catalog",
	crosswalkInventoryHash: "sha256:crosswalk-inventory",
	supports: [
		{
			measureId: "small-area-fixture",
			analysisGeography: {
				geography: "localAuthority",
				boundaryRelease: "2023-05-uk-bgc-v2",
			},
			source: {
				datasetId: "small-area",
				geography: "lsoa",
				boundaryYear: 2011,
				periods: ["2019"],
			},
			crosswalk: {
				id: analysisCrosswalk.id,
				method: "clean-containment",
				quality: "publisher-supplied",
			},
			note: "Exact regrouping.",
		},
	],
};

test("returns a source-exact series without selecting a geometry release", () => {
	const response = routeWithData(
		"/v1/data/population-estimate/series?areaCode=N09000001&geography=localAuthority&boundaryYear=2023",
	);
	assert.equal(response.status, 200);
	const data = "data" in response.body ? response.body.data : undefined;
	assert.ok(data && typeof data === "object");
	assert.deepEqual((data as { series: unknown }).series, [
		{
			period: "2022",
			areaCode: "N09000001",
			value: 380,
			status: "observed",
		},
		{
			period: "2023",
			areaCode: "N09000001",
			value: 390,
			status: "observed",
		},
		{
			period: "2024",
			areaCode: "N09000001",
			value: 400,
			status: "observed",
		},
	]);
	assert.deepEqual(
		(data as { provenance: { source: { observations: unknown } } })
			.provenance.source.observations,
		{
			artifact: "population-local-authority-observations",
			contentHash: "sha256:population-local-authority-observations",
			periods: ["2022", "2023", "2024"],
		},
	);

	assert.equal(
		routeWithData(
			"/v1/data/population-estimate/series?areaCode=N09000001&geography=localAuthority&boundaryYear=2023&release=2023-05-uk-bgc",
		).status,
		422,
	);
	assert.equal(
		routeWithData(
			"/v1/data/population-estimate/series?areaCode=unknown&geography=localAuthority&boundaryYear=2023",
		).status,
		404,
	);
});

test("returns a reviewed derived series on an explicit analysis geography", () => {
	const route = (url: string) =>
		routeWithCatalog(url, dataCatalog, measureObservations, {
			crosswalkLookup: new Map([[analysisCrosswalk.id, analysisCrosswalk]]),
			analysisGeographyInventory: analysisInventory,
		});
	const response = route(
		"/v1/data/small-area-fixture/series?areaCode=E08000001&geography=lsoa&boundaryYear=2011&analysisGeography=localAuthority/2023-05-uk-bgc-v2",
	);
	assert.equal(response.status, 200);
	const data = "data" in response.body ? response.body.data : undefined;
	assert.deepEqual((data as { status: string }).status, "available");
	assert.deepEqual((data as { basis: string }).basis, "derived");
	assert.deepEqual((data as { series: unknown }).series, [
		{
			period: "2019",
			areaCode: "E08000001",
			value: 3100,
			status: "derived",
			inputAreaCount: 2,
			basis: "derived",
		},
	]);
	assert.equal(
		route(
			"/v1/data/small-area-fixture/series?areaCode=E08000001&geography=lsoa&boundaryYear=2011&analysisGeography=ward/2023-05-uk-bgc",
		).status,
		200,
	);
	const unavailable = route(
		"/v1/data/small-area-fixture/series?areaCode=E08000001&geography=lsoa&boundaryYear=2011&analysisGeography=ward/2023-05-uk-bgc",
	);
	assert.deepEqual(
		"data" in unavailable.body &&
			(unavailable.body.data as { status: string }).status,
		"not-comparable",
	);
});
