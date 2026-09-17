import assert from "node:assert/strict";
import test from "node:test";
import { route as routeRequest } from "../src/routes";
import type { RouteContext } from "../src/routing";
import type { BoundaryRegistry } from "../src/boundaryRegistry";
import {
	registry,
	areaLookup,
	compatibleWardAreaLookup,
	crosswalkInventory,
	containmentCrosswalk,
	crosswalkLookup,
	dataCatalog,
	measureObservations,
	populationObservations,
	populationLocalAuthorityObservations,
	measureCompatibilityInventory,
	atlasRelease,
	testContext,
	validationReport,
} from "./routeFixtures";

const citationRegistry: BoundaryRegistry = {
	...registry,
	releases: [
		...registry.releases,
		{
			id: "2023-05-uk-bgc",
			geography: "ward",
			title: "Wards, May 2023",
			coverage: { countries: ["GB-ENG", "GB-WLS"] },
			source: {
				publisher: "ONS",
				url: "https://example.com/wards-2023",
				retrievedAt: "2026-01-01",
				licence: { name: "Open Government Licence" },
			},
			metadataHash: "sha256:wards-2023-metadata",
		},
		{
			id: "2025-01-uk-lad",
			geography: "localAuthority",
			title: "Local authorities",
			coverage: { countries: ["GB-ENG"] },
			source: {
				publisher: "ONS",
				url: "https://example.com/lad",
				licence: { name: "Open Government Licence" },
			},
			metadataHash: "sha256:lad-metadata",
		},
		// The endpoints of the constituency crosswalk, which maps no ward.
		...["2010", "2024-07-uk-bgc"].map((id) => ({
			id,
			geography: "constituency",
			title: `Constituencies ${id}`,
			coverage: { countries: ["GB-ENG"] },
			source: {
				publisher: "ONS",
				url: "https://example.com/constituencies",
				licence: { name: "Open Government Licence" },
			},
			metadataHash: `sha256:constituency-${id}-metadata`,
		})),
	],
};

const citationContext = {
	boundaryRegistry: citationRegistry,
	areaInventory: {
		schemaVersion: 1,
		contentHash: "sha256:area-inventory",
		boundaryRegistryHash: "sha256:registry",
		releases: [
			{
				id: "2025-01-en-ward",
				geography: "ward",
				status: "available",
				recordCount: 2,
				artifact: "areas/ward/2025-01-en-ward.json",
				contentHash: "sha256:areas",
				codeProperty: "WD25CD",
				nameProperty: "WD25NM",
			},
		],
	},
	areaLookup: new Map([...areaLookup, ...compatibleWardAreaLookup]),
	crosswalkInventory: {
		...crosswalkInventory,
		crosswalks: [
			...crosswalkInventory.crosswalks,
			{
				id: containmentCrosswalk.id,
				from: containmentCrosswalk.from,
				to: containmentCrosswalk.to,
				method: containmentCrosswalk.method,
				quality: containmentCrosswalk.quality,
				weighting: containmentCrosswalk.weighting,
				recordCount: containmentCrosswalk.records.length,
				artifact: `crosswalks/${containmentCrosswalk.id}.json`,
				contentHash: containmentCrosswalk.contentHash,
			},
		],
	},
	crosswalkLookup,
	atlasRelease,
	validationReport,
	dataCatalog: {
		...dataCatalog,
		datasets: [
			...dataCatalog.datasets,
			{
				...dataCatalog.datasets[0]!,
				id: "population-uk",
				label: "Population (UK)",
			},
		],
	},
	populationObservations,
	populationLocalAuthorityObservations,
	measureObservations,
	measureCompatibilityInventory,
} satisfies RouteContext;

const citation = (url: string, context: RouteContext = citationContext) => {
	const response = routeRequest("GET", url, testContext(context));
	return {
		status: response.status,
		data: ("data" in response.body ? response.body.data : undefined) as
			Record<string, unknown> | undefined,
		detail: "detail" in response.body ? response.body.detail : undefined,
	};
};

