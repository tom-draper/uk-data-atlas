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
		"/v1/data/population/series?place=N09000001&geography=localAuthority&boundaryYear=2023",
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
			"/v1/data/population/series?place=N09000001&geography=localAuthority&boundaryYear=2023&release=2023-05-uk-bgc",
		).status,
		422,
	);
	assert.equal(
		routeWithData(
			"/v1/data/population/series?place=unknown&geography=localAuthority&boundaryYear=2023",
		).status,
		404,
	);
});

test("returns a reviewed derived series on an explicit analysis geography", () => {
	const route = (url: string) =>
		routeWithCatalog(url, dataCatalog, measureObservations, {
			crosswalkLookup: new Map([
				[analysisCrosswalk.id, analysisCrosswalk],
			]),
			analysisGeographyInventory: analysisInventory,
		});
	const response = route(
		"/v1/data/small-area-fixture/series?place=E08000001&geography=lsoa&boundaryYear=2011&to=localAuthority/2023-05-uk-bgc-v2",
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
			"/v1/data/small-area-fixture/series?place=E08000001&geography=lsoa&boundaryYear=2011&to=ward/2023-05-uk-bgc",
		).status,
		200,
	);
	const unavailable = route(
		"/v1/data/small-area-fixture/series?place=E08000001&geography=lsoa&boundaryYear=2011&to=ward/2023-05-uk-bgc",
	);
	assert.deepEqual(
		"data" in unavailable.body &&
			(unavailable.body.data as { status: string }).status,
		"not-comparable",
	);
});

test("returns a reviewed derived series through every step of a reviewed path", () => {
	const authorityToRegion: PropertyCrosswalkArtifact = {
		...crosswalkArtifact,
		id: "local-authority-2023-to-region-2023",
		from: analysisCrosswalk.to,
		to: { geography: "region", boundaryRelease: "2023-05-en-rgn" },
		records: [
			{
				source: { code: "E08000001", labels: ["Example authority"] },
				targets: [{ code: "E12000002", labels: ["Example region"] }],
			},
		],
	};
	const summary = (artifact: PropertyCrosswalkArtifact) => ({
		id: artifact.id,
		method: artifact.method,
		quality: artifact.quality,
	});
	const [reviewed] = analysisInventory.supports;
	const inventory: AnalysisGeographyInventory = {
		...analysisInventory,
		relationshipPathInventoryHash: "sha256:paths",
		supports: [
			{
				...reviewed!,
				analysisGeography: authorityToRegion.to,
				crosswalk: undefined,
				path: {
					id: "lsoa-2011-to-region-2023",
					purpose: "membership",
					origin: "declared",
					quality: "publisher-supplied",
					steps: [analysisCrosswalk, authorityToRegion].map(
						(artifact) => ({
							crosswalk: summary(artifact),
							direction: "forward" as const,
						}),
					),
				},
			},
		],
	};
	const response = routeWithCatalog(
		"/v1/data/small-area-fixture/series?place=E12000002&geography=lsoa&boundaryYear=2011&to=region/2023-05-en-rgn",
		dataCatalog,
		measureObservations,
		{
			crosswalkLookup: new Map([
				[analysisCrosswalk.id, analysisCrosswalk],
				[authorityToRegion.id, authorityToRegion],
			]),
			analysisGeographyInventory: inventory,
		},
	);
	assert.equal(response.status, 200);
	const data = (response.body as { data: Record<string, any> }).data;
	assert.deepEqual(
		data.series.map(
			({ period, value }: { period: string; value: number }) => [
				period,
				value,
			],
		),
		[["2019", 3100]],
	);
	assert.equal(data.conversion.method, "relationship-path");
	assert.equal(data.conversion.id, "lsoa-2011-to-region-2023");
	assert.deepEqual(
		data.conversion.steps.map(
			({ crosswalk }: { crosswalk: { id: string } }) => crosswalk.id,
		),
		[analysisCrosswalk.id, authorityToRegion.id],
	);
	assert.match(
		data.provenance.transformation.note,
		/every step of the reviewed path/,
	);
});

test("takes a place reference that carries its own geography", () => {
	const byCode = routeWithData(
		"/v1/data/population/series?place=N09000001&geography=localAuthority&boundaryYear=2023",
	);
	const byReference = routeWithData(
		"/v1/data/population/series?place=localAuthority/N09000001&boundaryYear=2023",
	);
	assert.equal(byReference.status, 200);
	assert.deepEqual(byReference.body, byCode.body);

	const disagreeing = routeWithData(
		"/v1/data/population/series?place=ward/N09000001&geography=localAuthority&boundaryYear=2023",
	);
	assert.equal(disagreeing.status, 400);
	assert.match(
		(disagreeing.body as { detail: string }).detail,
		/place names a ward but geography is localAuthority/,
	);

	// A postcode or a curated location is answered by another route, which
	// the refusal names.
	for (const [place, route] of [
		["postcode/SW1A1AA", "/value"],
		["location/north-west", "/aggregate"],
	] as const) {
		const refused = routeWithData(
			`/v1/data/population/series?place=${place}&geography=localAuthority&boundaryYear=2023`,
		);
		assert.equal(refused.status, 400, place);
		assert.ok(
			(refused.body as { detail: string }).detail.includes(route),
			place,
		);
	}
});
