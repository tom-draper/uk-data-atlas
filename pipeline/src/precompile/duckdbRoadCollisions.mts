import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { join } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import {
	ROAD_COLLISION_SOURCES,
	ROAD_COLLISION_MONTHS,
} from "../../../packages/datasets/src/data/road-safety/authorityLoader";
import type {
	RoadCollisionsDataset,
	RoadCollisionsLADData,
	RoadCollisionsLSOAData,
} from "../../../packages/datasets/src/types/roadCollisions";
import { fileStamp, sameFileStamp } from "./cache.mts";
import { SOURCE_DATA } from "./paths.mts";

export async function compileDuckdbRoadCollisions(
	artifacts: ReturnType<
		typeof import("./trackedReader.mts").createTrackedReader
	>["artifacts"],
	root = SOURCE_DATA,
) {
	const instance = await DuckDBInstance.create(":memory:");
	const connection = await instance.connect();
	try {
		const datasets: Record<string, RoadCollisionsDataset> = {};
		for (const source of ROAD_COLLISION_SOURCES) {
			const file = join(root, source);
			const before = await fileStamp(file);
			const hash = createHash("sha256");
			let bytes = 0;
			for await (const chunk of createReadStream(file)) {
				hash.update(chunk as Buffer);
				bytes += (chunk as Buffer).length;
			}
			const path = file.replaceAll("'", "''");
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
			const data: Record<string, RoadCollisionsLADData> = {},
				lsoas: Record<string, RoadCollisionsLSOAData> = {},
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
			const after = await fileStamp(file);
			if (!sameFileStamp(before, after) || bytes !== after.bytes)
				throw new Error(`Source changed while reading: ${file}`);
			artifacts.set(`text:${source}`, {
				kind: "text",
				path: source,
				bytes,
				sha256: hash.digest("hex"),
				input: after,
			});
			datasets[String(year)] = {
				id: `roadCollisions${year}`,
				type: "roadCollisions",
				year,
				period: `${ROAD_COLLISION_MONTHS[first - 1]} to ${ROAD_COLLISION_MONTHS[last - 1]} ${year}`,
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
