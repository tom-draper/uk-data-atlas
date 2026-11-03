import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { crimePartnershipStatistics } from "../src/crimePartnershipStatistics";
import type {
	AreaIndex,
	DeclaredDataset,
	StatisticsDataset,
} from "@uk-data-atlas/atlas-runtime/catalogue";

const release = { geography: "localAuthority", id: "2023-la" };
const measure = {
	slug: "recorded-crimes",
	label: "Crime",
	description: "Counts",
	unit: "offences",
	valueKind: "count",
	aggregation: "sum",
} as const;
const config: DeclaredDataset = {
	type: "crime",
	measures: [measure],
	fields: [],
	dimensions: [
		{
			slug: "offence",
			label: "Offence",
			members: [
				{ key: "burglary", code: "burglary" },
				{ key: "theft", code: "theft" },
			],
		},
	],
};
const base: StatisticsDataset = {
	slug: "crime",
	title: "Crime",
	description: "Crime",
	source: { publisher: "ONS", licence: "OGL" },
	fingerprint: "test",
	measures: [measure],
	dimensions: [
		{
			slug: "offence",
			label: "Offence",
			members: [
				{ code: "burglary", label: "Burglary" },
				{ code: "theft", label: "Theft" },
			],
		},
	],
	periods: [
		{ label: "2026", kind: "year", start: "2026-01-01", end: "2026-12-31" },
	],
	series: [
		{ measure: measure.slug, release, members: { offence: "burglary" } },
	],
	*observations() {
		yield { series: 0, code: "E00000001", period: "2026", value: 3 };
	},
};
const areas: AreaIndex = {
	release: (geography, year) => ({ geography, id: `${year}-test` }),
	find: (geography, year) => ({ geography, id: `${year}-test` }),
	has: () => true,
};

test("streams partnership records into the crime dataset without replacing its other rows", () => {
	const root = mkdtempSync(join(tmpdir(), "atlas-crime-partnership-"));
	const path = join(root, "crime.json");
	try {
		writeFileSync(
			path,
			JSON.stringify({
				"2026": {
					data: { ignored: { burglary: 100 } },
					partnerships: {
						E22000001: { burglary: 9, theft: -1 },
						E22000002: { burglary: 0, theft: null },
					},
				},
			}),
		);
		const dataset = crimePartnershipStatistics(base, areas, config, path);
		assert.deepEqual(
			dataset.series.map((series) => series.release.geography),
			[
				"localAuthority",
				"communitySafetyPartnership",
				"communitySafetyPartnership",
			],
		);
		assert.deepEqual(
			[...dataset.observations()],
			[
				{ series: 0, code: "E00000001", period: "2026", value: 3 },
				{ series: 1, code: "E22000001", period: "2026", value: 9 },
				{ series: 2, code: "E22000001", period: "2026", value: -1 },
				{ series: 1, code: "E22000002", period: "2026", value: 0 },
			],
		);
		writeFileSync(path, JSON.stringify({ "2026": { partnerships: {} } }));
		assert.throws(
			() => [...dataset.observations()],
			/no partnership records/,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
