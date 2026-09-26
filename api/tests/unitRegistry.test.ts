import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { readDataCatalog } from "../src/server";
import {
	normaliseObservation,
	unitDefinitionFor,
	withUnitDefinitions,
} from "../src/unitRegistry";
import type { DataCatalog } from "../src/dataCatalog";

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("serves an exhaustive canonical definition beside every existing display unit", () => {
	const catalog = readDataCatalog(apiRoot);
	assert.ok(catalog.measures.length > 0);
	for (const measure of catalog.measures) {
		assert.ok(
			measure.unitDefinition,
			`${measure.id} has no unit definition`,
		);
		assert.equal(measure.unitDefinition?.scaleToCanonical > 0, true);
		assert.deepEqual(
			measure.unitDefinition,
			unitDefinitionFor(measure.unit),
		);
	}
});

test("normalises scales and denominators without changing source-facing units or values", () => {
	assert.deepEqual(unitDefinitionFor("£ million"), {
		code: "GBP",
		scaleToCanonical: 1_000_000,
	});
	assert.deepEqual(unitDefinitionFor("percent"), {
		code: "proportion",
		scaleToCanonical: 0.01,
	});
	assert.deepEqual(unitDefinitionFor("% of premises"), {
		code: "proportion",
		scaleToCanonical: 0.01,
		per: "premises",
	});
	assert.deepEqual(
		normaliseObservation(
			{
				areaCode: "E06000001",
				value: 7.8,
				status: "observed",
				confidenceInterval: { lower: 7.1, upper: 8.5 },
			},
			unitDefinitionFor("percent"),
		),
		{
			areaCode: "E06000001",
			value: 0.078,
			status: "observed",
			confidenceInterval: { lower: 0.071, upper: 0.085 },
		},
	);
	const catalog = withUnitDefinitions({
		schemaVersion: 1,
		contentHash: "sha256:catalogue",
		source: {
			artifact: "data/datasets/dataset-manifest.json",
			manifestVersion: 1,
		},
		datasets: [],
		measures: [
			{
				id: "example",
				label: "Example",
				valueKind: "currency",
				unit: "£ thousand",
				aggregation: {
					kind: "extensive",
					operation: "sum",
					available: true,
				},
				sources: [],
				availability: {
					sourceExact: true,
					conversion: false,
					aggregation: true,
				},
				links: { data: "/v1/data/example" },
			},
		],
	} satisfies DataCatalog);
	assert.equal(catalog.measures[0]?.unit, "£ thousand");
	assert.deepEqual(catalog.measures[0]?.unitDefinition, {
		code: "GBP",
		scaleToCanonical: 1_000,
	});
});

test("refuses a new display unit until its canonical meaning is reviewed", () => {
	assert.throws(
		() => unitDefinitionFor("mystery units"),
		/No canonical unit definition/,
	);
});
