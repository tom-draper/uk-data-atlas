import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { once } from "node:events";
import test from "node:test";
import { parse } from "yaml";
import { createApiServer } from "../src/apiServer";
import type {
	AreaOverlapCrosswalkArtifact,
	CrosswalkArtifact,
	PropertyCrosswalkArtifact,
} from "../src/crosswalkInventory";
import { route } from "../src/routes";
import type { ApiResponse } from "@uk-data-atlas/atlas-runtime/api";
import { areaLookup, containmentCrosswalk, testContext } from "./routeFixtures";
import { schemaViolations, type SchemaDocument } from "./openapiSchema";

const openapiDocument = readFileSync(
	new URL("../openapi.yaml", import.meta.url),
	"utf8",
);
const spec: SchemaDocument = parse(openapiDocument);
const contained: PropertyCrosswalkArtifact = {
	...containmentCrosswalk,
	id: "test-counts",
	records: [
		{
			source: { code: "E05000001", labels: [] },
			targets: [{ code: "E08000001", labels: [] }],
		},
		{
			source: { code: "E05000002", labels: [] },
			targets: [{ code: "E08000001", labels: [] }],
		},
	],
};
const contextFor = (artifact: CrosswalkArtifact = contained) =>
	testContext({
		areaLookup,
		openapiDocument,
		crosswalkLookup: new Map([[artifact.id, artifact]]),
	});
const path = (suffix = "") =>
	`/v1/crosswalks/test-counts:convert?semantics=count${suffix}`;
const post = (
	rows: unknown[],
	suffix = "",
	artifact: CrosswalkArtifact = contained,
) =>
	route("POST", path(suffix), contextFor(artifact), {
		contentType: "application/json",
		text: JSON.stringify({ rows }),
	});
const data = (response: ApiResponse) => {
	assert.equal(response.status, 200);
	if (!("data" in response.body))
		throw new Error("Expected a response envelope");
	assert.deepEqual(
		schemaViolations(
			spec,
			{ $ref: "#/components/schemas/SuppliedCountConversionEnvelope" },
			response.body,
		),
		[],
	);
	return response.body.data;
};

test("converts CSV and JSON counts, with totals and coverage on the exact crosswalk", () => {
	const json = post([
		{ code: "E05000001", value: 12 },
		{ name: "Other ward", value: 30 },
	]);
	const csv = route("POST", path(), contextFor(), {
		contentType: "text/csv",
		text: "code,value\nE05000001,12\nOther ward,30\n",
	});
	const expected = {
		from: contained.from,
		to: contained.to,
		semantics: "count",
		input: {
			contentHash:
				"sha256:ed7cfeec09a08c478d5144a5c48f6f54b67a7b4cd6b5248aaddd263b24000682",
			rowCount: 2,
			normalisedCount: 0,
		},
		crosswalk: {
			id: "test-counts",
			href: "/v1/crosswalks/test-counts",
			contentHash: "sha256:containment-artifact",
			method: "clean-containment",
			quality: "publisher-supplied",
			weighting: { status: "not-applicable" },
		},
		method: "exact",
		coverage: {
			scope: "published-crosswalk",
			crosswalkSourceAreas: 2,
			sourceAreasSupplied: 2,
			targetsComplete: 1,
			targetsPartial: 0,
			targetsNotReached: 0,
			sourceAreas: 2,
		},
		inputTotal: 42,
		outputTotal: 42,
		records: [
			{
				areaCode: "E08000001",
				value: 42,
				status: "derived",
				inputAreaCount: 2,
				coverage: {
					status: "complete",
					sourceCount: 2,
					suppliedSourceCount: 2,
				},
			},
		],
		note: "Only supplied source areas contribute. Complete means every source this crosswalk maps to that target was supplied, not that the crosswalk covers the whole geography. Unreached targets are absent, never zero. Weighted values are estimates and are not rounded.",
	};
	assert.deepEqual(data(json), expected);
	const csvData = data(csv);
	assert.ok(
		typeof csvData === "object" && csvData !== null && "input" in csvData,
	);
	assert.deepEqual(csvData, {
		...expected,
		input: {
			contentHash:
				"sha256:33dd570875cc78f290913fa5a1a17f67ceebfaf81976d7aaa3c9a658d5975862",
			rowCount: 2,
			normalisedCount: 0,
		},
	});
});

