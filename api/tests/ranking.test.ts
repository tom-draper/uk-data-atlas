import assert from "node:assert/strict";
import test from "node:test";
import { rankObservations } from "../src/ranking";

test("uses competition ranking and orders ties by area code", () => {
	const records = [
		{ areaCode: "C", value: 2, status: "observed" as const },
		{ areaCode: "B", value: 4, status: "observed" as const },
		{ areaCode: "A", value: 4, status: "observed" as const },
	];
	assert.deepEqual(rankObservations(records, "desc"), [
		{ areaCode: "A", value: 4, status: "observed", rank: 1, tieCount: 2 },
		{ areaCode: "B", value: 4, status: "observed", rank: 1, tieCount: 2 },
		{ areaCode: "C", value: 2, status: "observed", rank: 3, tieCount: 1 },
	]);
	assert.deepEqual(
		rankObservations(records, "asc").map(({ areaCode, rank }) => [
			areaCode,
			rank,
		]),
		[
			["C", 1],
			["A", 2],
			["B", 2],
		],
	);
});
