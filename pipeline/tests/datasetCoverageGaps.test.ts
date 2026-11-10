import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, test } from "vitest";
import { writeSqliteTables } from "@uk-data-atlas/artifacts";
import { datasetCoverageGapTables } from "../src/storage/datasetCoverageGaps.ts";

test("stores election and collision coverage gaps as queryable rows", () => {
	const root = mkdtempSync(join(tmpdir(), "dataset-coverage-"));
	const db = new DatabaseSync(":memory:");
	try {
		mkdirSync(join(root, "datasets"));
		writeFileSync(
			join(root, "datasets", "local-election.json"),
			JSON.stringify({
				2022: {
					excludedWards: [
						{
							wardName: "Ward",
							ladName: "Council",
							wardCode: "E1",
							reason: "ambiguous",
						},
					],
				},
			}),
		);
		writeFileSync(
			join(root, "datasets", "road-collisions.json"),
			JSON.stringify({
				2024: {
					excluded: [{ code: "AIRPORT", collisions: 33 }],
					withoutLsoa: { "GB-SCT": 20 },
				},
			}),
		);
		db.exec(
			"PRAGMA foreign_keys=ON; CREATE TABLE dataset (id INTEGER PRIMARY KEY, slug TEXT UNIQUE); INSERT INTO dataset VALUES (1, 'local-election'), (2, 'road-collisions')",
		);
		writeSqliteTables(
			db,
			datasetCoverageGapTables(root, [
				{ output: "local-election" },
				{ output: "road-collisions" },
			]),
		);
		expect(
			db
				.prepare(
					"SELECT dataset_id, edition, kind, area_code, area_name, parent_name, reason, count FROM dataset_coverage_gap ORDER BY dataset_id, kind",
				)
				.all(),
		).toEqual([
			expect.objectContaining({
				dataset_id: 1,
				edition: "2022",
				kind: "election-ward",
				area_code: "E1",
				area_name: "Ward",
				parent_name: "Council",
				reason: "ambiguous",
				count: null,
			}),
			expect.objectContaining({
				dataset_id: 2,
				edition: "2024",
				kind: "collision-area",
				area_code: "AIRPORT",
				count: 33,
			}),
			expect.objectContaining({
				dataset_id: 2,
				edition: "2024",
				kind: "collision-without-lsoa",
				area_code: "GB-SCT",
				count: 20,
			}),
		]);
		expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
	} finally {
		db.close();
		rmSync(root, { recursive: true, force: true });
	}
});
