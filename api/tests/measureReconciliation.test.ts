import assert from "node:assert/strict";
import test from "node:test";
import type {
	CrosswalkInventory,
	PropertyCrosswalkArtifact,
} from "../src/crosswalkInventory";
import {
	availableReconciliations,
	reconcileMeasure,
} from "../src/measureReconciliation";
import { createGeographyResolver } from "../src/geographyResolver";
import {
	createRelationshipPathIndex,
	type RelationshipPath,
} from "../src/relationshipPaths";
import type { MeasureCompatibilityInventory } from "../src/measureCompatibility";
import type { RouteContext } from "../src/routing";
import type {
	DataCatalog,
	MeasureObservationArtifact,
} from "../src/dataCatalog";
import {
	containmentCrosswalk,
	dataCatalog,
	registry,
	routeWithData,
	testContext,
} from "./routeFixtures";

// A measure of its own, so the figures are chosen rather than inherited:
// two wards of 100 and 180 in a district published as 280. Adding the wards
// up should reproduce the district exactly.
const measure: DataCatalog["measures"][number] = {
	...dataCatalog.measures.find(
		(candidate) => candidate.id === "population-estimate",
	)!,
	id: "fixture-people",
	sources: [
		{
			datasetId: "fixture-wards",
			periods: ["2022"],
			sourceGeography: { type: "ward", boundaryYear: 2023 },
			coverage: {
				kind: "source-reported",
				countries: ["GB-ENG"],
				recordCount: 2,
				note: "Two wards of one district.",
			},
		},
		{
			datasetId: "fixture-districts",
			periods: ["2022"],
			sourceGeography: { type: "localAuthority", boundaryYear: 2023 },
			coverage: {
				kind: "source-reported",
				countries: ["GB-ENG"],
				recordCount: 1,
				note: "The district those wards make up.",
			},
		},
	],
};

const catalog: DataCatalog = {
	...dataCatalog,
	measures: [...dataCatalog.measures, measure],
};

const observations: MeasureObservationArtifact[] = [
	{
		schemaVersion: 1,
		contentHash: "sha256:fixture-wards",
		measureId: measure.id,
		sourceGeography: { type: "ward", boundaryYear: 2023 },
		periods: [
			{
				period: "2022",
				records: [
					{ areaCode: "E05000001", value: 100, status: "observed" },
					{ areaCode: "E05000002", value: 180, status: "observed" },
				],
			},
		],
	},
	{
		schemaVersion: 1,
		contentHash: "sha256:fixture-districts",
		measureId: measure.id,
		sourceGeography: { type: "localAuthority", boundaryYear: 2023 },
		periods: [
			{
				period: "2022",
				records: [
					{ areaCode: "E06000001", value: 280, status: "observed" },
				],
			},
		],
	},
];

const crosswalk = (
	id: string,
	records: Array<[string, string]>,
): PropertyCrosswalkArtifact => ({
	...containmentCrosswalk,
	id,
	contentHash: `sha256:${id}`,
	from: { geography: "ward", boundaryRelease: "2023-05-uk-bgc" },
	to: { geography: "localAuthority", boundaryRelease: "2023-05-uk-bgc-v2" },
	records: records.map(([source, target]) => ({
		source: { code: source, labels: [source] },
		targets: [{ code: target, labels: [target] }],
	})),
});

// Both wards make the district up exactly. Dropping one leaves a sum that
// disagrees with it. Adding a ward the partition has no value for leaves a
// sum short of its parts, even though what is left still adds to 280.
const agreeing = crosswalk("wards-agree", [
	["E05000001", "E06000001"],
	["E05000002", "E06000001"],
]);
const differing = crosswalk("wards-differ", [["E05000001", "E06000001"]]);
const incomplete = crosswalk("wards-incomplete", [
	["E05000001", "E06000001"],
	["E05000002", "E06000001"],
	["E05000999", "E06000001"],
]);

const contextWith = (artifacts: PropertyCrosswalkArtifact[]): RouteContext =>
	testContext({
		boundaryRegistry: registry,
		dataCatalog: catalog,
		measureObservations: observations,
		crosswalkLookup: new Map(
			artifacts.map((artifact) => [artifact.id, artifact]),
		),
		crosswalkInventory: {
			schemaVersion: 1,
			contentHash: "sha256:crosswalks",
			crosswalks: artifacts.map((artifact) => ({
				id: artifact.id,
				from: artifact.from,
				to: artifact.to,
				method: artifact.method,
				quality: artifact.quality,
				weighting: artifact.weighting,
				recordCount: artifact.records.length,
				artifact: `crosswalks/${artifact.id}.json`,
				contentHash: artifact.contentHash,
			})),
		} satisfies CrosswalkInventory,
	});

const reconcile = (artifact: PropertyCrosswalkArtifact) =>
	reconcileMeasure(
		contextWith([artifact]),
		measure,
		{ crosswalk: artifact.id },
		"2022",
	);

