import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { readAtlasPayload } from "@uk-data-atlas/atlas-runtime/storage";
import { datasetCatalogInputs } from "../pipeline/src/build-data-catalog";
import {
	compileDataCatalog,
	type DataCatalogInputs,
} from "../pipeline/src/catalog/compileDataCatalog";
import { AtlasDatasetInput } from "../pipeline/src/catalog/input";
import { route } from "../services/api/src/routes";
import { testContext } from "../services/api/tests/routeFixtures";

const root = resolve(import.meta.dirname, "..");
const manifestText = readFileSync(
	join(root, "data/build/datasets/dataset-manifest.json"),
	"utf8",
);
assert.equal(readAtlasPayload(root, "dataset-manifest"), manifestText);
const manifest = JSON.parse(manifestText) as { datasets: { output: string }[] };
assert.ok(manifest.datasets.length > 0);
for (const { output } of manifest.datasets)
	assert.equal(
		readAtlasPayload(root, `dataset:${output}`),
		readFileSync(
			join(root, "data/build/datasets", `${output}.json`),
			"utf8",
		),
		output,
	);
const sqliteInputs = datasetCatalogInputs(root);
// Small-area census tables read raw files in both builds and are outside this migration.
delete sqliteInputs.censusSmallAreaRoot;
const jsonInputs = Object.fromEntries(
	Object.entries(sqliteInputs).map(([key, value]) => [
		key,
		value instanceof AtlasDatasetInput
			? join(root, "data/build/datasets", `${value.output}.json`)
			: value,
	]),
) as DataCatalogInputs;
const digest = (value: unknown) =>
	createHash("sha256").update(JSON.stringify(value)).digest("hex");
function snapshot(inputs: DataCatalogInputs) {
	const result = compileDataCatalog(inputs);
	const context = testContext({ dataCatalog: result.catalog });
	const urls = [
		"/v1/datasets",
		"/v1/measures",
		...result.catalog.datasets.map(({ id }) => `/v1/datasets/${id}`),
		...result.catalog.measures.map(({ id }) => `/v1/measures/${id}`),
	];
	return {
		artifacts: Object.fromEntries(
			Object.entries(result).map(([key, value]) => [key, digest(value)]),
		),
		responses: Object.fromEntries(
			urls.map((url) => {
				const response = route("GET", url, context);
				assert.equal(response.status, 200, url);
				return [url, digest(response)];
			}),
		),
	};
}
const before = snapshot(jsonInputs);
const after = snapshot(sqliteInputs);
assert.deepEqual(after, before);
console.log(
	`Matched ${manifest.datasets.length} exact payloads, ${Object.keys(after.artifacts).length} catalogue/observation outputs and ${Object.keys(after.responses).length} API responses byte for byte.`,
);
