import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, expect, it } from "vitest";

import { artifactDirectory } from "@uk-data-atlas/atlas-db";
import { rebuildDatasetPayload } from "@uk-data-atlas/catalogue/node";
import {
	STATISTICS_DATASETS,
	directStatistics,
	type StatisticsInput,
} from "@uk-data-atlas/measures";
import { directPayloadProblem } from "../../src/checks/directPayloadGoldens.ts";
import { IdRegistries } from "../../src/ids/idRegistries.ts";
import { readDirectPartsFor } from "../../src/statistics/directSources.ts";
import { electionWinnerStatistics } from "../../src/statistics/electionWinnerStatistics.ts";
import {
	areaTables,
	statisticsTables,
	writeSqliteIndex,
} from "../../src/storage/index.ts";

/**
 * Reads the built `data/build` (a data build must have run). Every dataset
 * reads its source directly, and the payload rebuilt from the rows it stores
 * must match its committed golden hash. The rows are written by the build's
 * own row writer.
 */
const root = resolve(import.meta.dirname, "../../..");
const directory = mkdtempSync(join(tmpdir(), "direct-statistics-"));
afterAll(() => rmSync(directory, { recursive: true, force: true }));

const manifest: {
	datasets: {
		type: string;
		output: string;
		source: unknown;
		fingerprint: string;
		compiled: { sha256: string; bytes: number };
	}[];
} = JSON.parse(
	readFileSync(
		join(root, "data/build/datasets/dataset-manifest.json"),
		"utf8",
	),
);
// A dataset's sources are read when its test needs them, and dropped after it.
const directParts = new Map<string, ReturnType<typeof readDirectPartsFor>>();
const readParts = (type: string) => {
	let parts = directParts.get(type);
	if (!parts)
		directParts.set(type, (parts = readDirectPartsFor(root, [type])));
	return parts;
};

/**
 * Datasets a payload is rebuilt with: a per-100,000 figure divides by the
 * population in the same database.
 */
const supporting: Record<string, string[]> = {
	jobs: ["population-uk"],
	"business-activity": ["population-uk"],
	waste: ["population-uk"],
	"electric-vehicle-chargers": ["population-uk"],
	"electricity-consumption": ["population-uk"],
	"gas-consumption": ["population-uk"],
};

/** One dataset's statistics, from the rows its source reads straight to. */
async function statisticsOf(type: string) {
	const config = STATISTICS_DATASETS.find((entry) => entry.type === type)!;
	const entry = manifest.datasets.find(
		(candidate) => candidate.type === type,
	)!;
	const parts = await readParts(type);
	const statistics = directStatistics(config, parts.get(type)!, entry);
	// The build adds each contest's winning party to these two.
	const input: StatisticsInput =
		type === "general-election" || type === "local-election"
			? (areas) => electionWinnerStatistics(statistics(areas))
			: statistics;
	return { entry, input };
}

/** Writes one dataset's rows, and those it needs, onto the real area tables. */
async function write(name: string, type: string) {
	const path = join(directory, `${name}.sqlite`);
	const datasets = await Promise.all(
		[type, ...(supporting[type] ?? [])].map(async (name) => ({
			type: name,
			...(await statisticsOf(name)),
		})),
	);
	writeSqliteIndex(
		path,
		{ schemaVersion: "3" },
		{
			...areaTables(artifactDirectory(root)),
			payloads: {
				columns: ["id TEXT NOT NULL", "payload BLOB NOT NULL"],
				key: ["id"],
				rows: [],
			},
			...statisticsTables(
				datasets.map(({ input }) => input),
				IdRegistries.memory(),
				new Map(
					datasets.map(({ type: other, entry }) => [
						entry.output,
						{
							type: other,
							sha256: entry.compiled.sha256,
							bytes: entry.compiled.bytes,
							payloadId: null,
						},
					]),
				),
			),
		},
	);
	return { path, entry: datasets[0]!.entry };
}

it.each([
	"land-area",
	"council-tax",
	"net-additional-dwellings",
	"local-government-finance",
	"adult-social-care-activity",
	"adult-social-care-outcomes",
	"housing-affordability",
	"planning-applications",
	"broadband",
	"mobile-coverage",
	"nhs-waiting",
	"nimdm",
	"simd",
	"wimd",
	"imd",
	"income",
	"workplace-income",
	"claimant-count",
	"jobs",
	"unemployment",
	"regional-gdp",
	"business-activity",
	"waste",
	"electric-vehicle-chargers",
	"electricity-consumption",
	"gas-consumption",
	"ghg-emissions",
	"air-quality",
	"pupil-absence",
	"qualification",
	"school-performance",
	"school-performance-disadvantage",
	"general-health",
	"housing-tenure",
	"public-health",
	"life-expectancy",
	"life-expectancy-series",
	"homelessness",
	"house-price",
	"child-poverty",
	"crime",
	"population",
	"population-constituency",
	"ethnicity",
	"population-uk",
	"car-availability",
	"travel-to-work",
	"road-collisions",
	"brexit",
	"brexit-constituency",
	"general-election",
	"historical-general-election",
	"local-election",
])("rebuilds the %s payload from direct source rows", async (type) => {
	const direct = await write(`${type}-direct-only`, type);
	const database = new DatabaseSync(direct.path, { readOnly: true });
	try {
		const payload = rebuildDatasetPayload(
			database,
			type,
			direct.entry.output,
		);
		expect(directPayloadProblem(type, payload)).toBeUndefined();
		// Counted, not read: the largest datasets hold millions of rows.
		const stored = database
			.prepare(
				`SELECT COUNT(*) AS count FROM v_observation WHERE dataset = ?`,
			)
			.get(direct.entry.output) as { count: number };
		expect(stored.count).toBeGreaterThan(0);
		if (type === "general-election" || type === "local-election") {
			const winners = database
				.prepare(
					`SELECT COUNT(*) AS count FROM v_observation WHERE dataset = ? AND measure = 'source-winning-party'`,
				)
				.get(direct.entry.output) as { count: number };
			expect(winners.count).toBeGreaterThan(0);
		}
	} finally {
		database.close();
		// Several are gigabytes, and /tmp may be memory.
		rmSync(direct.path, { force: true });
		directParts.clear();
	}
});
