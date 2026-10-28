import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { DuckDBInstance } from "@duckdb/node-api";
import { loadRoadCollisionsByAuthority } from "../../packages/datasets/src/data/road-safety/authorityLoader";

const sources = [2024, 2025].map(
	(year) =>
		`transport/road-safety/dft-road-casualty-statistics-collision-${year}.csv`,
);
const root =
	process.env.ROAD_TRIAL_SOURCE_ROOT ?? join(process.cwd(), "data/source");
const months = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

async function duckdb() {
	const instance = await DuckDBInstance.create(":memory:");
	const connection = await instance.connect();
	try {
		const datasets: Record<string, unknown> = {};
		for (const source of sources) {
			const path = join(root, source).replaceAll("'", "''");
			await connection.run(
				`CREATE OR REPLACE TEMP TABLE input AS SELECT row_number() OVER () AS ordinal, trim(coalesce(local_authority_ons_district, '')) AS code, trim(coalesce(lsoa_of_accident_location, '')) AS lsoa, trim(coalesce(collision_severity, '')) AS severity, trim(coalesce(date, '')) AS date FROM read_csv('${path}', header=true, all_varchar=true, nullstr='')`,
			);
			const meta = (
				await connection.runAndReadAll(
					`SELECT count(*), count(*) FILTER (WHERE severity NOT IN ('1','2','3') OR NOT regexp_full_match(date, '\\d{2}/\\d{2}/\\d{4}')), count(DISTINCT right(date, 4)), min(right(date, 4)), string_agg(DISTINCT substring(date, 4, 2), ',' ORDER BY substring(date, 4, 2)) FROM input`,
				)
			).getRows()[0]!;
			if (
				Number(meta[0]) === 0 ||
				Number(meta[1]) !== 0 ||
				Number(meta[2]) !== 1
			)
				throw new Error(`Invalid collision rows in ${source}`);
			const year = Number(meta[3]);
			const covered = String(meta[4])
				.split(",")
				.map(Number)
				.sort((a, b) => a - b);
			const first = covered[0]!,
				last = covered.at(-1)!;
			if (!first || !last || covered.length !== last - first + 1)
				throw new Error(`Nonconsecutive months in ${source}`);
			const rows = (
				await connection.runAndReadAll(`WITH groups AS (
				SELECT 'lad' AS kind, code AS key, severity, ordinal FROM input WHERE regexp_full_match(code, '[EWS][0-9]{8}')
				UNION ALL SELECT 'lsoa', lsoa, severity, ordinal FROM input WHERE regexp_full_match(lsoa, '[EW]01[0-9]{6}')
				UNION ALL SELECT 'excluded', code, severity, ordinal FROM input WHERE NOT regexp_full_match(code, '[EWS][0-9]{8}')
				UNION ALL SELECT 'without', CASE left(code, 1) WHEN 'E' THEN 'GB-ENG' WHEN 'W' THEN 'GB-WLS' WHEN 'S' THEN 'GB-SCT' ELSE 'unknown' END, severity, ordinal FROM input WHERE NOT regexp_full_match(lsoa, '[EW]01[0-9]{6}')
			) SELECT kind, key, count(*), count(*) FILTER (WHERE severity='1'), count(*) FILTER (WHERE severity='2'), count(*) FILTER (WHERE severity='3') FROM groups GROUP BY kind, key ORDER BY min(ordinal)`)
			).getRows();
			const data: Record<string, unknown> = {},
				lsoas: Record<string, unknown> = {},
				withoutLsoa: Record<string, number> = {};
			const excluded: Array<{ code: string; collisions: number }> = [];
			for (const [
				kind,
				keyValue,
				total,
				fatal,
				serious,
				slight,
			] of rows) {
				const key = String(keyValue),
					collisions = Number(total);
				if (kind === "excluded")
					excluded.push({ code: key, collisions });
				else if (kind === "without") withoutLsoa[key] = collisions;
				else if (kind === "lad")
					data[key] = {
						ladCode: key,
						collisions,
						fatal: Number(fatal),
						serious: Number(serious),
						slight: Number(slight),
					};
				else if (kind === "lsoa")
					lsoas[key] = {
						lsoaCode: key,
						collisions,
						fatal: Number(fatal),
						serious: Number(serious),
						slight: Number(slight),
					};
			}
			excluded.sort((a, b) => a.code.localeCompare(b.code));
			if (Object.hasOwn(datasets, String(year)))
				throw new Error(
					`Road collision sources contain duplicate years: ${year}.`,
				);
			datasets[String(year)] = {
				id: `roadCollisions${year}`,
				type: "roadCollisions",
				year,
				period: `${months[first - 1]} to ${months[last - 1]} ${year}`,
				boundaryType: "localAuthority",
				boundaryYear: year,
				data,
				excluded,
				lsoaBoundaryYear: 2021,
				lsoas,
				withoutLsoa,
			};
		}
		return datasets;
	} finally {
		connection.closeSync();
		instance.closeSync();
	}
}

const mode = process.argv[2];
if (mode === "node" || mode === "duckdb") {
	const start = performance.now();
	const result =
		mode === "node"
			? await loadRoadCollisionsByAuthority(async (path) =>
					readFileSync(join(root, path), "utf8"),
				)
			: await duckdb();
	const elapsedSeconds = (performance.now() - start) / 1000;
	writeFileSync(process.argv[3]!, JSON.stringify(result));
	console.log(
		JSON.stringify({
			mode,
			elapsedSeconds,
			peakRssMiB: process.resourceUsage().maxRSS / 1024,
		}),
	);
} else {
	const temp = mkdtempSync(join(tmpdir(), "duckdb-road-collisions-"));
	try {
		const measurements: Record<
			string,
			Array<{ elapsedSeconds: number; peakRssMiB: number }>
		> = { node: [], duckdb: [] };
		for (let run = 0; run < 3; run++) {
			for (const variant of run % 2 === 0
				? ["node", "duckdb"]
				: ["duckdb", "node"]) {
				const path = join(temp, `${variant}.json`);
				const child = spawnSync(
					process.execPath,
					["--import", "tsx", process.argv[1]!, variant, path],
					{ encoding: "utf8" },
				);
				if (child.status !== 0)
					throw new Error(
						`${variant} failed: ${child.stderr || child.error}`,
					);
				measurements[variant]!.push(JSON.parse(child.stdout));
			}
			const expected = JSON.parse(
				readFileSync(join(temp, "node.json"), "utf8"),
			);
			const actual = JSON.parse(
				readFileSync(join(temp, "duckdb.json"), "utf8"),
			);
			assert.deepStrictEqual(actual, expected);
			assert.equal(
				readFileSync(join(temp, "duckdb.json"), "utf8"),
				readFileSync(join(temp, "node.json"), "utf8"),
			);
			console.log(
				JSON.stringify({
					run: run + 1,
					parity: true,
					years: Object.keys(expected),
					node: measurements.node!.at(-1),
					duckdb: measurements.duckdb!.at(-1),
				}),
			);
		}
	} finally {
		rmSync(temp, { recursive: true, force: true });
	}
}
