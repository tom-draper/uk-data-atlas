import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import type { DatasetReader } from "../../../packages/datasets/src/data/catalog/types";
import { fileStamp, sameFileStamp } from "./cache.mts";
import { SOURCE_DATA } from "./paths.mts";

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;

export async function withDuckdbSchoolPerformance<T>(
	reader: DatasetReader,
	artifacts: ReturnType<
		typeof import("./trackedReader.mts").createTrackedReader
	>["artifacts"],
	topic: "Total" | "Disadvantage status" | "Constituency",
	compile: (reader: DatasetReader) => Promise<T>,
	sourceRoot = SOURCE_DATA,
): Promise<T> {
	const fields =
		topic === "Constituency"
			? "geographic_level, geography_basis, time_period, pcon_code, pcon_name, engmath_94_percent, engmath_95_percent, attainment8_average, progress8_average, pupil_count"
			: "* EXCLUDE (ordinal)";
	const where = `geographic_level=${quote(topic === "Constituency" ? "Parliamentary constituency" : "Local authority district")} AND geography_basis='Pupil residency' ${topic === "Constituency" ? "" : `AND breakdown_topic=${quote(topic)}`}`;
	return withDuckdbFilteredCsv(
		reader,
		artifacts,
		fields,
		where,
		compile,
		sourceRoot,
	);
}

export async function withDuckdbImd<T>(
	reader: DatasetReader,
	artifacts: ReturnType<
		typeof import("./trackedReader.mts").createTrackedReader
	>["artifacts"],
	compile: (reader: DatasetReader) => Promise<T>,
	sourceRoot = SOURCE_DATA,
): Promise<T> {
	const columns = [
		"LSOA code (2021)",
		"LSOA name (2021)",
		"Local Authority District code (2024)",
		"Local Authority District name (2024)",
		"Index of Multiple Deprivation (IMD) Score",
		"Index of Multiple Deprivation (IMD) Rank (where 1 is most deprived)",
		"Index of Multiple Deprivation (IMD) Decile (where 1 is most deprived 10% of LSOAs)",
		"Income Score (rate)",
		"Employment Score (rate)",
		"Education, Skills and Training Score",
		"Health Deprivation and Disability Score",
		"Crime Score",
		"Barriers to Housing and Services Score",
		"Living Environment Score",
		"Total population: mid 2022",
	];
	return withDuckdbFilteredCsv(
		reader,
		artifacts,
		columns.map((name) => `"${name}"`).join(", "),
		`starts_with(trim("LSOA code (2021)"), 'E')`,
		compile,
		sourceRoot,
	);
}

export async function withDuckdbFilteredCsv<T>(
	reader: DatasetReader,
	artifacts: ReturnType<
		typeof import("./trackedReader.mts").createTrackedReader
	>["artifacts"],
	fields: string,
	where: string,
	compile: (reader: DatasetReader) => Promise<T>,
	sourceRoot = SOURCE_DATA,
): Promise<T> {
	const instance = await DuckDBInstance.create(":memory:");
	const connection = await instance.connect();
	const temp = await mkdtemp(join(tmpdir(), "atlas-dataset-csv-"));
	try {
		return await compile({
			...reader,
			text: async (path) => {
				const source = join(sourceRoot, path);
				const before = await fileStamp(source);
				const hash = createHash("sha256");
				let bytes = 0;
				for await (const chunk of createReadStream(source)) {
					hash.update(chunk as Buffer);
					bytes += (chunk as Buffer).length;
				}
				const output = join(temp, "selected.csv");
				await connection.run(`COPY (
    SELECT ${fields} FROM (
     SELECT *, row_number() OVER () AS ordinal FROM read_csv(${quote(source)}, header=true, all_varchar=true, nullstr='')
     WHERE ${where}
    ) ORDER BY ordinal
   ) TO ${quote(output)} (HEADER, FORMAT CSV)`);
				const after = await fileStamp(source);
				if (!sameFileStamp(before, after) || bytes !== after.bytes)
					throw new Error(`Source changed while reading: ${source}`);
				const selected = await readFile(output, "utf8");
				artifacts.set(`text:${path}`, {
					kind: "text",
					path,
					bytes,
					sha256: hash.digest("hex"),
					input: after,
				});
				return selected;
			},
		});
	} finally {
		connection.closeSync();
		instance.closeSync();
		await rm(temp, { recursive: true, force: true });
	}
}
