import { join } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import { PUBLIC_HEALTH_MEASURES } from "../../../packages/datasets/src/data/public-health/loader.ts";
import { trackDuckdbSource } from "./duckdbSource.ts";
import { SOURCE_DATA } from "./paths.ts";
import type { DatasetReader } from "../../../packages/datasets/src/data/catalog/types.ts";

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;

export async function withDuckdbPublicHealth<T>(
	reader: DatasetReader,
	artifacts: ReturnType<
		typeof import("./trackedReader.ts").createTrackedReader
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

async function withDuckdbRows<T>(
	reader: DatasetReader,
	artifacts: ReturnType<
		typeof import("./trackedReader.ts").createTrackedReader
	>["artifacts"],
	compile: (reader: DatasetReader) => Promise<T>,
	sourceRoot: string,
	where: string,
): Promise<T> {
	const instance = await DuckDBInstance.create(":memory:");
	const connection = await instance.connect();
	try {
		return await compile({
			...reader,
			csvRows: async (path, options, visit) => {
				if ((options.skipLines ?? 0) !== 0)
					throw new Error("Expected no lines before the CSV header");
				const file = join(sourceRoot, path);
				const finishSource = await trackDuckdbSource(file);
				const rows = (
					await connection.runAndReadAll(`
    SELECT * EXCLUDE (ordinal) FROM (
    SELECT *, row_number() OVER () AS ordinal FROM read_csv(${quote(file)}, header=true, skip=0, all_varchar=true, nullstr='')
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
	}
}
