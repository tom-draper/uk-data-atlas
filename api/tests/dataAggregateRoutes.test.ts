import assert from "node:assert/strict";
import test from "node:test";
import { createAreaLookup } from "../src/areaInventory";
import { route as routeRequest } from "../src/routes";
import type { RouteContext } from "../src/routing";
import type { CrosswalkArtifact } from "../src/crosswalkInventory";
import { createNamedLocationLookup } from "../src/namedLocations";
import type {
	MeasureObservationArtifact,
	MeasureSource,
	DataCatalog,
} from "../src/dataCatalog";
import type { MeasureCompatibilityInventory } from "../src/measureCompatibility";
import {
	registry,
	areaLookup,
	namedLocationAreaLookup,
	crosswalkArtifact,
	crosswalkLookup,
	dataCatalog,
	measureObservations,
	populationObservations,
	populationLocalAuthorityObservations,
	measureCompatibilityInventory,
	routeWithData,
	routeWithCatalog,
} from "./routeFixtures";

const aggregationNamedLocationLookup = createNamedLocationLookup({
	schemaVersion: 1,
	contentHash: "sha256:aggregation-locations",
	source: {
		artifact: "data/precompiled/gazetteer.core.json",
		gazetteerVersion: 1,
	},
	locations: [
		{
			id: "test-wards",
			label: "Test wards",
			kind: "editorial-grouping",
			memberCodes: ["E05000001", "W05000001"],
			bbox: [-2.5, 53.3, -2, 53.7],
		},
		{
			id: "incomplete-test-wards",
			label: "Incomplete test wards",
			kind: "editorial-grouping",
			memberCodes: ["E05000001", "E05000999"],
			bbox: [-2.5, 53.3, -2, 53.7],
		},
	],
});

