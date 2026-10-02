import assert from "node:assert/strict";
import test from "node:test";
import { createAreaLookup } from "../src/areaInventory";
import { summariseBatch, validateBatch } from "../src/batchValidation";

const release = (
	geography: string,
	boundaryRelease: string,
	areas: Array<{ code: string; name: string; aliases?: string[] }>,
) => ({
	schemaVersion: 1 as const,
	contentHash: `sha256:${geography}-${boundaryRelease}`,
	geography,
	boundaryRelease,
	codeProperty: "CD",
	nameProperty: "NM",
	areas,
});

const areaLookup = createAreaLookup([
	release("localAuthority", "2019-12-uk", [
		{ code: "E07000026", name: "Allerdale" },
		{ code: "E08000003", name: "Manchester" },
	]),
	release("localAuthority", "2025-05-uk", [
		{ code: "E08000003", name: "Manchester" },
		{ code: "E06000023", name: "Bristol, City of" },
		{ code: "W06000001", name: "Isle of Anglesey", aliases: ["Ynys Môn"] },
		{ code: "E06000063", name: "Cumberland" },
		{ code: "W06000022", name: "Newport" },
		{ code: "E07000299", name: "Newport" },
	]),
	release("localAuthority", "2026-05-uk", [
		{ code: "E06000099", name: "Future authority" },
	]),
	release("ward", "2025-05-uk", [{ code: "E05000650", name: "A ward" }]),
]);

const validate = (...values: string[]) =>
	validateBatch(areaLookup, "localAuthority", "2025-05-uk", values);

test("reports a code as valid, or why it is not", () => {
	assert.deepEqual(
		validate(
			"E08000003",
			"E07000026",
			"E06000099",
			"E05000650",
			"E09999999",
			"E0800003",
		).map((result) => result.status),
		[
			"valid",
			"superseded",
			"not-yet-current",
			"other-geography",
			"unknown",
			"malformed-code",
		],
	);
	const [, superseded, , otherGeography] = validate(
		"E08000003",
		"E07000026",
		"E06000099",
		"E05000650",
	);
	assert.deepEqual(
		superseded?.status === "superseded" && superseded.presentIn,
		[{ boundaryRelease: "2019-12-uk", name: "Allerdale" }],
	);
	assert.deepEqual(
		otherGeography?.status === "other-geography" && otherGeography.heldBy,
		[{ geography: "ward", boundaryReleases: ["2025-05-uk"] }],
	);
});

test("matches a name exactly, through an alias or without a title, and never by prefix", () => {
	const [exact, alias, titled, prefix] = validate(
		"manchester",
		"Ynys Mon",
		"Bristol",
		"Manch",
	);
	assert.equal(exact?.status === "matched" && exact.match, "exact");
	assert.equal(alias?.status === "matched" && alias.area.code, "W06000001");
	assert.equal(
		titled?.status === "matched" && titled.match,
		"exact-without-title",
	);
	assert.equal(prefix?.status, "unmatched");
});

test("returns every area a name could mean, and where an unmatched name does match", () => {
	const [ambiguous, abolished] = validate("Newport", "Allerdale");
	assert.deepEqual(
		ambiguous?.status === "ambiguous" &&
			ambiguous.candidates.map((candidate) => candidate.code),
		["E07000299", "W06000022"],
	);
	assert.deepEqual(abolished?.status === "unmatched" && abolished.matchesIn, [
		"2019-12-uk",
	]);
});

test("reports what was cleaned and what repeats, and whether the batch joins", () => {
	const results = validate("E08000003", " e08000003", "", "Manchester");
	assert.deepEqual(results[1]?.normalised, ["trimmed", "uppercased"]);
	assert.equal(results[1]?.duplicateOf, 0);
	assert.equal(results[2]?.status, "empty");
	assert.deepEqual(summariseBatch(results), {
		valueCount: 4,
		byStatus: { valid: 2, empty: 1, matched: 1 },
		duplicateCount: 1,
		normalisedCount: 1,
		joinable: false,
	});
	assert.equal(
		summariseBatch(validate("E08000003", "Bristol")).joinable,
		true,
	);
});
