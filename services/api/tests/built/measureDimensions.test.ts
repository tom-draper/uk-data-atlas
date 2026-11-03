import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { measureDimensionProblems } from "@uk-data-atlas/measures";
import type { DataCatalog } from "@uk-data-atlas/atlas-runtime/catalogue";
import { readMeasureDimensionsConfig } from "@uk-data-atlas/atlas-runtime/catalogue";
import {
	artifactRoot,
	atlasDatabasePath,
	readStatisticsVocabulary,
} from "@uk-data-atlas/atlas-runtime/storage";

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("the generated vocabulary is what the statistics tables hold", () => {
	const { vocabulary } = readMeasureDimensionsConfig(apiRoot);
	assert.deepEqual(
		readStatisticsVocabulary(atlasDatabasePath(apiRoot)),
		vocabulary,
		"Run pnpm data:build --only statistics-vocabulary.",
	);
});

test("the committed vocabulary for the unbuilt mapping check matches the generated vocabulary", () => {
	const { vocabulary } = readMeasureDimensionsConfig(apiRoot);
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
		readFileSync(join(artifactRoot(apiRoot), "data-catalog.json"), "utf8"),
	) as DataCatalog;
	const { config, vocabulary } = readMeasureDimensionsConfig(apiRoot);
	assert.deepEqual(measureDimensionProblems(catalog, config, vocabulary), []);
	assert.equal(Object.keys(config.ids).length, catalog.measures.length);
});