test("aggregates a region through an explicit complete crosswalk", () => {
	const crosswalkId = "local-authority-to-region-fixture";
	const regionalCrosswalk: CrosswalkArtifact = {
		schemaVersion: 1,
		contentHash: "sha256:regional-crosswalk",
		id: crosswalkId,
		method: "area-overlap",
		quality: "derived",
		weighting: {
			status: "provided",
			basis: "area",
			normalisation: "per-source",
		},
		from: {
			geography: "localAuthority",
			boundaryRelease: "2025-12-uk-lad",
		},
		to: { geography: "region", boundaryRelease: "2025-12-en-rgn" },
		provenance: {
			inputs: [
				{ side: "from", input: "fixture-lad", inputHash: "sha256:lad" },
				{
					side: "to",
					input: "fixture-region",
					inputHash: "sha256:region",
				},
			],
			areaProjection: "EPSG:6933",
			clipping: "fixture",
		},
		validation: {
			sourceNameConflicts: [],
			endpoints: {
				from: {
					status: "verified",
					availableAreaCount: 1,
					referencedCodeCount: 1,
				},
				to: {
					status: "verified",
					availableAreaCount: 1,
					referencedCodeCount: 1,
				},
			},
			overlap: {
				candidatePairCount: 1,
				intersectingPairCount: 1,
				sliverPairCount: 0,
				sliverWidthM: 100,
				widestSliverWidthM: null,
				narrowestOverlapWidthM: 1000,
				minimumCoverage: 0.99,
				minimumSourceCoverage: 1,
				minimumTargetCoverage: 1,
			},
		},
		records: [
			{
				source: {
					code: "E06000001",
					labels: ["Greater Manchester"],
					areaM2: 1,
					coverage: 1,
				},
				targets: [
					{
						code: "E12000002",
						labels: ["North West"],
						weight: 1,
						overlapAreaM2: 1,
						sourceShare: 1,
						targetShare: 1,
					},
				],
			},
		],
	};
	const compatibility: MeasureCompatibilityInventory = {
		...measureCompatibilityInventory,
		measures: [
			...measureCompatibilityInventory.measures,
			{
				measureId: "ghg-emissions",
				sources: [
					{
						datasetId: "ghg-emissions",
						sourceGeography: {
							type: "localAuthority",
							boundaryYear: 2025,
						},
						periods: ["2024"],
						candidates: [
							{
								boundaryRelease: "2025-12-uk-lad",
								title: "Fixture local authorities",
								coverageCountries: ["GB-ENG"],
								status: "exact-code-set",
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
						note: "Fixture compatibility.",
					},
				],
			},
		],
	};
	const response = routeWithCatalog(
		`/v1/data/ghg-emissions/aggregate?period=2024&geography=localAuthority&boundaryYear=2025&regionCode=E12000002&sourceRelease=2025-12-uk-lad&crosswalk=${crosswalkId}`,
		dataCatalog,
		measureObservations,
		{
			crosswalkLookup: new Map([
				...crosswalkLookup,
				[crosswalkId, regionalCrosswalk],
			]),
			measureCompatibilityInventory: compatibility,
		},
	);
	assert.equal(response.status, 200);
	assert.deepEqual(
		"data" in response.body &&
			(response.body.data as { record: unknown }).record,
		{ value: 400, status: "derived" },
	);
	assert.equal(
		"data" in response.body &&
			(response.body.data as { aggregation: { membership: string } })
				.aggregation.membership,
		"verified-full-area-overlap",
	);
});

test("aggregates an intensive measure with its published weight", () => {
	const shareId = "fixture-party-vote-share";
	const weightId = "fixture-valid-votes";
	const source: MeasureSource = {
		datasetId: "population",
		periods: ["2024"],
		sourceGeography: { type: "ward" as const, boundaryYear: 2023 },
		coverage: {
			kind: "partial" as const,
			countries: ["GB-ENG"],
			recordCount: 2,
			note: "Fixture observations.",
		},
	};
	const catalog: DataCatalog = {
		...dataCatalog,
		measures: [
			...dataCatalog.measures,
			{
				id: weightId,
				label: "Fixture valid votes",
				valueKind: "count",
				unit: "votes",
				aggregation: {
					kind: "extensive",
					operation: "sum",
					available: true,
				},
				sources: [source],
				availability: {
					sourceExact: true,
					conversion: false,
					aggregation: true,
				},
				links: { data: `/v1/data/${weightId}` },
			},
			{
				id: shareId,
				label: "Fixture party vote share",
				valueKind: "ratio",
				unit: "percent",
				aggregation: {
					kind: "intensive",
					operation: "weighted-mean",
					weight: {
						description: "Valid ballot papers.",
						datasetField: "validVotes",
						measureId: weightId,
					},
					available: true,
				},
				sources: [source],
				availability: {
					sourceExact: true,
					conversion: false,
					aggregation: true,
				},
				links: { data: `/v1/data/${shareId}` },
			},
		],
	};
	const artifact = (
		measureId: string,
		values: number[],
	): MeasureObservationArtifact => ({
		schemaVersion: 1,
		contentHash: `sha256:${measureId}`,
		measureId,
		sourceGeography: source.sourceGeography,
		periods: [
			{
				period: "2024",
				records: values.map((value, index) => ({
					areaCode: `E0500000${index + 1}`,
					value,
					status: "observed" as const,
				})),
			},
		],
	});
	const response = routeWithCatalog(
		`/v1/data/${shareId}/aggregate?period=2024&geography=ward&boundaryYear=2023&areaCode=E92000001`,
		catalog,
		[
			...measureObservations,
			artifact(shareId, [25, 80]),
			artifact(weightId, [100, 400]),
		],
	);
	assert.equal(response.status, 200);
	assert.equal(
		"data" in response.body &&
			(response.body.data as { record: { value: number } }).record.value,
		69,
	);
	assert.deepEqual(
		"data" in response.body &&
			(response.body.data as { aggregation: { operation: string } })
				.aggregation.operation,
		"weighted-mean",
	);
});

test("sums a country from the GSS code prefix, or refuses to", () => {
	const query =
		"/v1/data/ghg-emissions/aggregate?period=2024&geography=localAuthority&boundaryYear=2025";

	const england = routeWithData(`${query}&areaCode=E92000001`);
	assert.equal(england.status, 200);
	const data =
		"data" in england.body
			? (england.body.data as {
					record: { value: number; status: string };
					aggregation: {
						membership: string;
						inputRecordCount: number;
					};
				})
			: undefined;
	assert.equal(data?.record.value, 400);
	assert.equal(data?.record.status, "derived");
	// Membership is definitional, not a geometric comparison.
	assert.equal(data?.aggregation.membership, "gss-country-code");
	assert.equal(data?.aggregation.inputRecordCount, 1);

	// A country the partition does not reach must not sum to a confident zero.
	const scotland = routeWithData(`${query}&areaCode=S92000003`);
	assert.equal(scotland.status, 422);
	assert.match(
		"detail" in scotland.body ? scotland.body.detail : "",
		/publishes no areas for that country/,
	);

	// Exactly one of the two ways of naming an area.
	assert.equal(routeWithData(query).status, 400);
	assert.equal(
		routeWithData(
			`${query}&areaCode=E92000001&locationId=greater-manchester`,
		).status,
		400,
	);
	// A local authority is not yet an aggregation target.
	assert.equal(routeWithData(`${query}&areaCode=E06000001`).status, 400);
});

test("refuses to combine a median, and says why", () => {
	const observed = routeWithData(
		"/v1/data/house-price-median?period=2022&geography=ward&boundaryYear=2020",
	);
	assert.equal(observed.status, 200);

	const aggregate = routeWithData(
		"/v1/data/house-price-median/aggregate?period=2022&geography=ward&boundaryYear=2020&areaCode=E92000001",
	);
	assert.equal(aggregate.status, 422);
	assert.match(
		"detail" in aggregate.body ? aggregate.body.detail : "",
		/is a median and cannot be combined over areas\. A median of ward medians/,
	);
	assert.equal(
		"code" in aggregate.body && aggregate.body.code,
		"aggregation_not_supported",
	);

	const convert = routeWithData(
		`/v1/data/house-price-median/convert?period=2022&geography=ward&boundaryYear=2020&crosswalk=${crosswalkArtifact.id}`,
	);
	assert.equal(convert.status, 422);
	assert.match(
		"detail" in convert.body ? convert.body.detail : "",
		/This measure is a median/,
	);
});

test("aggregates an extensive measure only over a complete direct named-location match", () => {
	const context: RouteContext = {
		boundaryRegistry: registry,
		// The compiled releases are what tell a member code of another vintage
		// from one that is simply wrong, so aggregation needs them.
		areaLookup,
		namedLocationLookup: aggregationNamedLocationLookup,
		dataCatalog,
		populationObservations,
		populationLocalAuthorityObservations,
		measureObservations,
	};
	const response = routeRequest(
		"GET",
		"/v1/data/population-estimate/aggregate?period=2022&geography=ward&boundaryYear=2023&locationId=test-wards",
		context,
	);
	assert.equal(response.status, 200);
	const data = "data" in response.body ? response.body.data : undefined;
	assert.deepEqual(
		(
			data as {
				aggregation: unknown;
				record: unknown;
				provenance: { transformation: unknown };
			}
		).aggregation,
		{
			operation: "sum",
			membership: "direct-code-match",
			inputRecordCount: 2,
			note: "Every curated location member code that names an area in this partition was found in the published source partition.",
		},
	);
	assert.deepEqual((data as { record: unknown }).record, {
		value: 300,
		status: "derived",
	});
	assert.deepEqual(
		(data as { provenance: { transformation: unknown } }).provenance
			.transformation,
		{
			status: "not-applied",
			note: "Input observations are source-exact; no geographic conversion was applied.",
		},
	);

	// E05000999 names no area in any compiled release, so it matched nothing
	// and could neither add to the sum nor be counted twice in it. The sum
	// proceeds and names the code it passed over, rather than refusing a
	// question it can answer.
	const withLegacy = routeRequest(
		"GET",
		"/v1/data/population-estimate/aggregate?period=2022&geography=ward&boundaryYear=2023&locationId=incomplete-test-wards",
		context,
	);
	assert.equal(withLegacy.status, 200);
	const legacyData = withLegacy.body as {
		data: {
			aggregation: {
				inputRecordCount: number;
				memberCodesNotInPartition: {
					otherVintage: string[];
					legacyAliases: string[];
				};
			};
		};
	};
	assert.equal(legacyData.data.aggregation.inputRecordCount, 1);
	assert.deepEqual(legacyData.data.aggregation.memberCodesNotInPartition, {
		otherVintage: [],
		legacyAliases: ["E05000999"],
	});

	// Without the compiled releases there is nothing to classify against, so an
	// unresolved code is refused rather than assumed to be harmless.
	const unverifiable = routeRequest(
		"GET",
		"/v1/data/population-estimate/aggregate?period=2022&geography=ward&boundaryYear=2023&locationId=incomplete-test-wards",
		{ ...context, areaLookup: undefined },
	);
	assert.equal(unverifiable.status, 503);

	const intensive = routeRequest(
		"GET",
		"/v1/data/mobile-5g-coverage/aggregate?period=2025&geography=localAuthority&boundaryYear=2024&locationId=test-wards",
		context,
	);
	assert.equal(intensive.status, 422);

	const conversion = routeRequest(
		"GET",
		"/v1/data/population-estimate/aggregate?period=2022&geography=ward&boundaryYear=2023&locationId=test-wards&release=2023-05-uk-bgc",
		context,
	);
	assert.equal(conversion.status, 422);
});

test("sums a location whose members span several code vintages", () => {
	// The shape every curated region has: an area that was one authority and
	// became another. The location lists both, and no release holds both, so
	// demanding that every listed code resolve refuses the location outright,
	// for every vintage there is.
	const locations = createNamedLocationLookup({
		schemaVersion: 1,
		contentHash: "sha256:vintage-locations",
		source: {
			artifact: "data/precompiled/gazetteer.core.json",
			gazetteerVersion: 1,
		},
		locations: [
			{
				id: "spanning",
				label: "Spanning",
				kind: "editorial-grouping",
				// E06000001 is current and carries the observation; E08000999
				// was superseded before this partition and E08000998 has yet
				// to take effect.
				memberCodes: ["E06000001", "E08000999", "E08000998"],
				bbox: [-2.5, 53.3, -2, 53.7],
			},
			{
				id: "abolished",
				label: "Abolished",
				kind: "editorial-grouping",
				memberCodes: ["E08000999"],
				bbox: [-2.5, 53.3, -2, 53.7],
			},
			{
				id: "extent",
				label: "Extent",
				kind: "editorial-grouping",
				memberCodes: [],
				bbox: [-2.5, 53.3, -2, 53.7],
			},
		],
	});
	const context: RouteContext = {
		boundaryRegistry: registry,
		// The lookup spanning three vintages, which is what lets a superseded
		// code be told from a wrong one.
		areaLookup: namedLocationAreaLookup,
		namedLocationLookup: locations,
		dataCatalog,
		populationObservations,
		populationLocalAuthorityObservations,
		measureObservations,
	};
	const response = routeRequest(
		"GET",
		"/v1/data/population-estimate/aggregate?period=2022&geography=localAuthority&boundaryYear=2023&locationId=spanning",
		context,
	);
	assert.equal(
		response.status,
		200,
		JSON.stringify(response.body).slice(0, 400),
	);
	const data = response.body as {
		data: { aggregation: { inputRecordCount: number } };
	};
	// Only the code that exists in this partition is summed. The other two
	// contribute nothing and withhold nothing: a release's areas are a
	// partition, so the ground is covered exactly once.
	assert.equal(data.data.aggregation.inputRecordCount, 1);

	// Nothing is unexplained about a location whose only code was superseded,
	// or one that names an extent and no codes, so neither is refused as a
	// coverage gap; each is told why the partition holds none of it.
	const detail = (locationId: string) => {
		const refused = routeRequest(
			"GET",
			`/v1/data/population-estimate/aggregate?period=2022&geography=localAuthority&boundaryYear=2023&locationId=${locationId}`,
			context,
		);
		assert.equal(refused.status, 422);
		return (refused.body as { detail: string; code?: string }).detail;
	};
	assert.match(
		detail("abolished"),
		/Every member code of Abolished is the wrong vintage/,
	);
	assert.match(detail("extent"), /Extent carries no member codes/);
});

test("flags a country total that leaves out areas a matching release holds", () => {
	const url =
		"/v1/data/ghg-emissions/aggregate?period=2024&geography=localAuthority&boundaryYear=2025&areaCode=E92000001";
	const context = {
		boundaryRegistry: registry,
		areaLookup: createAreaLookup([
			{
				schemaVersion: 1,
				contentHash: "sha256:fixture-lad",
				geography: "localAuthority",
				boundaryRelease: "2025-12-uk-lad",
				codeProperty: "LAD25CD",
				nameProperty: "LAD25NM",
				areas: [
					{ code: "E06000001", name: "Published" },
					{ code: "E06000002", name: "Unpublished" },
					{ code: "S12000001", name: "Another country" },
				],
			},
		]),
		dataCatalog,
		measureObservations,
		measureCompatibilityInventory: {
			...measureCompatibilityInventory,
			measures: [
				{
					measureId: "ghg-emissions",
					sources: [
						{
							datasetId: "ghg-emissions",
							sourceGeography: {
								type: "localAuthority",
								boundaryYear: 2025,
							},
							periods: ["2024"],
							candidates: [
								{
									boundaryRelease: "2025-12-uk-lad",
									title: "Fixture local authorities",
									coverageCountries: ["GB-ENG", "GB-SCT"],
									status: "code-set-compatible",
									sourceCodeCount: 1,
									candidateCodeCount: 3,
									matchingCodeCount: 1,
									matchedSourceShare: 1,
									unmatchedSourceCodeCount: 0,
									unmatchedSourceCodeSample: [],
									candidateOnlyCodeCount: 2,
									candidateOnlyCodeSample: [
										"E06000002",
										"S12000001",
									],
								},
							],
							note: "Fixture compatibility.",
						},
					],
				},
			],
		},
	} satisfies RouteContext;
	const coverageOf = (response: ReturnType<typeof routeRequest>) => {
		assert.equal(response.status, 200);
		return (
			response.body as {
				data: { aggregation: { coverage: Record<string, unknown> } };
			}
		).data.aggregation.coverage;
	};

	const partial = coverageOf(routeRequest("GET", url, context));
	assert.equal(partial.status, "partial");
	assert.equal(partial.code, "partial_coverage");
	assert.deepEqual(partial.assessments, [
		{
			boundaryRelease: "2025-12-uk-lad",
			status: "partial",
			expectedAreaCount: 2,
			includedAreaCount: 1,
			missingAreaCount: 1,
			missingAreaSample: ["E06000002"],
		},
	]);

	// Without a matching release, the areas a country should hold are unknown,
	// and the total says so rather than passing for complete.
	const unassessed = coverageOf(
		routeRequest("GET", url, {
			...context,
			measureCompatibilityInventory: undefined,
		}),
	);
	assert.equal(unassessed.status, "not-assessed");
});
