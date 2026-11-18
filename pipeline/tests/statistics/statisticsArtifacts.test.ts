import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "vitest";
import {
	measureSeriesSourceKey,
	type DataCatalog,
	type StatisticsReadPath,
	type StatisticsSelector,
} from "@uk-data-atlas/measures";
import { statisticsArtifactReader } from "../../src/statistics/statisticsArtifacts";

test("requires an exact selector inventory for the catalogue", () => {
	const database = new DatabaseSync(":memory:");
	try {
		const identity = { measure: "count", dimensions: { sex: "female" } };
		const catalog = {
			contentHash: "fixture-hash",
			datasets: [{ id: "dataset" }],
			measures: [
				{
					id: "count",
					series: identity,
					sources: [
						{
							datasetId: "dataset",
							sourceGeography: {
								type: "ward",
								boundaryYear: 2024,
							},
						},
					],
				},
			],
		} as unknown as DataCatalog;
		const selector: StatisticsSelector = {
			datasetId: "dataset",
			measure: "count",
			dimensions: {},
			geography: "ward",
		};
		const source = catalog.measures[0]!.sources[0]!;
		const key = measureSeriesSourceKey(identity, source);
		const readPath: StatisticsReadPath = {
			schemaVersion: 1,
			dataCatalogHash: "fixture-hash",
			series: { [key]: selector },
			observations: {},
		};
		assert.doesNotThrow(() =>
			statisticsArtifactReader(database, catalog, readPath),
		);
		assert.throws(
			() =>
				statisticsArtifactReader(database, catalog, {
					...readPath,
					series: {},
				}),
			/Missing statistics selector/,
		);
		assert.throws(
			() =>
				statisticsArtifactReader(
					database,
					{
						...catalog,
						measures: catalog.measures.map((measure) => ({
							...measure,
							series: undefined,
						})),
					},
					readPath,
				),
			/Missing series identity/,
		);
		assert.throws(
			() =>
				statisticsArtifactReader(database, catalog, {
					...readPath,
					series: { [key]: selector, extra: selector },
				}),
			/Unexpected statistics series selector/,
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
					series: undefined,
					statistics: { "count-observations": selector },
				}),
			/Missing statistics selector/,
		);
		assert.throws(
			() =>
				statisticsArtifactReader(database, catalog, {
					...readPath,
					statistics: { extra: selector },
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
