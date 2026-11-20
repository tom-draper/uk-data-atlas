import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";

import { readAtlasPayload } from "@uk-data-atlas/catalogue/node";
import { directPayloadProblem } from "../pipeline/src/checks/directPayloadGoldens";
import { datasetCatalogInputs } from "../pipeline/src/catalog/buildDataCatalog";
import { compileDataCatalog } from "../pipeline/src/catalog/compileDataCatalog";
import { route } from "../services/api/src/routes";
import { testContext } from "../services/api/tests/routeFixtures";

const root = resolve(import.meta.dirname, "..");
const manifestText = readFileSync(
	join(root, "data/build/datasets/dataset-manifest.json"),
	"utf8",
);
assert.equal(readAtlasPayload(root, "dataset-manifest"), manifestText);
const manifest = JSON.parse(manifestText) as {
	datasets: { type: string; output: string; direct?: true }[];
};
assert.ok(manifest.datasets.length > 0);
for (const { type, output, direct } of manifest.datasets) {
	assert.ok(direct, `${type} is not read straight from its sources`);
	// The payload generated from the rows must be the golden.
	assert.equal(
		directPayloadProblem(type, readAtlasPayload(root, `dataset:${output}`)),
		undefined,
		output,
	);
}
const inputs = datasetCatalogInputs(root);
const result = compileDataCatalog(inputs);
inputs.rows.close();
const context = testContext({ dataCatalog: result.catalog });
const urls = [
	"/v1/datasets",
	"/v1/measures",
	...result.catalog.datasets.map(({ id }) => `/v1/datasets/${id}`),
	...result.catalog.measures.map(({ id }) => `/v1/measures/${id}`),
];
for (const url of urls)
	assert.equal(route("GET", url, context).status, 200, url);
console.log(
	`Matched ${manifest.datasets.length} dataset payloads by value and served ${urls.length} catalogue responses from the statistics rows.`,
);