test("reports the two published figures side by side", () => {
	const result = reconcile(agreeing);
	assert.ok(!("refusal" in result));
	if ("refusal" in result) return;
	assert.deepEqual(result.areas, [
		{
			areaCode: "E06000001",
			published: 280,
			aggregated: 280,
			difference: 0,
			share: 0,
			status: "agrees",
		},
	]);
	// No inventory has assessed these partitions, so the pairing rests on the
	// codes the crosswalk carries, and says so.
	assert.equal(result.pairing, "by-codes");
	assert.equal(result.summary.agreeingAreaCount, 1);
	assert.equal(result.method, "exact");
	assert.deepEqual(result.unmatched, {
		aggregatedOnly: [],
		publishedOnly: [],
	});
});

test("calls a disagreement a disagreement", () => {
	const result = reconcile(differing);
	assert.ok(!("refusal" in result));
	if ("refusal" in result) return;
	const [area] = result.areas;
	assert.equal(area?.status, "differs");
	assert.equal(area?.aggregated, 100);
	assert.equal(area?.published, 280);
	assert.equal(area?.share, -0.642857);
	assert.equal(result.summary.differingAreaCount, 1);
	assert.equal(result.summary.largestDifference?.areaCode, "E06000001");
});

test("separates a sum short of its parts from a disagreement", () => {
	const result = reconcile(incomplete);
	assert.ok(!("refusal" in result));
	if ("refusal" in result) return;
	const [area] = result.areas;
	assert.equal(area?.status, "incomplete");
	assert.equal(area?.missingComponentCount, 1);
	assert.equal(result.summary.incompleteAreaCount, 1);
	assert.equal(result.summary.differingAreaCount, 0);
	// An explained shortfall does not move the typical difference.
	assert.equal(result.summary.medianAbsoluteShare, 0);
	assert.equal(result.summary.largestDifference, undefined);
});

test("refuses a measure whose values do not add over areas", () => {
	const intensive = catalog.measures.find(
		(candidate) => candidate.aggregation.kind !== "extensive",
	);
	if (!intensive) return;
	const result = reconcileMeasure(
		contextWith([agreeing]),
		intensive,
		{ crosswalk: agreeing.id },
		"2022",
	);
	assert.ok("refusal" in result);
	assert.match(
		(result as { refusal: string }).refusal,
		/only a measure whose values add over areas/,
	);
});

test("lists the comparisons a measure allows, and needs a period to run one", () => {
	const available = availableReconciliations(
		contextWith([agreeing, differing]),
		measure,
	);
	assert.deepEqual(
		available.map((entry) => [
			"crosswalk" in entry ? entry.crosswalk.id : entry.path.id,
			entry.periods,
		]),
		[
			["wards-agree", ["2022"]],
			["wards-differ", ["2022"]],
		],
	);
	const listed = routeWithData(
		"/v1/measures/population-estimate/reconciliation",
	);
	assert.equal(listed.status, 200);
	const withoutPeriod = routeWithData(
		"/v1/measures/population-estimate/reconciliation?crosswalk=ward-to-local-authority-2025",
	);
	assert.equal(withoutPeriod.status, 400);
	assert.match(
		(withoutPeriod.body as { detail: string }).detail,
		/period is required/,
	);
});

test("adds the finer partition up through every step of a named path", () => {
	// A code-vintage step onto the release the containment crosswalk starts at.
	const vintage: PropertyCrosswalkArtifact = {
		...crosswalk("wards-2022-to-2023", [
			["E05000001", "E05000001"],
			["E05000002", "E05000002"],
		]),
		method: "official-lookup",
		from: { geography: "ward", boundaryRelease: "2022-05-uk-bgc" },
		to: agreeing.from,
	};
	const crosswalkLookup = new Map(
		[vintage, agreeing].map((artifact) => [artifact.id, artifact]),
	);
	const context: RouteContext = {
		...contextWith([vintage, agreeing]),
		geographyResolver: createGeographyResolver({
			crosswalkLookup,
			relationshipPathIndex: createRelationshipPathIndex({
				schemaVersion: 1,
				contentHash: "sha256:paths",
				crosswalkInventoryHash: "sha256:crosswalks",
				paths: [
					{
						id: "ward-2022-to-local-authority",
						purpose: "membership",
						from: vintage.from,
						to: agreeing.to,
						quality: "publisher-supplied",
						origin: "declared",
						steps: [vintage, agreeing].map((artifact) => ({
							crosswalkId: artifact.id,
							direction: "forward" as const,
							method: artifact.method,
							purpose: "membership" as const,
						})),
					},
				],
			}),
		}),
	};

	const result = reconcileMeasure(
		context,
		measure,
		{ path: "ward-2022-to-local-authority" },
		"2022",
	);
	assert.ok(!("refusal" in result));
	if ("refusal" in result) return;
	assert.equal(result.crosswalk, undefined);
	assert.deepEqual(
		result.path?.steps.map(({ crosswalk: step, direction }) => [
			step.id,
			direction,
		]),
		[
			["wards-2022-to-2023", "forward"],
			["wards-agree", "forward"],
		],
	);
	assert.deepEqual(
		result.areas.map(({ areaCode, aggregated, status }) => [
			areaCode,
			aggregated,
			status,
		]),
		[["E06000001", 280, "agrees"]],
	);

	assert.match(
		(
			reconcileMeasure(
				context,
				measure,
				{ path: "not-published" },
				"2022",
			) as {
				refusal: string;
			}
		).refusal,
		/No published relationship path is named not-published/,
	);
});

