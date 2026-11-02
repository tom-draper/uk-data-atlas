import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	STATISTICS_DATASETS,
	type AreaIndex,
	type StatisticsDataset,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import { electionWinnerStatistics } from "../../../pipeline/src/electionWinnerStatistics";

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