test("cites an area with its release, identity hash, validation and attribution", () => {
	const { status, data } = citation(
		"/v1/areas/ward/2025-01-en-ward/E05000001/citation?crosswalk=ward-to-local-authority-2025",
	);
	assert.equal(status, 200);
	assert.ok(data);
	assert.deepEqual(data.atlasRelease, {
		id: "sha256:atlas-release",
		href: "/v1/atlas-releases/sha256:atlas-release",
	});
	assert.deepEqual(data.identity, {
		status: "available",
		artifact: "areas/ward/2025-01-en-ward.json",
		contentHash: "sha256:areas",
	});
	assert.deepEqual(data.boundary, {
		id: "ward/2025-01-en-ward",
		title: "Ward boundaries",
		publisher: "ONS",
		sourceUrl: "https://example.com/source",
		licence: { name: "Open Government Licence" },
		metadataHash: "sha256:metadata",
		href: "/v1/boundary-releases/ward/2025-01-en-ward",
	});
	assert.equal(
		(data.geometry as { hash: { status: string } }).hash.status,
		"not-published",
	);
	assert.deepEqual(data.crosswalks, [
		{
			id: "ward-to-local-authority-2025",
			method: "clean-containment",
			quality: "publisher-supplied",
			from: { geography: "ward", boundaryRelease: "2025-01-en-ward" },
			to: {
				geography: "localAuthority",
				boundaryRelease: "2025-01-uk-lad",
			},
			contentHash: "sha256:containment-artifact",
			provenance: { input: "lookup.geojson", inputHash: "sha256:input" },
			href: "/v1/crosswalks/ward-to-local-authority-2025",
		},
	]);
	assert.deepEqual(data.validation, {
		status: "available",
		reportHash: "sha256:validation",
		resources: [
			{ id: "atlas", status: "not-validated" },
			{
				...validationReport.resources[0],
				href: "/v1/validation/boundary-releases/ward/2025-01-en-ward",
			},
			{
				id: "crosswalks/ward-to-local-authority-2025",
				status: "not-validated",
			},
		],
	});
	assert.deepEqual(
		(data.resources as Array<{ id: string }>).map(
			(resource) => resource.id,
		),
		[
			"ward/2025-01-en-ward",
			"localAuthority/2025-01-uk-lad",
			"ward-to-local-authority-2025",
		],
	);
	assert.match(
		data.text as string,
		/Compiled by the UK Data Atlas, release sha256:atlas-release\.$/,
	);
});

test("cites a measure through the observations holding the area's value", () => {
	const { status, data } = citation(
		"/v1/areas/ward/2023-05-uk-bgc/E05000001/citation?measure=population-estimate",
	);
	assert.equal(status, 200);
	assert.ok(data);
	assert.deepEqual(data.identity, { status: "not-published" });
	assert.deepEqual(data.measures, [
		{
			id: "population-estimate",
			label: "Population estimate",
			href: "/v1/measures/population-estimate",
			sources: [
				{
					dataset: {
						id: "population",
						href: "/v1/datasets/population",
					},
					sourceGeography: { type: "ward", boundaryYear: 2023 },
					codeSetCompatibility: {
						status: "code-set-compatible",
						eligibleForCodeJoin: true,
					},
					periods: [
						{
							period: "2022",
							artifact: "population-observations",
							contentHash: "sha256:population-observations",
							status: "observed",
						},
					],
				},
			],
		},
	]);
	// The measure's local-authority partition holds nothing for a ward, so
	// its dataset is not credited.
	assert.deepEqual(
		(data.resources as Array<{ id: string }>).map(
			(resource) => resource.id,
		),
		["population", "ward/2023-05-uk-bgc"],
	);
});

test("refuses to cite a resource that supplies nothing for the area", () => {
	const unrelatedCrosswalk = citation(
		"/v1/areas/ward/2025-01-en-ward/E05000001/citation?crosswalk=constituency-2010-to-2024",
	);
	assert.equal(unrelatedCrosswalk.status, 422);
	assert.equal(
		unrelatedCrosswalk.detail,
		"crosswalk=constituency-2010-to-2024 publishes no relationship for ward/2025-01-en-ward/E05000001.",
	);
	const unassessedMeasure = citation(
		"/v1/areas/ward/2025-01-en-ward/E05000001/citation?measure=population-estimate",
	);
	assert.equal(unassessedMeasure.status, 422);
	assert.equal(
		unassessedMeasure.detail,
		"measure=population-estimate publishes no observation for ward/2025-01-en-ward/E05000001 in a source assessed against this boundary release.",
	);
	assert.equal(
		citation(
			"/v1/areas/ward/2025-01-en-ward/E05000001/citation?measure=unknown",
		).status,
		404,
	);
	assert.equal(
		citation("/v1/areas/ward/2025-01-en-ward/E05999999/citation").status,
		404,
	);
	assert.equal(
		citation("/v1/areas/ward/2025-01-en-ward/E05000001/citation", {
			...citationContext,
			dataCatalog: undefined,
		}).status,
		503,
	);
});
