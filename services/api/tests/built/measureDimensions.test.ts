import { resolve as resolveRepositoryRoot } from "node:path";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "vitest";
import { fileURLToPath } from "node:url";
import { measureDimensionProblems } from "@uk-data-atlas/measures";
import type { DataCatalog } from "@uk-data-atlas/atlas-runtime/catalogue";
import {
	readMeasureDimensionsConfig,
	readStatisticsVocabulary,
} from "@uk-data-atlas/atlas-runtime/measures";
import { artifactDirectory, atlasDatabasePath } from "@uk-data-atlas/atlas-db";

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("the generated vocabulary is what the statistics tables hold", () => {
	const { vocabulary } = readMeasureDimensionsConfig(
		resolve(apiRoot, "../.."),
	);
	assert.deepEqual(
		readStatisticsVocabulary(atlasDatabasePath(resolve(apiRoot, "../.."))),
		vocabulary,
		"Run pnpm data:build --only statistics-vocabulary.",
	);
});

test("the committed vocabulary for the unbuilt mapping check matches the generated vocabulary", () => {
	const { vocabulary } = readMeasureDimensionsConfig(
		resolve(apiRoot, "../.."),
	);
	const held = JSON.parse(
		readFileSync(
			join(apiRoot, "config/statistics-vocabulary.json"),
			"utf8",
		),
	);
	assert.deepEqual(held, vocabulary);
});

test("every built catalogue measure id is mapped to a measure and its members", () => {
	const catalog = JSON.parse(
		readFileSync(
			join(
				artifactDirectory(resolveRepositoryRoot(apiRoot, "../..")),
				"data-catalog.json",
			),
			"utf8",
		),
	) as DataCatalog;
	const { config, vocabulary } = readMeasureDimensionsConfig(
		resolve(apiRoot, "../.."),
	);
	assert.deepEqual(measureDimensionProblems(catalog, config, vocabulary), []);
	assert.equal(Object.keys(config.ids).length, catalog.measures.length);
});
