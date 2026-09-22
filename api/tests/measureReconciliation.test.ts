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

const contextWith = (artifacts: PropertyCrosswalkArtifact[]): RouteContext => ({
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
	reconcileMeasure(contextWith([artifact]), measure, artifact.id, "2022");

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
		agreeing.id,
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
		available.map(({ crosswalk: named, periods }) => [named.id, periods]),
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
