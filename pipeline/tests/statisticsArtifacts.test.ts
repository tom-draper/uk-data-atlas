import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "vitest";
import type { DataCatalog } from "@uk-data-atlas/measures";
import type {
	StatisticsReadPath,
	StatisticsSelector,
} from "@uk-data-atlas/atlas-runtime/storage";
import { statisticsArtifactReader } from "../src/statistics/statisticsArtifacts";

test("requires an exact selector inventory for the catalogue", () => {
	const database = new DatabaseSync(":memory:");
	try {
		const catalog = {
			contentHash: "fixture-hash",
			datasets: [{ id: "dataset" }],
			measures: [{ id: "count", sources: [{ datasetId: "dataset" }] }],
		} as unknown as DataCatalog;
		const selector: StatisticsSelector = {
			datasetId: "dataset",
			measure: "count",
			dimensions: {},
			geography: "ward",
		};
		const readPath: StatisticsReadPath = {
			schemaVersion: 1,
			dataCatalogHash: "fixture-hash",
			statistics: { "count-observations": selector },
			observations: {},
		};
		assert.doesNotThrow(() =>
			statisticsArtifactReader(database, catalog, readPath),
		);
		assert.throws(
			() =>
				statisticsArtifactReader(database, catalog, {
					...readPath,
					dataCatalogHash: "stale",
				}),
			/do not match/,
		);
		assert.throws(
			() =>
				statisticsArtifactReader(database, catalog, {
					...readPath,
					statistics: {},
				}),
			/Missing statistics selector/,
		);
		assert.throws(
			() =>
				statisticsArtifactReader(database, catalog, {
					...readPath,
					statistics: { ...readPath.statistics, extra: selector },
				}),
			/Unexpected statistics selector/,
		);
		assert.throws(
			() =>
				statisticsArtifactReader(database, catalog, {
					...readPath,
					observations: { extra: "missing" },
				}),
			/no statistics read path/,
		);
		assert.throws(
			() =>
				statisticsArtifactReader(
					database,
					{ ...catalog, datasets: [] },
					readPath,
				),
			/no dataset dataset/,
		);
	} finally {
		database.close();
	}
});
