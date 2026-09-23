import assert from "node:assert/strict";
import test from "node:test";
import { createGeographyResolver } from "../src/geographyResolver";
import { compileRelationshipPaths, createRelationshipPathIndex } from "../src/relationshipPaths";
import { route } from "../src/routes";
import {
	areaLookup,
	containmentCrosswalk,
	crosswalkInventory,
} from "./geographyFixtures";
import {
	registry,
	dataCatalog,
	measureCompatibilityInventory,
} from "./routeFixtures";

const relationshipPathInventory = compileRelationshipPaths(crosswalkInventory);

const compatibleMeasureInventory = {
	...measureCompatibilityInventory,
	measures: [
		...measureCompatibilityInventory.measures.map((measure) => ({
			...measure,
			sources: measure.sources.map((source) => ({
				...source,
				candidates: [
					...source.candidates,
					{
						...source.candidates[0],
						boundaryRelease: "2025-01-en-ward",
					},
				],
			})),
		})),
		{
			measureId: "mobile-5g-coverage",
			sources: [
				{
					datasetId: "mobile-coverage",
					sourceGeography: { type: "localAuthority", boundaryYear: 2024 },
					periods: ["2025"],
					candidates: [
						{
							boundaryRelease: "2025-01-uk-lad",
							title: "Local authority boundaries",
							coverageCountries: ["GB-ENG"],
							status: "exact-code-set" as const,
							sourceCodeCount: 1,
							candidateCodeCount: 1,
							matchingCodeCount: 1,
							matchedSourceShare: 1,
							unmatchedSourceCodeCount: 0,
							unmatchedSourceCodeSample: [],
							candidateOnlyCodeCount: 0,
							candidateOnlyCodeSample: [],
						},
					],
					note: "Compatibility is based only on area-code membership.",
				},
			],
		},
	],
};

const contextFor = ({
	lookup = areaLookup,
	crosswalks = new Map([[containmentCrosswalk.id, containmentCrosswalk]]),
	catalog,
	boundaryRegistry = registry,
	compatibility = compatibleMeasureInventory,
}: {
	lookup?: typeof areaLookup;
	crosswalks?: Map<string, typeof containmentCrosswalk>;
	catalog?: typeof dataCatalog;
	boundaryRegistry?: typeof registry;
	compatibility?: typeof compatibleMeasureInventory;
} = {}) => ({
	boundaryRegistry,
	areaLookup: lookup,
	crosswalkInventory,
	crosswalkLookup: crosswalks,
	relationshipPathInventory,
	dataCatalog: catalog,
	measureCompatibilityInventory: compatibility,
	geographyResolver: createGeographyResolver({
		boundaryRegistry,
		areaLookup: lookup,
		crosswalkInventory,
		crosswalkLookup: crosswalks,
		relationshipPathIndex: createRelationshipPathIndex(
			relationshipPathInventory,
		),
	}),
});

const query =
	"/v1/relationship-capabilities?sourceGeography=ward&sourceRelease=2025-01-en-ward&targetGeography=localAuthority&targetRelease=2025-01-uk-lad&purpose=membership";

const intensiveQuery =
	"/v1/relationship-capabilities?sourceGeography=localAuthority&sourceRelease=2025-01-uk-lad&targetGeography=ward&targetRelease=2025-01-en-ward&purpose=membership";

const mobileSourceRegistry = {
	...registry,
	releases: [
		...registry.releases,
		{
			...registry.releases[0],
			id: "2025-01-uk-lad",
			geography: "localAuthority",
			temporalCoverage: "2024",
		},
	],
};

test("discovers every declared conversion from one source release", () => {
	const response = route(
		"GET",
		"/v1/relationship-capabilities?sourceGeography=ward&sourceRelease=2025-01-en-ward",
		contextFor(),
	);
	assert.equal(response.status, 200);
	const data = (response.body as { data: any }).data;
	assert.equal(data.status, "available");
	assert.equal(data.capabilities.length, 1);
	assert.deepEqual(data.capabilities[0].to, {
		geography: "localAuthority",
		boundaryRelease: "2025-01-uk-lad",
	});
	assert.equal(data.capabilities[0].purpose, "membership");
	assert.equal(data.capabilities[0].paths[0].trust.level, "verified");
});

