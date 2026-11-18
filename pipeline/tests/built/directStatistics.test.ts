import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, describe, expect, it } from "vitest";

import { artifactDirectory } from "@uk-data-atlas/atlas-db";
import { rebuildDatasetPayload } from "@uk-data-atlas/catalogue/node";
import {
	STATISTICS_DATASETS,
	declaredStatistics,
	directStatistics,
	type StatisticsInput,
} from "@uk-data-atlas/measures";
import { directPayloadProblem } from "../../src/checks/directPayloadGoldens.ts";
import { payloadDifference } from "../../src/checks/payloadComparison.ts";
import { comparableCompiled } from "@uk-data-atlas/catalogue/node";
import { IdRegistries } from "../../src/ids/idRegistries.ts";
import { readDirectPartsFor } from "../../src/statistics/directSources.ts";
import {
	areaTables,
	statisticsTables,
	writeSqliteIndex,
} from "../../src/storage/index.ts";

/**
 * Reads the built `data/build` (a data build must have run). A dataset that
 * reads its source directly must store exactly the rows its compiled JSON
 * stores, and the JSON must be recoverable from those rows. Both are checked
 * by query over a database written by the build's own row writer.
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
// Direct-only datasets have no compiled JSON to compare with; the dataset
// payload check holds their rebuilt payload to a golden hash instead.
// A dataset's sources are read when its first test needs them, not all at once.
const directParts = new Map<string, ReturnType<typeof readDirectPartsFor>>();
const readParts = (type: string) => {
	let parts = directParts.get(type);
	if (!parts)
		directParts.set(type, (parts = readDirectPartsFor(root, [type])));
	return parts;
};

const directTypes = STATISTICS_DATASETS.filter(
	({ direct }) => direct && !direct.only,
).map(({ type }) => type);

/**
 * Datasets a payload is rebuilt with: a per-100,000 figure divides by the
 * population in the same database. They are written from their compiled JSON.
 */
const supporting: Record<string, string[]> = {
	jobs: ["population-uk"],
	"business-activity": ["population-uk"],
	waste: ["population-uk"],
	"electric-vehicle-chargers": ["population-uk"],
	"electricity-consumption": ["population-uk"],
	"gas-consumption": ["population-uk"],
};

/** Writes one dataset's rows, from either path, onto the real area tables. */
function write(
	name: string,
	type: string,
	input: (entry: (typeof manifest.datasets)[number]) => StatisticsInput,
) {
	const entry = manifest.datasets.find(
		(candidate) => candidate.type === type,
	)!;
	const path = join(directory, `${name}.sqlite`);
	const others = (supporting[type] ?? []).map((other) => {
		const config = STATISTICS_DATASETS.find(
			(candidate) => candidate.type === other,
		)!;
		const compiled = manifest.datasets.find(
			(candidate) => candidate.type === other,
		)!;
		return { config, compiled };
	});
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
				[
					input(entry),
					...others.map(({ config, compiled }) =>
						declaredStatistics(
							config,
							() =>
								readFileSync(
									join(
										root,
										`data/build/datasets/${compiled.output}.json`,
									),
									"utf8",
								),
							compiled,
						),
					),
				],
				IdRegistries.memory(),
				new Map(
					[
						{ type, entry },
						...others.map(({ config, compiled }) => ({
							type: config.type,
							entry: compiled,
						})),
					].map(({ type: other, entry: found }) => [
						found.output,
						{
							type: other,
							sha256: found.compiled.sha256,
							bytes: found.compiled.bytes,
							payloadId: null,
						},
					]),
				),
			),
		},
	);
	return { path, entry };
}

