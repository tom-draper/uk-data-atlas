import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";

import { atlasCachePath } from "@uk-data-atlas/atlas-runtime/storage";
import {
	rebuildDatasetPayload,
	servedFromRows,
} from "@uk-data-atlas/atlas-runtime/catalogue";

const digest = (text: string) =>
	createHash("sha256").update(text).digest("hex");

/**
 * Reads the built `data/build/atlas.sqlite` and `atlas-cache.sqlite`. Every
 * dataset served from rows has no stored payload, matches the compiled values,
 * and is in the cache with the same bytes.
 */
it("serves datasets from rows with the compiled values", () => {
	const root = process.cwd();
	const database = new DatabaseSync("data/build/atlas.sqlite", {
		readOnly: true,
	});
	const cache = new DatabaseSync(atlasCachePath(root), { readOnly: true });
	try {
		const datasets = database
			.prepare(
				"SELECT type, output, sha256, bytes, payloadId FROM datasets ORDER BY output",
			)
			.all();
		const fromRows = datasets.filter((row) => row.payloadId === null);
		expect(fromRows.map((row) => row.type)).toEqual(
			datasets
				.filter((row) => servedFromRows(String(row.type)))
				.map((row) => row.type),
		);
		expect(fromRows.length).toBeGreaterThan(0);
		const cached = cache.prepare(
			"SELECT source_sha256, sha256, payload FROM dataset_payloads WHERE output = ?",
		);
		for (const row of fromRows) {
			const output = String(row.output);
			const rebuilt = rebuildDatasetPayload(
				database,
				String(row.type),
				output,
			);
			const compiled = readFileSync(
				`data/build/datasets/${output}.json`,
				"utf8",
			);
			expect(JSON.parse(rebuilt), output).toEqual(JSON.parse(compiled));
			const entry = cached.get(output);
			expect(entry?.source_sha256, output).toBe(row.sha256);
			expect(entry?.sha256, output).toBe(digest(rebuilt));
			expect(entry?.payload === rebuilt, output).toBe(true);
			expect(
				database
					.prepare("SELECT count(*) AS n FROM payloads WHERE id = ?")
					.get(`dataset:${output}`)?.n,
				output,
			).toBe(0);
		}
	} finally {
		cache.close();
		database.close();
	}
}, 600_000);
