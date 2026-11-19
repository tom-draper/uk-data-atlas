import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { gunzipSync } from "node:zlib";
import { expect, it } from "vitest";

import { atlasCachePath } from "@uk-data-atlas/atlas-db";
import { directPayloadProblem } from "../../pipeline/src/checks/directPayloadGoldens";
import {
	compiledDatasetTypes,
	rebuildDatasetPayload,
	servedFromRows,
} from "@uk-data-atlas/catalogue/node";

const digest = (text: string) =>
	createHash("sha256").update(text).digest("hex");

/**
 * Reads the built `data/build/atlas.sqlite` and `atlas-cache.sqlite`. Every
 * dataset served from rows has no stored payload, matches its golden hash,
 * and is in the cache with the same bytes.
 */
it("serves datasets from rows with their golden payloads", () => {
	const root = process.cwd();
	const database = new DatabaseSync("data/build/atlas.sqlite", {
		readOnly: true,
	});
	const build = new DatabaseSync("data/build/atlas-build.sqlite", {
		readOnly: true,
	});
	const cache = new DatabaseSync(atlasCachePath(root), { readOnly: true });
	try {
		const typeOf = compiledDatasetTypes(build);
		const datasets = build
			.prepare(
				"SELECT compiled_type AS type, slug AS output, compiled_sha256 AS sha256, compiled_bytes AS bytes, payload_id AS payloadId FROM dataset_build WHERE compiled_type IS NOT NULL ORDER BY slug",
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
			"SELECT source_sha256, sha256, bytes, gzip FROM dataset_payload WHERE output = ?",
		);
		for (const row of fromRows) {
			const output = String(row.output);
			const rebuilt = rebuildDatasetPayload(
				database,
				String(row.type),
				output,
				typeOf,
			);
			expect(
				directPayloadProblem(String(row.type), rebuilt),
			).toBeUndefined();
			const entry = cached.get(output);
			expect(entry?.source_sha256, output).toBe(row.sha256);
			expect(entry?.sha256, output).toBe(digest(rebuilt));
			expect(entry?.bytes, output).toBe(Buffer.byteLength(rebuilt));
			expect(
				gunzipSync(entry?.gzip as Uint8Array).toString("utf8") ===
					rebuilt,
				output,
			).toBe(true);
			expect(
				build
					.prepare("SELECT count(*) AS n FROM payload WHERE id = ?")
					.get(`dataset:${output}`)?.n,
				output,
			).toBe(0);
		}
	} finally {
		cache.close();
		build.close();
		database.close();
	}
}, 600_000);
