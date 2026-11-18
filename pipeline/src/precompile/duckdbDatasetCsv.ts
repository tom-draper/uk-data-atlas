import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DuckDBInstance } from "@duckdb/node-api";
import type { DatasetReader } from "../../../packages/datasets/src/data/catalog/types.ts";
import { trackDuckdbSource } from "./duckdbSource.ts";
import { SOURCE_DATA } from "./paths.ts";

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;

export async function withDuckdbLocalElection<T>(
	reader: DatasetReader,
	artifacts: ReturnType<
		typeof import("./trackedReader.ts").createTrackedReader
	>["artifacts"],
	compile: (reader: DatasetReader) => Promise<T>,
	sourceRoot = SOURCE_DATA,
): Promise<T> {
	return withDuckdbFilteredCsv(
		reader,
		artifacts,
		"* EXCLUDE (ordinal)",
		"starts_with(column3, 'E') OR starts_with(column3, 'W')",
		compile,
		sourceRoot,
		{ header: false, matches: (path) => /\/leap-[^/]+\.csv$/.test(path) },
	);
}

export async function withDuckdbFilteredCsv<T>(
	reader: DatasetReader,
	artifacts: ReturnType<
		typeof import("./trackedReader.ts").createTrackedReader
	>["artifacts"],
	fields: string,
	where: string,
	compile: (reader: DatasetReader) => Promise<T>,
	sourceRoot = SOURCE_DATA,
	options: { header: boolean; matches: (path: string) => boolean } = {
		header: true,
		matches: () => true,
	},
): Promise<T> {
	const instance = await DuckDBInstance.create(":memory:");
	const connection = await instance.connect();
	const temp = await mkdtemp(join(tmpdir(), "atlas-dataset-csv-"));
	try {
		return await compile({
			...reader,
			text: async (path) => {
				if (!options.matches(path)) return reader.text(path);
				const source = join(sourceRoot, path);
				const finishSource = await trackDuckdbSource(source);
				const output = join(temp, "selected.csv");
				await connection.run(`COPY (
    SELECT ${fields} FROM (
     SELECT *, row_number() OVER () AS ordinal FROM read_csv(${quote(source)}, header=${options.header}, all_varchar=true, nullstr='')
     WHERE ${where}
    ) ORDER BY ordinal
   ) TO ${quote(output)} (HEADER ${options.header}, FORMAT CSV)`);
				const trackedSource = await finishSource();
				const selected = await readFile(output, "utf8");
				artifacts.set(`text:${path}`, {
					kind: "text",
					path,
					...trackedSource,
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