test("reports an uncompiled discovery source as a build prerequisite", () => {
	const response = route(
		"GET",
		"/v1/relationship-capabilities?sourceGeography=ward&sourceRelease=missing-release",
		contextFor(),
	);
	const data = (response.body as { data: any }).data;
	assert.equal(data.status, "not-built");
	assert.equal(data.missingPrerequisites[0].id, "source-areas");
});

test("reports a complete conversion path with its measured source coverage", () => {
	const response = route("GET", query, contextFor());
	assert.equal(response.status, 200);
	const data = (response.body as { data: any }).data;
	assert.equal(data.status, "available");
	assert.deepEqual(data.paths[0].trust, {
		level: "verified",
		reasons: ["Every path step is publisher-supplied and has complete compiled coverage."],
	});
	assert.deepEqual(data.paths[0].rank, {
		position: 1,
		reasons: [
			"complete source coverage",
			"verified evidence",
			"crosswalk path",
			"1 step",
		],
	});
	assert.deepEqual(data.paths[0].operations, {
		permitted: ["containment-aggregation", "membership-join"],
		prohibited: ["weighted-allocation"],
		note: "Use this path to group members under a parent. It does not allocate a source value across overlapping targets.",
	});
	assert.deepEqual(data.missingPrerequisites, []);
	assert.deepEqual(data.paths[0].coverage, {
		status: "complete",
		mappedSourceAreaCount: 1,
		sourceAreaCount: 1,
		share: 1,
		steps: [
			{
				crosswalkId: containmentCrosswalk.id,
				direction: "forward",
				status: "complete",
				mappedSourceAreaCount: 1,
				sourceAreaCount: 1,
				share: 1,
			},
		],
	});
});

test("preflights an extensive measure against containment aggregation", () => {
	const response = route("GET", `${query}&measure=population-estimate`, contextFor({ catalog: dataCatalog }));
	const data = (response.body as { data: any }).data;
	assert.equal(data.measureReadiness.status, "available");
	assert.equal(data.measureReadiness.operation, "containment-aggregation");
	assert.equal(data.measureReadiness.sourcePartitions[0].datasetId, "population");
	assert.equal(data.measureReadiness.sourcePartitions[0].coverage.recordCount, 2);
	assert.equal(
		data.measureReadiness.sourcePartitions[0].compatibility.status,
		"code-set-compatible",
	);
});

test("refuses a measure whose source partition does not match the source release", () => {
	const compatibility = {
		...compatibleMeasureInventory,
		measures: compatibleMeasureInventory.measures.map((measure) => ({
			...measure,
			sources: measure.sources.map((source) => ({
				...source,
				candidates: source.candidates.filter(
					(candidate) => candidate.boundaryRelease !== "2025-01-en-ward",
				),
			})),
		})),
	};
	const response = route(
		"GET",
		`${query}&measure=population-estimate`,
		contextFor({ catalog: dataCatalog, compatibility }),
	);
	const data = (response.body as { data: any }).data;
	assert.equal(data.measureReadiness.status, "unsupported");
	assert.match(data.measureReadiness.reason, /no published source partition/);
	assert.deepEqual(data.measureReadiness.publishedSourcePartitions, [
		{
			datasetId: "population",
			boundaryYear: 2023,
			periods: ["2022"],
			coverage: {
				kind: "partial",
				countries: ["GB-ENG", "GB-WLS"],
				recordCount: 2,
				note: "England and Wales only.",
			},
		},
	]);
	assert.deepEqual(data.measureReadiness.sourceCompatibility[0].candidates, []);
});

test("returns partial code-set evidence instead of concealing it behind a refusal", () => {
	const compatibility = {
		...compatibleMeasureInventory,
		measures: compatibleMeasureInventory.measures.map((measure) => ({
			...measure,
			sources: measure.sources.map((source) => ({
				...source,
				candidates: source.candidates.map((candidate) =>
					candidate.boundaryRelease === "2025-01-en-ward"
						? {
								...candidate,
								status: "partial-code-overlap" as const,
								matchingCodeCount: 1,
								matchedSourceShare: 0.5,
								unmatchedSourceCodeCount: 1,
								unmatchedSourceCodeSample: ["W05000001"],
							}
						: candidate,
				),
			})),
		})),
	};
	const response = route(
		"GET",
		`${query}&measure=population-estimate`,
		contextFor({ catalog: dataCatalog, compatibility }),
	);
	const data = (response.body as { data: any }).data;
	assert.equal(data.measureReadiness.status, "unsupported");
	assert.match(data.measureReadiness.reason, /partial-code-overlap/);
	assert.equal(
		data.measureReadiness.sourceCompatibility[0].candidates[0]
			.unmatchedSourceCodeCount,
		1,
	);
});

