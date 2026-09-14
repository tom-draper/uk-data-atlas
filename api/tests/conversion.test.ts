import assert from "node:assert/strict";
import test from "node:test";
import { convertObservations } from "../src/conversion";
import type { CrosswalkArtifact } from "../src/crosswalkInventory";

const artifact = (records: CrosswalkArtifact["records"]): CrosswalkArtifact =>
	({
		schemaVersion: 1,
		id: "test-crosswalk",
		method: "clean-containment",
		quality: "publisher-supplied",
		weighting: { status: "not-applicable" },
		from: { geography: "ward", boundaryRelease: "2023-05-uk-bgc" },
		to: {
			geography: "localAuthority",
			boundaryRelease: "2023-05-uk-bgc-v2",
		},
		provenance: { input: "lookup.geojson", inputHash: "sha256:input" },
		validation: { sourceNameConflicts: [], endpoints: {} },
		records,
		contentHash: "sha256:crosswalk",
	}) as unknown as CrosswalkArtifact;

const observed = (areaCode: string, value: number) => ({
	areaCode,
	value,
	status: "observed" as const,
});

const contained = artifact([
	{
		source: { code: "E05000001", labels: [] },
		targets: [{ code: "E06000001", labels: [] }],
	},
	{
		source: { code: "E05000002", labels: [] },
		targets: [{ code: "E06000001", labels: [] }],
	},
	{
		source: { code: "E05000003", labels: [] },
		targets: [{ code: "E06000002", labels: [] }],
	},
]);

test("regroups contained areas without changing the total", () => {
	const result = convertObservations(contained, [
		observed("E05000001", 100),
		observed("E05000002", 250),
		observed("E05000003", 40),
	]);

	assert.equal(result.status, "converted");
	if (result.status !== "converted") return;
	assert.equal(result.method, "exact");
	assert.deepEqual(result.records, [
		{
			areaCode: "E06000001",
			value: 350,
			status: "derived",
			inputAreaCount: 2,
		},
		{
			areaCode: "E06000002",
			value: 40,
			status: "derived",
			inputAreaCount: 1,
		},
	]);
	// A regrouping moves values between areas; it never creates or loses them.
	assert.equal(
		result.records.reduce((total, record) => total + record.value, 0),
		390,
	);
	assert.equal(result.inputRecordCount, 3);
});

test("apportions a split source by its published weights", () => {
	const split = artifact([
		{
			source: { code: "E05000001", labels: [] },
			targets: [
				{ code: "E06000001", labels: [], weight: 0.25 },
				{ code: "E06000002", labels: [], weight: 0.75 },
			],
		},
	] as unknown as CrosswalkArtifact["records"]);

	const result = convertObservations(split, [observed("E05000001", 400)]);

	assert.equal(result.status, "converted");
	if (result.status !== "converted") return;
	// Named an estimate, because area weighting assumes an even spread.
	assert.equal(result.method, "area-weighted");
	assert.deepEqual(
		result.records.map((record) => [record.areaCode, record.value]),
		[
			["E06000001", 100],
			["E06000002", 300],
		],
	);
});

test("refuses rather than dropping a source code the crosswalk lacks", () => {
	const result = convertObservations(contained, [
		observed("E05000001", 100),
		observed("E05009999", 500),
	]);

	assert.equal(result.status, "refused");
	if (result.status !== "refused") return;
	assert.match(result.reason, /does not carry 1 of the source partition/);
	assert.match(result.reason, /E05009999/);
	assert.match(result.reason, /No partial conversion was applied/);
});

test("refuses to apportion a split source with no weight", () => {
	const unweighted = artifact([
		{
			source: { code: "E05000001", labels: [] },
			targets: [
				{ code: "E06000001", labels: [] },
				{ code: "E06000002", labels: [] },
			],
		},
	]);

	const result = convertObservations(unweighted, [
		observed("E05000001", 400),
	]);

	assert.equal(result.status, "refused");
	if (result.status !== "refused") return;
	assert.match(
		result.reason,
		/split across several targets with no published weight/,
	);
});
