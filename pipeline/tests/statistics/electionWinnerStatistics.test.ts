import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "vitest";
import { seriesKey, type StatisticsDataset } from "@uk-data-atlas/measures";
import { electionWinnerStatistics } from "../../src/statistics/electionWinnerStatistics";

const release = { geography: "constituency", id: "constituency-2024" };

/** A general election of contests with the given winners, by area code. */
const election = (winners: Record<string, string | null>) =>
	({
		slug: "general-election",
		topic: "general-elections",
		title: "General election",
		description: "Election results",
		source: { publisher: "Test", licence: "Test" },
		fingerprint: "fixture",
		measures: [],
		periods: [
			{
				label: "2024-07-04",
				kind: "date",
				start: "2024-07-04",
				end: "2024-07-04",
			},
		],
		series: [{ measure: "votes", release }],
		observations: function* () {},
		elections: () => [
			{
				label: "2024",
				kind: "general" as const,
				date: "2024-07-04",
				release,
				contests: Object.entries(winners).map(([code, winner]) => ({
					release,
					code,
					contest: { winner },
				})),
			},
		],
	}) satisfies StatisticsDataset;

test("stores source winning party codes against the matching election area and period", () => {
	const result = electionWinnerStatistics(
		election({ A: "LAB", B: "SPK", C: null }),
	);
	assert.deepEqual(
		[...result.observations()],
		[
			{
				series: 1,
				code: "A",
				period: "2024-07-04",
				value: null,
				category: "LAB",
			},
			{
				series: 1,
				code: "B",
				period: "2024-07-04",
				value: null,
				category: "SPK",
			},
		],
	);
});

test("refuses a winning party the atlas has no code for", () => {
	const result = electionWinnerStatistics(election({ A: "NOPE" }));
	assert.throws(
		() => [...result.observations()],
		/invalid winning party NOPE/,
	);
});

test("refuses winning party rows that differ from the contests' winners", () => {
	const result = electionWinnerStatistics(election({ A: "LAB" }));
	const key = seriesKey("general-election", result.series[1]!);
	const database = (winner: number | null) => {
		const db = new DatabaseSync(":memory:");
		db.exec(`
			CREATE TABLE series (id INTEGER, key TEXT, dataset_id INTEGER, method TEXT NOT NULL DEFAULT 'published');
			CREATE TABLE dimension_member (id INTEGER, code TEXT);
			CREATE TABLE period (id INTEGER, label TEXT);
			CREATE TABLE observation (series_id INTEGER, area_version_id INTEGER, period_id INTEGER, category_id INTEGER);
			CREATE TABLE election (id INTEGER, dataset_id INTEGER, date TEXT);
			CREATE TABLE contest (id INTEGER, election_id INTEGER, area_version_id INTEGER, winner_party_id INTEGER);
			CREATE TABLE party (id INTEGER, key TEXT);
			INSERT INTO series (id, key, dataset_id) VALUES (1, '${key}', 1);
			INSERT INTO dimension_member VALUES (1, 'LAB');
			INSERT INTO period VALUES (1, '2024-07-04');
			INSERT INTO observation VALUES (1, 1, 1, 1);
			INSERT INTO election VALUES (1, 1, '2024-07-04');
			INSERT INTO party VALUES (1, 'LAB'), (2, 'CON');
			INSERT INTO contest VALUES (1, 1, 1, ${winner});
		`);
		return db;
	};
	assert.doesNotThrow(() => result.verify!(database(1)));
	assert.throws(
		() => result.verify!(database(2)),
		/1 winning party rows differ/,
	);
	assert.throws(
		() => result.verify!(database(null)),
		/1 winning party rows differ/,
	);
});