test("marks a target partial when an expected source is omitted, including zero counts", () => {
	const result = data(post([{ code: "E05000001", value: 0 }]));
	assert.ok(
		typeof result === "object" &&
			result !== null &&
			"records" in result &&
			"coverage" in result,
	);
	assert.deepEqual(result.records, [
		{
			areaCode: "E08000001",
			value: 0,
			status: "derived",
			inputAreaCount: 1,
			coverage: {
				status: "partial",
				sourceCount: 2,
				suppliedSourceCount: 1,
			},
		},
	]);
	assert.deepEqual(result.coverage, {
		scope: "published-crosswalk",
		crosswalkSourceAreas: 2,
		sourceAreasSupplied: 1,
		targetsComplete: 0,
		targetsPartial: 1,
		targetsNotReached: 0,
		sourceAreas: 2,
	});
});

test("refuses the entire request for invalid values, unknown areas and code/name duplicates", () => {
	for (const value of [-1, null, true, "12", "", "NaN"]) {
		const response = post([
			{ code: "E05000001", value },
			{ code: "E05000002", value: 7 },
		]);
		assert.equal(response.status, 422);
		assert.ok("rejected" in response.body);
		assert.deepEqual(
			response.body.rejected?.map((row) =>
				typeof row === "object" && row !== null && "reason" in row
					? row.reason
					: undefined,
			),
			["not-a-count"],
		);
		assert.equal("data" in response.body, false);
	}
	const duplicate = post([
		{ code: "E05000001", value: 12 },
		{ name: "Example ward", value: 7 },
	]);
	assert.equal(duplicate.status, 422);
	assert.equal(
		"rejectedCount" in duplicate.body && duplicate.body.rejectedCount,
		2,
	);
	assert.deepEqual(
		"rejected" in duplicate.body &&
			duplicate.body.rejected?.map((row) =>
				typeof row === "object" && row !== null && "reason" in row
					? row.reason
					: undefined,
			),
		["duplicate-area", "duplicate-area"],
	);
	assert.equal(post([{ code: "E05009999", value: 7 }]).status, 422);
	assert.equal(
		post([{ code: "E05000001", value: 7 }], "", {
			...contained,
			records: [],
		}).status,
		422,
	);
});

const weighted: AreaOverlapCrosswalkArtifact = {
	schemaVersion: 1,
	id: "test-counts",
	contentHash: "sha256:weighted",
	from: contained.from,
	to: contained.to,
	method: "area-overlap",
	quality: "derived",
	weighting: {
		status: "provided",
		basis: "area",
		normalisation: "per-source",
	},
	provenance: {
		inputs: [],
		areaProjection: "EPSG:6933",
		clipping: "fixture",
	},
	validation: {
		sourceNameConflicts: [],
		endpoints: contained.validation.endpoints,
		overlap: {
			candidatePairCount: 2,
			intersectingPairCount: 2,
			sliverPairCount: 0,
			sliverWidthM: 100,
			widestSliverWidthM: null,
			narrowestOverlapWidthM: 200,
			minimumCoverage: 1,
			minimumSourceCoverage: 1,
			minimumTargetCoverage: 1,
		},
	},
	records: [
		{
			source: { code: "E05000001", labels: [], areaM2: 100, coverage: 1 },
			targets: [
				{
					code: "E08000001",
					labels: [],
					weight: 0.25,
					overlapAreaM2: 25,
					sourceShare: 0.25,
					targetShare: 1,
				},
				{
					code: "E08000002",
					labels: [],
					weight: 0.75,
					overlapAreaM2: 75,
					sourceShare: 0.75,
					targetShare: 1,
				},
			],
		},
	],
};