/** Every stored fact of a dataset, by natural key, so ids and order do not count. */
function snapshot(path: string, output: string) {
	const database = new DatabaseSync(path, { readOnly: true });
	try {
		const all = (sql: string) =>
			database
				.prepare(sql)
				.all(output)
				.map((row) => ({ ...row }));
		return {
			observations: all(
				`SELECT measure, members, area_code, area_name, geography, release,
				        period, value, lower, upper, category, status, method
				 FROM v_observation WHERE dataset = ?
				 ORDER BY measure, members, geography, release, area_code, period`,
			),
			series: all(
				`SELECT s.key, s.method, r.geography, r.release, m.slug AS measure
				 FROM series s JOIN dataset d ON d.id = s.dataset_id
				 JOIN measure m ON m.id = s.measure_id
				 JOIN area_releases r ON r.id = s.release_id
				 WHERE d.slug = ? ORDER BY s.key`,
			),
			members: all(
				`SELECT dim.slug AS dimension, dm.code, dm.label, p.code AS parent, dm.position
				 FROM dimension_member dm JOIN dimension dim ON dim.id = dm.dimension_id
				 LEFT JOIN dimension_member p ON p.id = dm.parent_id
				 WHERE dim.id IN (SELECT sm.dimension_id FROM series_member sm
				   JOIN series s ON s.id = sm.series_id JOIN dataset d ON d.id = s.dataset_id
				   WHERE d.slug = ?)
				 ORDER BY dim.slug, dm.position, dm.code`,
			),
			areaVersions: all(
				`SELECT r.geography, r.release, a.code, v.name
				 FROM dataset_area_name n JOIN dataset d ON d.id = n.dataset_id
				 JOIN area_version v ON v.id = n.area_version_id
				 JOIN area a ON a.id = v.area_id
				 JOIN area_releases r ON r.id = v.release_id
				 WHERE d.slug = ? ORDER BY r.geography, r.release, a.code`,
			),
			keys: all(
				`SELECT r.geography, r.release, a.code, k.key
				 FROM dataset_area_key k JOIN dataset d ON d.id = k.dataset_id
				 JOIN area_version v ON v.id = k.area_version_id JOIN area a ON a.id = v.area_id
				 JOIN area_releases r ON r.id = v.release_id WHERE d.slug = ?
				 ORDER BY r.geography, r.release, a.code`,
			),
			relationships: all(
				`SELECT l.relation, p.label AS period, cr.geography AS child_geography,
				 cr.release AS child_release, ca.code AS child_code, pr.geography AS parent_geography,
				 pr.release AS parent_release, pa.code AS parent_code
				 FROM area_relationship l JOIN dataset d ON d.id = l.dataset_id
				 JOIN period p ON p.id = l.period_id
				 JOIN area_version cv ON cv.id = l.child_version_id JOIN area ca ON ca.id = cv.area_id JOIN area_releases cr ON cr.id = cv.release_id
				 JOIN area_version pv ON pv.id = l.parent_version_id JOIN area pa ON pa.id = pv.area_id JOIN area_releases pr ON pr.id = pv.release_id
				 WHERE d.slug = ? ORDER BY l.relation, p.label, cr.geography, cr.release, ca.code, pr.geography, pr.release, pa.code`,
			),
			periods: all(
				`SELECT DISTINCT p.label, p.kind, p.start_date, p.end_date
				 FROM observation o JOIN series s ON s.id = o.series_id
				 JOIN dataset d ON d.id = s.dataset_id
				 JOIN period p ON p.id = o.period_id
				 WHERE d.slug = ? ORDER BY p.label`,
			),
		};
	} finally {
		database.close();
	}
}

describe.each(directTypes)("%s read straight from its source", (type) => {
	const config = STATISTICS_DATASETS.find((entry) => entry.type === type)!;
	const compiled = write(`${type}-compiled`, type, (entry) =>
		declaredStatistics(
			config,
			() =>
				readFileSync(
					join(root, `data/build/datasets/${entry.output}.json`),
					"utf8",
				),
			entry,
		),
	);
	let direct: ReturnType<typeof write>;

	it("stores the rows its compiled JSON stores", async () => {
		const parts = await readParts(type);
		direct = write(`${type}-direct`, type, (entry) =>
			directStatistics(config, parts.get(type)!, entry),
		);
		const before = snapshot(compiled.path, compiled.entry.output);
		const after = snapshot(direct.path, direct.entry.output);
		expect(before.observations.length).toBeGreaterThan(0);
		for (const key of Object.keys(before) as (keyof typeof before)[])
			expect(after[key], key).toEqual(before[key]);
	});

	it("rebuilds the compiled JSON from those rows", () => {
		const database = new DatabaseSync(direct.path, { readOnly: true });
		try {
			const rebuilt: unknown = JSON.parse(
				rebuildDatasetPayload(database, type, direct.entry.output),
			);
			const old: unknown = JSON.parse(
				readFileSync(
					join(
						root,
						`data/build/datasets/${direct.entry.output}.json`,
					),
					"utf8",
				),
			);
			expect(
				payloadDifference(rebuilt, comparableCompiled(type, old)),
			).toBeUndefined();
		} finally {
			database.close();
		}
	});
});

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
])("rebuilds the %s payload from direct source rows", async (type) => {
	const config = STATISTICS_DATASETS.find((entry) => entry.type === type)!;
	const parts = await readParts(type);
	const direct = write(`${type}-direct-only`, type, (entry) =>
		directStatistics(config, parts.get(type)!, entry),
	);
	const database = new DatabaseSync(direct.path, { readOnly: true });
	try {
		const payload = rebuildDatasetPayload(
			database,
			type,
			direct.entry.output,
		);
		expect(directPayloadProblem(type, payload)).toBeUndefined();
		expect(
			snapshot(direct.path, direct.entry.output).observations.length,
		).toBeGreaterThan(0);
	} finally {
		database.close();
	}
});
