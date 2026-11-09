import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "vitest";
import {
	STATISTICS_DATASETS,
	seriesKey,
	type AreaIndex,
	type StatisticsDataset,
} from "@uk-data-atlas/atlas-runtime/measures";
import { electionWinnerStatistics } from "../src/statistics/electionWinnerStatistics";

test("stores source winning party codes against the matching election area and period", () => {
	const directory = mkdtempSync(join(tmpdir(), "election-winners-"));
	try {
		const path = join(directory, "election.json");
		writeFileSync(
			path,
			JSON.stringify({
				"2024": {
					year: 2024,
					boundaryType: "constituency",
					boundaryYear: 2024,
					results: { A: "LAB", B: "SPK" },
				},
			}),
		);
		const release = { geography: "constituency", id: "constituency-2024" };
		const base = {
			slug: "general-election",
			module: "politics",
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
		} satisfies StatisticsDataset;
		const areas: AreaIndex = {
			release: () => release,
			find: () => release,
			has: (_, code) => ["A", "B"].includes(code),
		};
		const config = STATISTICS_DATASETS.find(
			(item) => item.type === "generalElection",
		)!;
		const result = electionWinnerStatistics(base, areas, config, path);
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
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("refuses winning party rows that differ from the contests' winners", () => {
	const directory = mkdtempSync(join(tmpdir(), "election-winners-"));
	try {
		const path = join(directory, "election.json");
		writeFileSync(
			path,
			JSON.stringify({
				"2024": {
					year: 2024,
					boundaryType: "constituency",
					boundaryYear: 2024,
					results: { A: "LAB" },
				},
			}),
		);
		const release = { geography: "constituency", id: "constituency-2024" };
		const base = {
			slug: "general-election",
			module: "politics",
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
		} satisfies StatisticsDataset;
		const areas: AreaIndex = {
			release: () => release,
			find: () => release,
			has: () => true,
		};
		const config = STATISTICS_DATASETS.find(
			(item) => item.type === "generalElection",
		)!;
		const result = electionWinnerStatistics(base, areas, config, path);
		const key = seriesKey(base.slug, result.series[1]);
		const database = (winner: number | null) => {
			const db = new DatabaseSync(":memory:");
			db.exec(`
				CREATE TABLE series (id INTEGER, key TEXT, dataset_id INTEGER);
				CREATE TABLE dimension_member (id INTEGER, code TEXT);
				CREATE TABLE period (id INTEGER, label TEXT);
				CREATE TABLE observation (series_id INTEGER, area_version_id INTEGER, period_id INTEGER, category_id INTEGER);
				CREATE TABLE election (id INTEGER, dataset_id INTEGER, date TEXT);
				CREATE TABLE contest (id INTEGER, election_id INTEGER, area_version_id INTEGER, winner_party_id INTEGER);
				CREATE TABLE party (id INTEGER, key TEXT);
				INSERT INTO series VALUES (1, '${key}', 1);
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
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