test("requires explicit weighting and refuses unsupported splits and overflow", () => {
	const rows = [{ code: "E05000001", value: 100 }];
	const refused = post(rows, "", weighted);
	assert.equal(refused.status, 422);
	assert.equal(
		"absence" in refused.body && refused.body.absence,
		"weighting-not-requested",
	);
	assert.equal(post(rows, "&weighting=population", weighted).status, 400);
	const result = data(post(rows, "&weighting=area", weighted));
	assert.ok(
		typeof result === "object" &&
			result !== null &&
			"records" in result &&
			"method" in result &&
			"outputTotal" in result,
	);
	assert.equal(result.method, "area-weighted");
	assert.equal(result.outputTotal, 100);
	assert.deepEqual(result.records, [
		{
			areaCode: "E08000001",
			value: 25,
			status: "derived",
			inputAreaCount: 1,
			coverage: {
				status: "complete",
				sourceCount: 1,
				suppliedSourceCount: 1,
			},
		},
		{
			areaCode: "E08000002",
			value: 75,
			status: "derived",
			inputAreaCount: 1,
			coverage: {
				status: "complete",
				sourceCount: 1,
				suppliedSourceCount: 1,
			},
		},
	]);
	const split: PropertyCrosswalkArtifact = {
		...contained,
		records: weighted.records.map((record) => ({
			source: record.source,
			targets: record.targets.map(({ code, labels }) => ({
				code,
				labels,
			})),
		})),
	};
	const unweighted = post(rows, "", split);
	assert.equal(unweighted.status, 422);
	assert.equal(
		"absence" in unweighted.body && unweighted.body.absence,
		"unweighted-split",
	);
	assert.equal(
		post([
			{ code: "E05000001", value: 1e308 },
			{ code: "E05000002", value: 1e308 },
		]).status,
		422,
	);
});

test("honours method, catalogue and query boundaries", () => {
	assert.equal(route("GET", path(), contextFor()).status, 405);
	assert.equal(
		post([{ code: "E05000001", value: 1 }], "&period=2025").status,
		400,
	);
	assert.equal(
		route("POST", "/v1/crosswalks/test-counts:convert", contextFor())
			.status,
		400,
	);
	assert.equal(
		route(
			"POST",
			"/v1/crosswalks/unknown:convert?semantics=count",
			contextFor(),
		).status,
		404,
	);
	assert.equal(post([], "&weighting=unknown").status, 400);
	assert.equal(post([]).status, 400);
});

test("leaves unreached targets absent instead of publishing zero counts", () => {
	const separate: PropertyCrosswalkArtifact = {
		...contained,
		records: [
			contained.records[0]!,
			{
				source: { code: "E05000002", labels: [] },
				targets: [{ code: "E08000002", labels: [] }],
			},
		],
	};
	const result = data(post([{ code: "E05000001", value: 12 }], "", separate));
	assert.ok(
		typeof result === "object" &&
			result !== null &&
			"records" in result &&
			"coverage" in result,
	);
	assert.deepEqual(result.records, [
		{
			areaCode: "E08000001",
			value: 12,
			status: "derived",
			inputAreaCount: 1,
			coverage: {
				status: "complete",
				sourceCount: 1,
				suppliedSourceCount: 1,
			},
		},
	]);
	assert.deepEqual(result.coverage, {
		scope: "published-crosswalk",
		crosswalkSourceAreas: 2,
		sourceAreasSupplied: 1,
		targetsComplete: 1,
		targetsPartial: 0,
		targetsNotReached: 1,
		sourceAreas: 2,
	});
});

test("refuses best-fit assignments instead of calling approximate membership exact", () => {
	const bestFit: CrosswalkArtifact = {
		...weighted,
		method: "best-fit",
		weighting: { status: "not-applicable" },
		validation: {
			sourceNameConflicts: [],
			endpoints: contained.validation.endpoints,
			bestFit: {
				sliverWidthM: 100,
				childCount: 1,
				parentCount: 1,
				withinCount: 0,
				indeterminateCount: 0,
				straddlingCount: 1,
				minimumContainedShare: 0.75,
			},
		},
		records: [
			{
				source: { code: "E05000001", labels: [] },
				targets: [
					{
						code: "E08000001",
						labels: [],
						containedShare: 0.75,
						outsideWidthM: 1000,
						relation: "straddles",
					},
				],
			},
		],
	};
	const response = post([{ code: "E05000001", value: 12 }], "", bestFit);
	assert.equal(response.status, 422);
	assert.equal(
		"absence" in response.body && response.body.absence,
		"crosswalk-not-for-conversion",
	);
	assert.equal("data" in response.body, false);
});

test("serves different POST bodies over HTTP without caching their answers", async (t) => {
	const server = createApiServer(contextFor(), { log: () => {} });
	t.after(() => server.close());
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	const address = server.address();
	assert.ok(address && typeof address !== "string");
	const url = `http://127.0.0.1:${address.port}${path()}`;
	for (const value of [12, 47]) {
		const response = await fetch(url, {
			method: "POST",
			headers: { "content-type": "text/csv" },
			body: `code,value\nE05000001,${value}\n`,
		});
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("cache-control"), "no-store");
		const body = await response.json();
		assert.equal(body.data.records[0].value, value);
	}
});
