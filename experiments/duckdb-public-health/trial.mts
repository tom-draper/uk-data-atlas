import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { DuckDBInstance } from "@duckdb/node-api";
import {
	loadPublicHealth,
	PUBLIC_HEALTH_MEASURES,
} from "../../packages/datasets/src/data/public-health/loader";
import { createTrackedReader } from "../../pipeline/src/precompile/trackedReader.mts";

const columns = [
	"Indicator ID",
	"Age",
	"Sex",
	"Category",
	"Category Type",
	"Area Type",
	"Area Code",
	"Time period Sortable",
	"Time period",
	"Value",
	"Area Name",
];
const quoted = (s: string) => `'${s.replaceAll("'", "''")}'`;

async function duckdb() {
	const instance = await DuckDBInstance.create(":memory:");
	const connection = await instance.connect();
	let returnedRows = 0;
	try {
		const result = await loadPublicHealth(async (path, _options, visit) => {
			const file = join(process.cwd(), "data/source", path);
			const measures = PUBLIC_HEALTH_MEASURES.map(
				({ id, age }) => `(${quoted(id)}, ${quoted(age)})`,
			).join(", ");
			const fields = columns.map((column) => `"${column}"`).join(", ");
			const rows = (
				await connection.runAndReadAll(`
				WITH selected AS (
					SELECT ${fields}, row_number() OVER () AS ordinal
					FROM read_csv(${quoted(file)}, header=true, all_varchar=true, nullstr='')
					WHERE ("Indicator ID", "Age") IN (${measures})
					AND "Sex" = 'Persons' AND coalesce("Category", '') = ''
					AND coalesce("Category Type", '') = ''
					AND "Area Type" = 'Counties & UAs (from Apr 2023)'
					AND regexp_full_match("Area Code", 'E(0[6789]|10)[0-9]{6}')
				)
				SELECT ${fields} FROM selected ORDER BY ordinal
			`)
			).getRows();
			returnedRows += rows.length;
			for (const values of rows) {
				const row = Object.fromEntries(
					columns.map((column, i) => [
						column,
						values[i] == null ? "" : String(values[i]),
					]),
				);
				visit(row);
			}
		});
		return { result, returnedRows };
	} finally {
		connection.closeSync();
		instance.closeSync();
	}
}

const mode = process.argv[2];
if (mode === "node" || mode === "duckdb") {
	const start = performance.now();
	const output =
		mode === "node"
			? {
					result: await loadPublicHealth(
						createTrackedReader().reader.csvRows,
					),
				}
			: await duckdb();
	const elapsedSeconds = (performance.now() - start) / 1000;
	writeFileSync(process.argv[3]!, JSON.stringify(output.result));
	console.log(
		JSON.stringify({
			mode,
			elapsedSeconds,
			peakRssMiB: process.resourceUsage().maxRSS / 1024,
			...("returnedRows" in output
				? { returnedRows: output.returnedRows }
				: {}),
		}),
	);
} else {
	const temp = mkdtempSync(join(tmpdir(), "duckdb-public-health-"));
	try {
		for (let run = 0; run < 3; run++) {
			const measurements: Record<string, unknown> = {};
			for (const variant of run % 2 === 0
				? ["node", "duckdb"]
				: ["duckdb", "node"]) {
				const child = spawnSync(
					process.execPath,
					[
						"--import",
						"tsx",
						process.argv[1]!,
						variant,
						join(temp, `${variant}.json`),
					],
					{ encoding: "utf8" },
				);
				if (child.status !== 0)
					throw new Error(
						`${variant} failed: ${child.stderr || child.error}`,
					);
				measurements[variant] = JSON.parse(child.stdout);
			}
			const node = readFileSync(join(temp, "node.json"), "utf8");
			const duck = readFileSync(join(temp, "duckdb.json"), "utf8");
			assert.deepStrictEqual(JSON.parse(duck), JSON.parse(node));
			assert.equal(duck, node);
			console.log(
				JSON.stringify({
					run: run + 1,
					parity: true,
					areas: Object.keys(JSON.parse(node)["2025"].data).length,
					...measurements,
				}),
			);
		}
	} finally {
		rmSync(temp, { recursive: true, force: true });
	}
}
