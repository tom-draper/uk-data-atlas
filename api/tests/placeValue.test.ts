import assert from "node:assert/strict";
import test from "node:test";
import type { Measure } from "../src/dataCatalog";
import type { PlaceCandidate } from "../src/placeResolver";
import { valueForPlace, type Dispatch } from "../src/placeValue";

const measure = {
	id: "population-estimate",
	valueKind: "count",
	unit: "people",
	sources: [
		{
			datasetId: "population",
			periods: ["2022", "2023"],
			sourceGeography: { type: "localAuthority", boundaryYear: 2023 },
		},
		{
			datasetId: "population",
			periods: ["2022"],
			sourceGeography: { type: "ward", boundaryYear: 2023 },
		},
	],
} as unknown as Measure;

const candidate = (
	place: string,
	match: PlaceCandidate["match"] = "exact",
	memberCodes?: string[],
): PlaceCandidate => {
	const [head, code] = place.split("/") as [string, string];
	const named = head === "location";
	return {
		place,
		kind: named ? "named-location" : "area",
		name: code,
		geography: named ? "named-location" : head,
		code,
		match,
		matchedLabel: code,
		boundaryReleases: [],
		...(memberCodes ? { memberCodes } : {}),
	};
};

const series = (points: [string, number][]) => ({
	status: 200,
	body: {
		data: {
			series: points.map(([period, value]) => ({
				period,
				areaCode: "X",
				value,
				status: "observed",
			})),
		},
	},
});

const aggregate = (value: number, skipped: string[] = []) => ({
	status: 200,
	body: {
		data: {
			record: { value, status: "derived" },
			aggregation: {
				memberCodesNotInPartition: {
					otherVintage: skipped,
					legacyAliases: [],
				},
			},
		},
	},
});

const refused = (detail: string) => ({ status: 422, body: { detail } });

/** Answers from a table of URL fragments; anything unlisted is not found. */
const dispatcher =
	(table: [string, ReturnType<Dispatch>][]): Dispatch =>
	(url) =>
		table.find(([fragment]) => url.includes(fragment))?.[1] ?? {
			status: 404,
			body: { detail: "not in this partition" },
		};

test("answers an area from its series, latest period when none is given", () => {
	const outcome = valueForPlace(
		measure,
		[candidate("localAuthority/E08000003")],
		undefined,
		dispatcher([
			[
				"areaCode=E08000003",
				series([
					["2022", 100],
					["2023", 110],
				]),
			],
		]),
	);
	assert.equal(outcome.outcome, "answered");
	if (outcome.outcome !== "answered") return;
	assert.equal(outcome.chosen.method, "source-exact");
	assert.equal(outcome.chosen.answer.value, 110);
	assert.equal(outcome.chosen.answer.period, "2023");
	assert.equal(outcome.chosen.answer.periodDefaulted, true);
	assert.match(outcome.chosen.via, /series\?areaCode=E08000003/);
});

test("answers a curated location by summing its authorities", () => {
	const outcome = valueForPlace(
		measure,
		[candidate("location/north-west", "exact", ["A", "B"])],
		"2022",
		dispatcher([["locationId=north-west", aggregate(500)]]),
	);
	assert.equal(outcome.outcome, "answered");
	if (outcome.outcome !== "answered") return;
	assert.equal(outcome.chosen.method, "aggregate");
	assert.equal(outcome.chosen.answer.value, 500);
	assert.equal(outcome.chosen.answer.periodDefaulted, false);
	assert.match(outcome.chosen.via, /period=2022/);
});

test("counts the same ground once, keeping the publisher's own reading", () => {
	// Manchester the authority, and a curated location of that one authority,
	// give the same number: one answer, not an ambiguity.
	const outcome = valueForPlace(
		measure,
		[
			candidate("location/manchester", "exact", ["E08000003", "OLD"]),
			candidate("localAuthority/E08000003"),
		],
		"2023",
		dispatcher([
			["locationId=manchester", aggregate(110, ["OLD"])],
			[
				"areaCode=E08000003",
				series([
					["2022", 100],
					["2023", 110],
				]),
			],
		]),
	);
	assert.equal(outcome.outcome, "answered");
	if (outcome.outcome !== "answered") return;
	assert.equal(outcome.chosen.method, "source-exact");
	assert.equal(outcome.chosen.candidate.place, "localAuthority/E08000003");
});

test("hands back every distinct answer when a name means several places", () => {
	const outcome = valueForPlace(
		measure,
		[candidate("localAuthority/W06000022"), candidate("ward/E05000009")],
		"2022",
		dispatcher([
			["areaCode=W06000022", series([["2022", 160000]])],
			["areaCode=E05000009", series([["2022", 5000]])],
		]),
	);
	assert.equal(outcome.outcome, "ambiguous");
	if (outcome.outcome !== "ambiguous") return;
	assert.deepEqual(
		outcome.choices.map((choice) => choice.answer.value),
		[160000, 5000],
	);
});

test("tries names that merely begin with the query only when no exact match answers", () => {
	const exactUnserved = valueForPlace(
		measure,
		[
			candidate("majorTownAndCity/J01000001"),
			candidate("localAuthority/E09000027", "prefix"),
		],
		"2022",
		dispatcher([["areaCode=E09000027", series([["2022", 195000]])]]),
	);
	assert.equal(exactUnserved.outcome, "answered");
	if (exactUnserved.outcome === "answered") {
		assert.equal(exactUnserved.chosen.candidate.match, "prefix");
	}

	// An exact match that answers wins, and the prefix match is not even tried.
	const tried: string[] = [];
	const exactServed = valueForPlace(
		measure,
		[
			candidate("ward/E05000001"),
			candidate("localAuthority/E09000027", "prefix"),
		],
		"2022",
		(url) => {
			tried.push(url);
			return url.includes("E05000001")
				? series([["2022", 9000]])
				: series([["2022", 195000]]);
		},
	);
	assert.equal(exactServed.outcome, "answered");
	assert.equal(
		tried.some((url) => url.includes("E09000027")),
		false,
	);
});

test("says why each candidate went unanswered", () => {
	const outcome = valueForPlace(
		measure,
		[
			candidate("majorTownAndCity/J01000001"),
			candidate("location/devon", "exact", ["A"]),
		],
		"2022",
		dispatcher([["locationId=devon", refused("not a complete match")]]),
	);
	assert.equal(outcome.outcome, "unserved");
	if (outcome.outcome !== "unserved") return;
	const reasons = outcome.attempts.map((attempt) =>
		attempt.served ? "" : attempt.reason,
	);
	assert.match(reasons[0]!, /not published for majorTownAndCity/);
	// The underlying route's own refusal is passed on unchanged.
	assert.equal(reasons[1], "not a complete match");
});

test("refuses a period the measure does not publish, naming those it does", () => {
	const outcome = valueForPlace(
		measure,
		[candidate("location/north-west", "exact", ["A"])],
		"1999",
		dispatcher([]),
	);
	assert.equal(outcome.outcome, "unserved");
	if (outcome.outcome === "unserved" && !outcome.attempts[0]!.served) {
		assert.match(outcome.attempts[0]!.reason, /published: 2022, 2023/);
	}
});

test("reports an unmatched name as such", () => {
	assert.deepEqual(valueForPlace(measure, [], undefined, dispatcher([])), {
		outcome: "unmatched",
	});
});
