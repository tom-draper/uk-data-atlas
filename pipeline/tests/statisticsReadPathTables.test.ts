import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { closeAllReadOnlyDatabases } from "@uk-data-atlas/atlas-db";
import {
	readAtlasStatisticsReadPath,
	type StatisticsReadPath,
} from "@uk-data-atlas/measures";
import { statisticsReadPathTables } from "../src/storage/statisticsReadPathTables.ts";
import { writeSqliteIndex } from "../src/storage/sqliteIndexWriter.ts";

test("round trips each selector kind and optional transformation", () => {
	const root = mkdtempSync(join(tmpdir(), "selectors-"));
	const path = join(root, "atlas.sqlite");
	const plan: StatisticsReadPath = {
		schemaVersion: 1,
		dataCatalogHash: "hash",
		observations: { missing: "reason" },
		statistics: {
			series: {
				datasetId: "d",
				geography: "ward",
				measure: "population",
				dimensions: { age: "total" },
				sum: ["sex"],
				areasIn: ["2021", "2022"],
				plus: ["x"],
				absentAsZero: true,
				status: "derived",
				contest: "winner",
				servedCodes: { A: { areaCode: "B", sourceAreaCode: "C" } },
				ratio: {
					measure: "area",
					dimensions: { unit: "ha" },
					scale: 100,
					scaleQuotient: true,
					datasetId: "land",
					period: "2021",
					denominatorDivisor: 100,
				},
				halfWidth: { measure: "error", digits: 2 },
			},
			empty: {
				datasetId: "d",
				geography: "ward",
				measure: "m",
				dimensions: {},
				sum: [],
				areasIn: [],
				plus: [],
				servedCodes: {},
				ratio: { measure: "n", scale: 1, dimensions: {} },
			},
			table: {
				kind: "measure-table",
				id: "census",
				datasetId: "d",
				geography: "lsoa",
				boundaryYear: 2021,
				period: "2021",
				measures: ["one", "two"],
				columns: [
					{ measure: "residents", dimensions: { age: "old" } },
					{ measure: "households", dimensions: {} },
				],
			},
		},
	};
	try {
		writeSqliteIndex(path, {}, statisticsReadPathTables(plan));
		expect(readAtlasStatisticsReadPath(path)).toEqual(plan);
	} finally {
		closeAllReadOnlyDatabases();
		rmSync(root, { recursive: true, force: true });
	}
});
