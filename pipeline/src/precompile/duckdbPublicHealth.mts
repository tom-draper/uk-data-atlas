import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { join } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import { PUBLIC_HEALTH_MEASURES } from "../../../packages/datasets/src/data/public-health/loader";
import { fileStamp, sameFileStamp } from "./cache.mts";
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
	const instance = await DuckDBInstance.create(":memory:");
	const connection = await instance.connect();
	try {
		return await compile({
			...reader,
			csvRows: async (path, options, visit) => {
				if (options.skipLines)
					throw new Error(
						"Public health CSV must have a header on the first line",
					);
				const file = join(sourceRoot, path);
				const before = await fileStamp(file);
				const hash = createHash("sha256");
				let bytes = 0;
				for await (const chunk of createReadStream(file)) {
					hash.update(chunk as Buffer);
					bytes += (chunk as Buffer).length;
				}
				const measures = PUBLIC_HEALTH_MEASURES.map(
					({ id, age }) => `(${quote(id)}, ${quote(age)})`,
				).join(", ");
				const rows = (
					await connection.runAndReadAll(`
    SELECT * EXCLUDE (ordinal) FROM (
    SELECT *, row_number() OVER () AS ordinal FROM read_csv(${quote(file)}, header=true, all_varchar=true, nullstr='')
    WHERE ("Indicator ID", "Age") IN (${measures})
    AND "Sex" = 'Persons' AND coalesce("Category", '') = ''
    AND coalesce("Category Type", '') = ''
    AND "Area Type" = 'Counties & UAs (from Apr 2023)'
    AND regexp_full_match("Area Code", 'E(0[6789]|10)[0-9]{6}')
    ) ORDER BY ordinal
   `)
				).getRowObjects();
				const after = await fileStamp(file);
				if (!sameFileStamp(before, after) || bytes !== after.bytes)
					throw new Error(`Source changed while reading: ${file}`);
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
					bytes,
					sha256: hash.digest("hex"),
					input: after,
				});
			},
		});
	} finally {
		connection.closeSync();
		instance.closeSync();
	}
}
