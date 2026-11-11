import assert from "node:assert/strict";
import { test } from "vitest";
import type { StatisticsDataset } from "@uk-data-atlas/measures";
import { collectParties } from "../../src/storage/statisticsParties";

const release = { geography: "constituency", id: "2024-07-uk-bgc" };

const dataset = (
	contests: { first?: string; second?: string; winner?: string }[],
	parties: StatisticsDataset["parties"] = [],
) =>
	({
		parties,
		elections: () => [
			{
				label: "2024",
				kind: "general",
				date: "2024-07-04",
				release,
				contests: contests.map(({ first, second, winner }, index) => ({
					release,
					code: `E14${index}`,
					contest: {
						first_party: first,
						second_party: second,
						winner,
					},
				})),
			},
		],
	}) as unknown as StatisticsDataset;

test("joins an abbreviation and a winner key into one party", () => {
	const { rows, idOfCode, idOfKey } = collectParties([
		dataset(
			[
				{ first: "Lab", second: "Con", winner: "LAB" },
				{ first: "Spk", winner: "SPK" },
				{ winner: "OTHER" },
			],
			[{ key: "LAB", name: "Labour", colour: "#e91d0e" }],
		),
	]);
	assert.deepEqual(
		rows.map(({ id, code, key, name, colour }) => [
			id,
			code,
			key,
			name,
			colour,
		]),
		[
			[1, "Con", "CON", "Con", null],
			[2, "Lab", "LAB", "Labour", "#e91d0e"],
			[3, "OTHER", "OTHER", "OTHER", null],
			[4, "Spk", "SPK", "Spk", null],
		],
	);
	assert.equal(idOfKey("LAB"), idOfCode("Lab"));
	assert.equal(idOfKey("OTHER"), 3);
	assert.throws(() => idOfCode("LAB"), /Unknown party code LAB/);
});

test("refuses two abbreviations that share a key", () => {
	assert.throws(
		() => collectParties([dataset([{ first: "Lab", second: "LAB" }])]),
		/share key LAB/,
	);
});

test("refuses a party declared two ways", () => {
	assert.throws(
		() =>
			collectParties([
				dataset([], [{ key: "LAB", name: "Labour" }]),
				dataset([], [{ key: "LAB", name: "Labor" }]),
			]),
		/Conflicting party LAB/,
	);
});
