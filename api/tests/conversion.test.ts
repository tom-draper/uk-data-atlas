import assert from "node:assert/strict";
import test from "node:test";
import {
	convertObservations,
	convertThroughSteps,
	type ConversionStep,
} from "../src/conversion";
import type { CrosswalkArtifact } from "../src/crosswalkInventory";
import { buildTranslationSteps } from "../src/resolver/translation";

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
	assert.equal(result.absence, "source-areas-not-mapped");
	assert.equal(result.areaCount, 1);
	assert.deepEqual(result.areaSample, ["E05009999"]);
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
	assert.equal(result.absence, "unweighted-split");
	assert.deepEqual(result.areaSample, ["E05000001"]);
});

const indexed = (
	crosswalk: CrosswalkArtifact,
	direction: "forward" | "reverse" = "forward",
): ConversionStep => ({
	artifact: crosswalk,
	direction,
	steps: buildTranslationSteps(crosswalk, direction),
});

const overlap = (
	id: string,
	basis: "area" | "population",
	records: Array<[string, Array<[string, number, number]>]>,
): CrosswalkArtifact =>
	({
		...artifact([]),
		id,
		method: basis === "area" ? "area-overlap" : "population-overlap",
		quality: "derived",
		weighting: { status: "published", basis },
		records: records.map(([source, targets]) => ({
			source: { code: source, labels: [] },
			targets: targets.map(([code, weight, targetShare]) => ({
				code,
				labels: [],
				weight,
				overlapAreaM2: weight,
				sourceShare: weight,
				targetShare,
			})),
		})),
	}) as unknown as CrosswalkArtifact;

test("multiplies published weights through every step of a path", () => {
	const first = overlap("first", "area", [
		[
			"A",
			[
				["X", 0.6, 1],
				["Y", 0.4, 1],
			],
		],
	]);
	const second = overlap("second", "population", [
		["X", [["T", 1, 0.5]]],
		[
			"Y",
			[
				["T", 0.5, 0.5],
				["U", 0.5, 1],
			],
		],
	]);

	const result = convertThroughSteps(
		[indexed(first), indexed(second)],
		[observed("A", 1000)],
	);

	assert.equal(result.status, "converted");
	if (result.status !== "converted") return;
	// Area weighting at any split step makes the whole path area-weighted.
	assert.equal(result.method, "area-weighted");
	assert.deepEqual(
		result.records.map((record) => [
			record.areaCode,
			Math.round(record.value),
		]),
		[
			["T", 800],
			["U", 200],
		],
	);
	assert.deepEqual(
		result.records.map((record) => record.inputAreaCount),
		[1, 1],
	);
});

test("stays exact through steps that only regroup", () => {
	const second = artifact([
		{
			source: { code: "E06000001", labels: [] },
			targets: [{ code: "E12000001", labels: [] }],
		},
		{
			source: { code: "E06000002", labels: [] },
			targets: [{ code: "E12000001", labels: [] }],
		},
	]);

	const result = convertThroughSteps(
		[indexed(contained), indexed(second)],
		[
			observed("E05000001", 100),
			observed("E05000002", 250),
			observed("E05000003", 40),
		],
	);

	assert.equal(result.status, "converted");
	if (result.status !== "converted") return;
	assert.equal(result.method, "exact");
	assert.deepEqual(result.records, [
		{
			areaCode: "E12000001",
			value: 390,
			status: "derived",
			inputAreaCount: 3,
		},
	]);
});

test("apportions through a reversed overlap by the queried area's covered share", () => {
	// Published from A to B: B1 is 30% A1 and 50% A2, with 20% unpublished.
	const published = overlap("a-to-b", "area", [
		["A1", [["B1", 1, 0.3]]],
		[
			"A2",
			[
				["B1", 0.5, 0.5],
				["B2", 0.5, 1],
			],
		],
	]);

	const result = convertThroughSteps(
		[indexed(published, "reverse")],
		[observed("B1", 800)],
	);

	assert.equal(result.status, "converted");
	if (result.status !== "converted") return;
	assert.deepEqual(
		result.records.map((record) => [
			record.areaCode,
			Math.round(record.value),
		]),
		[
			["A1", 300],
			["A2", 500],
		],
	);
});

test("refuses a path whose later step does not carry a reached area", () => {
	const second = artifact([
		{
			source: { code: "E06000001", labels: [] },
			targets: [{ code: "E12000001", labels: [] }],
		},
	]);

	const result = convertThroughSteps(
		[indexed(contained), indexed(second)],
		[observed("E05000001", 100), observed("E05000003", 40)],
	);

	assert.equal(result.status, "refused");
	if (result.status !== "refused") return;
	assert.equal(result.absence, "source-areas-not-mapped");
	assert.deepEqual(result.areaSample, ["E05000003"]);
	assert.match(result.reason, /Step 2 of the path, crosswalk test-crosswalk/);
});

test("refuses a path that splits without a weight at a later step", () => {
	const second = artifact([
		{
			source: { code: "E06000001", labels: [] },
			targets: [
				{ code: "E12000001", labels: [] },
				{ code: "E12000002", labels: [] },
			],
		},
	]);

	const result = convertThroughSteps(
		[indexed(contained), indexed(second)],
		[observed("E05000001", 100)],
	);

	assert.equal(result.status, "refused");
	if (result.status !== "refused") return;
	assert.equal(result.absence, "unweighted-split");
	assert.deepEqual(result.areaSample, ["E05000001"]);
	assert.match(result.reason, /at step 2 of the path/);
});

test("names a path population-weighted only when every split step is", () => {
	const first = overlap("first", "population", [
		[
			"A",
			[
				["X", 0.5, 1],
				["Y", 0.5, 1],
			],
		],
	]);
	const second = overlap("second", "population", [
		["X", [["T", 1, 1]]],
		["Y", [["T", 1, 1]]],
	]);

	const result = convertThroughSteps(
		[indexed(first), indexed(second)],
		[observed("A", 10)],
	);

	assert.equal(result.status, "converted");
	if (result.status !== "converted") return;
	assert.equal(result.method, "population-weighted");
	assert.deepEqual(
		result.records.map((record) => record.value),
		[10],
	);
});