test("reports missing source compatibility evidence as not built", () => {
	const context = contextFor({ catalog: dataCatalog });
	const response = route("GET", `${query}&measure=population-estimate`, {
		...context,
		measureCompatibilityInventory: undefined,
	});
	const data = (response.body as { data: any }).data;
	assert.equal(data.measureReadiness.status, "not-built");
	assert.match(data.measureReadiness.reason, /Build measure compatibility/);
});

test("refuses an intensive measure when its required weighted mean is unavailable", () => {
	const response = route("GET", `${intensiveQuery}&measure=mobile-5g-coverage`, contextFor({ catalog: dataCatalog, boundaryRegistry: mobileSourceRegistry }));
	const data = (response.body as { data: any }).data;
	assert.equal(data.measureReadiness.status, "unsupported");
	assert.match(data.measureReadiness.reason, /weighted mean/);
});

test("names the required denominator for a supported intensive conversion", () => {
	const catalog = {
		...dataCatalog,
		measures: dataCatalog.measures.map((measure) =>
			measure.id === "mobile-5g-coverage"
				? {
						...measure,
						aggregation: { ...measure.aggregation, available: true },
					}
				: measure,
		),
	};
	const response = route("GET", `${intensiveQuery}&measure=mobile-5g-coverage`, contextFor({ catalog, boundaryRegistry: mobileSourceRegistry }));
	const data = (response.body as { data: any }).data;
	assert.equal(data.measureReadiness.status, "requires-conversion");
	assert.equal(data.measureReadiness.operation, "weighted-mean");
	assert.deepEqual(data.measureReadiness.weight, {
		description: "The authority's premises count.",
		datasetField: "premisesCount",
	});
	assert.match(data.measureReadiness.reason, /must not be summed/);
});

test("reports partial coverage instead of silently treating a path as complete", () => {
	const lookup = new Map(areaLookup);
	lookup.set(
		"ward/2025-01-en-ward",
		new Map([
			...areaLookup.get("ward/2025-01-en-ward")!,
			["E05000002", { code: "E05000002", name: "Unmapped ward" }],
		]),
	);
	const response = route("GET", query, contextFor({ lookup }));
	assert.equal(response.status, 200);
	const data = (response.body as { data: any }).data;
	assert.equal(data.status, "partial");
	assert.equal(data.paths[0].trust.level, "partial");
	assert.equal(data.paths[0].coverage.share, 0.5);
	assert.match(data.reason, /incomplete coverage/);
});

test("names a missing crosswalk artifact as a prerequisite", () => {
	const response = route("GET", query, contextFor({ crosswalks: new Map() }));
	assert.equal(response.status, 200);
	const data = (response.body as { data: any }).data;
	assert.equal(data.status, "not-built");
	assert.equal(data.paths[0].coverage.status, "not-built");
	assert.equal(data.paths[0].trust.level, "not-built");
	assert.deepEqual(data.missingPrerequisites, [
		{
			id: "crosswalk-artifact",
			status: "not-built",
			reason: `The crosswalk artifact ${containmentCrosswalk.id} required by ${containmentCrosswalk.id}/forward/membership is not built.`,
		},
	]);
});

test("makes an undeclared purpose an explicit relationship-path prerequisite", () => {
	const response = route(
		"GET",
		query.replace("purpose=membership", "purpose=identity"),
		contextFor(),
	);
	assert.equal(response.status, 200);
	const data = (response.body as { data: any }).data;
	assert.equal(data.status, "unsupported");
	assert.deepEqual(data.paths, []);
	assert.deepEqual(data.missingPrerequisites, [
		{
			id: "relationship-path",
			status: "unsupported",
			reason:
				"No declared identity path is published from ward/2025-01-en-ward to localAuthority/2025-01-uk-lad.",
		},
	]);
});
