import assert from "node:assert/strict";
import test from "node:test";
import { createAreaLookup } from "../src/areaInventory";
import { reconcileMembers } from "../src/memberReconciliation";

const release = (
	boundaryRelease: string,
	areas: Array<{ code: string; name: string }>,
) => ({
	schemaVersion: 1 as const,
	contentHash: `sha256:${boundaryRelease}`,
	geography: "localAuthority",
	boundaryRelease,
	codeProperty: "LADCD",
	nameProperty: "LADNM",
	areas,
});

const lookup = createAreaLookup([
	release("2019-12-uk-bgc", [
		{ code: "E07000028", name: "Carlisle" },
		{ code: "E06000029", name: "Poole" },
	]),
	release("2022-12-uk-bgc-v2", [{ code: "E07000028", name: "Carlisle" }]),
	release("2023-05-uk-bgc-v2", [{ code: "E06000058", name: "BCP" }]),
	release("2025-05-uk-bgc-v2", [{ code: "E08000038", name: "Barnsley" }]),
]);

test("classifies an unresolved member against the compiled releases", () => {
	const coverage = reconcileMembers(
		lookup,
		"localAuthority",
		"2023-05-uk-bgc-v2",
		["E06000058", "E07000028", "E08000038", "E09000999"],
		new Set(["E06000058"]),
	);

	assert.equal(coverage.memberCodeCount, 4);
	assert.equal(coverage.resolvedCount, 1);
	assert.equal(coverage.unresolvedCount, 3);
	assert.equal(coverage.complete, false);
	assert.deepEqual(
		coverage.unresolved.map(({ code, status, name }) => ({
			code,
			status,
			name,
		})),
		[
			{ code: "E07000028", status: "superseded", name: "Carlisle" },
			{ code: "E08000038", status: "not-yet-current", name: "Barnsley" },
			{ code: "E09000999", status: "unknown", name: undefined },
		],
	);
});

test("names the releases that are the evidence for a classification", () => {
	const coverage = reconcileMembers(
		lookup,
		"localAuthority",
		"2023-05-uk-bgc-v2",
		["E07000028"],
		new Set(),
	);
	assert.deepEqual(coverage.unresolved[0]?.presentIn, [
		"2019-12-uk-bgc",
		"2022-12-uk-bgc-v2",
	]);
});

// A code either side of the requested release is not a clean succession story,
// so it is reported as absent rather than guessed at in one direction.
test("reports a code present before and after as absent from the release", () => {
	const straddling = createAreaLookup([
		release("2019-12-uk-bgc", [{ code: "E07000028", name: "Carlisle" }]),
		release("2023-05-uk-bgc-v2", []),
		release("2025-05-uk-bgc-v2", [{ code: "E07000028", name: "Carlisle" }]),
	]);
	const coverage = reconcileMembers(
		straddling,
		"localAuthority",
		"2023-05-uk-bgc-v2",
		["E07000028"],
		new Set(),
	);
	assert.equal(coverage.unresolved[0]?.status, "absent-from-release");
});

test("does not order releases whose id carries no date", () => {
	const undated = createAreaLookup([
		release("legacy-lad", [{ code: "E07000028", name: "Carlisle" }]),
		release("2023-05-uk-bgc-v2", []),
	]);
	assert.equal(
		reconcileMembers(
			undated,
			"localAuthority",
			"2023-05-uk-bgc-v2",
			["E07000028"],
			new Set(),
		).unresolved[0]?.status,
		"absent-from-release",
	);
	assert.equal(
		reconcileMembers(
			undated,
			"localAuthority",
			"legacy-lad",
			["E06000029"],
			new Set(),
		).unresolved[0]?.status,
		"unknown",
	);
});

test("reports complete coverage when every member resolves", () => {
	const coverage = reconcileMembers(
		lookup,
		"localAuthority",
		"2023-05-uk-bgc-v2",
		["E06000058"],
		new Set(["E06000058"]),
	);
	assert.equal(coverage.complete, true);
	assert.deepEqual(coverage.unresolved, []);
});

test("ignores codes belonging to another geography", () => {
	const mixed = createAreaLookup([
		release("2023-05-uk-bgc-v2", []),
		{
			...release("2023-05-uk-bgc-v2", [
				{ code: "E05000001", name: "A ward" },
			]),
			geography: "ward",
		},
	]);
	assert.equal(
		reconcileMembers(
			mixed,
			"localAuthority",
			"2023-05-uk-bgc-v2",
			["E05000001"],
			new Set(),
		).unresolved[0]?.status,
		"unknown",
	);
});