test("lists only a composed path that reconciles, between releases the partitions join", () => {
	const vintage: PropertyCrosswalkArtifact = {
		...crosswalk("wards-2022-to-2023", [
			["E05000001", "E05000001"],
			["E05000002", "E05000002"],
		]),
		method: "official-lookup",
		from: { geography: "ward", boundaryRelease: "2022-05-uk-bgc" },
		to: agreeing.from,
	};
	// A later step that leaves out the second ward, as a continuity step
	// leaves out a changed area, so the conversion refuses to lose its 180.
	const dropping: PropertyCrosswalkArtifact = {
		...crosswalk("wards-to-district-partial", [["E05000001", "E06000001"]]),
		from: agreeing.from,
		to: agreeing.to,
	};
	const districtToWard: PropertyCrosswalkArtifact = {
		...crosswalk("district-to-ward", [["E06000001", "E05000001"]]),
		from: {
			geography: "localAuthority",
			boundaryRelease: "2023-05-uk-bgc-v2",
		},
		to: vintage.from,
	};
	const artifacts = [vintage, dropping, agreeing, districtToWard];
	const path = (
		id: string,
		steps: Array<[PropertyCrosswalkArtifact, "forward" | "reverse"]>,
	): RelationshipPath => ({
		id,
		purpose: "membership",
		from: vintage.from,
		to: agreeing.to,
		quality: "publisher-supplied",
		origin: "declared",
		steps: steps.map(([artifact, direction]) => ({
			crosswalkId: artifact.id,
			direction,
			method: artifact.method,
			purpose: "membership" as const,
		})),
	});
	const candidate = (
		boundaryRelease: string,
	): MeasureCompatibilityInventory["measures"][number]["sources"][number]["candidates"][number] => ({
		boundaryRelease,
		title: boundaryRelease,
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
	});
	const context = testContext({
		boundaryRegistry: registry,
		dataCatalog: catalog,
		measureObservations: observations,
		crosswalkLookup: new Map(
			artifacts.map((artifact) => [artifact.id, artifact]),
		),
		crosswalkInventory: {
			schemaVersion: 1,
			contentHash: "sha256:crosswalks",
			crosswalks: [],
		},
		// Each partition is verified against the release its end of the path uses.
		measureCompatibilityInventory: {
			schemaVersion: 1,
			contentHash: "sha256:compatibility",
			measures: [
				{
					measureId: measure.id,
					sources: measure.sources.map((source) => ({
						datasetId: source.datasetId,
						sourceGeography: source.sourceGeography,
						periods: source.periods,
						note: "Fixture.",
						candidates: [
							candidate(
								source.sourceGeography.type === "ward"
									? vintage.from.boundaryRelease
									: agreeing.to.boundaryRelease,
							),
						],
					})),
				},
			],
		} as unknown as MeasureCompatibilityInventory,
		relationshipPathInventory: {
			schemaVersion: 1,
			contentHash: "sha256:paths",
			crosswalkInventoryHash: "sha256:crosswalks",
			paths: [
				// Ranked ahead by id, but a reversed containment splits a
				// district among its wards, which nothing here can weight.
				path("a-reversed", [
					[vintage, "forward"],
					[districtToWard, "reverse"],
				]),
				// Ranked ahead by id, but it drops a ward, so it cannot reconcile.
				path("b-dropping", [
					[vintage, "forward"],
					[dropping, "forward"],
				]),
				path("c-reconciles", [
					[vintage, "forward"],
					[agreeing, "forward"],
				]),
			],
		},
	});

	const listed = availableReconciliations(context, measure).filter(
		(entry) => "path" in entry,
	);
	assert.deepEqual(
		listed.map((entry) => ("path" in entry ? entry.path.id : undefined)),
		["c-reconciles"],
	);
	const [entry] = listed;
	assert.equal(
		entry?.href,
		`/v1/measures/${measure.id}/reconciliation?path=c-reconciles&period=2022`,
	);
	const followed = reconcileMeasure(
		context,
		measure,
		{ path: "c-reconciles" },
		"2022",
	);
	assert.ok(!("refusal" in followed));
	if ("refusal" in followed) return;
	assert.equal(followed.pairing, "verified");
	assert.equal(followed.summary.agreeingAreaCount, 1);
});

test("links each listed comparison to the latest period both partitions publish", () => {
	// The finer partition lists its periods newest first.
	const [wards, districts] = measure.sources;
	const unordered = {
		...measure,
		sources: [
			{ ...wards!, periods: ["2022", "2021"] },
			{ ...districts!, periods: ["2021", "2022"] },
		],
	};
	const [entry] = availableReconciliations(
		contextWith([agreeing]),
		unordered,
	);

	assert.deepEqual(entry?.periods, ["2021", "2022"]);
	assert.match(entry?.href ?? "", /&period=2022$/);
});
