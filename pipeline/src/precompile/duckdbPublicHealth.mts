import { join } from "node:path";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { DuckDBInstance } from "@duckdb/node-api";
import { PUBLIC_HEALTH_MEASURES } from "../../../packages/datasets/src/data/public-health/loader";
import { trackDuckdbSource } from "./duckdbSource.mts";
import { SOURCE_DATA } from "./paths.mts";
import type { DatasetReader } from "../../../packages/datasets/src/data/catalog/types";

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;

export async function withDuckdbPublicHealth<T>(
	reader: DatasetReader,
	artifacts: ReturnType<
		typeof import("./trackedReader.mts").createTrackedReader
	>["artifacts"],
	compile: (reader: DatasetReader) => Promise<T>,
	sourceRoot = SOURCE_DATA,
): Promise<T> {
	const measures = PUBLIC_HEALTH_MEASURES.map(
		({ id, age }) => `(${quote(id)}, ${quote(age)})`,
	).join(", ");
	return withDuckdbRows(
		reader,
		artifacts,
		compile,
		sourceRoot,
		`("Indicator ID", "Age") IN (${measures})
    AND "Sex" = 'Persons' AND coalesce("Category", '') = ''
    AND coalesce("Category Type", '') = ''
    AND "Area Type" = 'Counties & UAs (from Apr 2023)'
    AND regexp_full_match("Area Code", 'E(0[6789]|10)[0-9]{6}')`,
	);
}

export async function withDuckdbCensusLsoa<T>(
	reader: DatasetReader,
	artifacts: ReturnType<
		typeof import("./trackedReader.mts").createTrackedReader
	>["artifacts"],
	compile: (reader: DatasetReader) => Promise<T>,
	sourceRoot = SOURCE_DATA,
): Promise<T> {
	return withDuckdbRows(
		reader,
		artifacts,
		compile,
		sourceRoot,
		`regexp_full_match(trim("geography code", ${quote("\t\n\v\f\r \u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff")}), '[EW]01[0-9]{6}')`,
	);
}

export async function withDuckdbPlanningApplications<T>(
	reader: DatasetReader,
	artifacts: ReturnType<
		typeof import("./trackedReader.mts").createTrackedReader
	>["artifacts"],
	compile: (reader: DatasetReader) => Promise<T>,
	sourceRoot = SOURCE_DATA,
): Promise<T> {
	return withDuckdbRows(
		reader,
		artifacts,
		compile,
		sourceRoot,
		`"Quarter" = '2026 Q1'`,
		3,
		true,
	);
}

async function withDuckdbRows<T>(
	reader: DatasetReader,
	artifacts: ReturnType<
		typeof import("./trackedReader.mts").createTrackedReader
	>["artifacts"],
	compile: (reader: DatasetReader) => Promise<T>,
	sourceRoot: string,
	where: string,
	skipLines = 0,
	normalizeUtf8 = false,
): Promise<T> {
	const instance = await DuckDBInstance.create(":memory:");
	const connection = await instance.connect();
	let temp: string | undefined;
	try {
		return await compile({
			...reader,
			csvRows: async (path, options, visit) => {
				if ((options.skipLines ?? 0) !== skipLines)
					throw new Error(
						`Expected ${skipLines} lines before the CSV header`,
					);
				const file = join(sourceRoot, path);
				const finishSource = await trackDuckdbSource(file);
				let csvFile = file;
				if (normalizeUtf8) {
					temp ??= await mkdtemp(join(tmpdir(), "atlas-csv-"));
					csvFile = join(temp, "source.csv");
					await writeFile(csvFile, await readFile(file, "utf8"));
				}
				const rows = (
					await connection.runAndReadAll(`
    SELECT * EXCLUDE (ordinal) FROM (
    SELECT *, row_number() OVER () AS ordinal FROM read_csv(${quote(csvFile)}, header=true, skip=${skipLines}, all_varchar=true, nullstr='')
    WHERE ${where}
    ) ORDER BY ordinal
   `)
				).getRowObjects();
				const trackedSource = await finishSource();
				for (const values of rows) {
					const row = Object.fromEntries(
						Object.entries(values).map(([key, value]) => [
							key,
							value == null ? "" : String(value),
						]),
					);
					visit(row);
				}
				artifacts.set(`csvRows:${path}`, {
					kind: "csvRows",
					path,
					...trackedSource,
				});
			},
		});
	} finally {
		connection.closeSync();
		instance.closeSync();
		if (temp) await rm(temp, { recursive: true, force: true });
	}
}
