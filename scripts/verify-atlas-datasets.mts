import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";

import {
	comparableCompiled,
	generatedFromRows,
	readAtlasPayload,
} from "@uk-data-atlas/catalogue/node";
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
const manifest = JSON.parse(manifestText) as {
	datasets: { type: string; output: string }[];
};
assert.ok(manifest.datasets.length > 0);
for (const { type, output } of manifest.datasets)
	assert.deepEqual(
		JSON.parse(readAtlasPayload(root, `dataset:${output}`)),
		generatedFromRows(type)
			? comparableCompiled(
					type,
					JSON.parse(
						readFileSync(
							join(root, "data/build/datasets", `${output}.json`),
							"utf8",
						),
					),
				)
			: JSON.parse(
					readFileSync(
						join(root, "data/build/datasets", `${output}.json`),
						"utf8",
					),
				),
		output,
	);
const jsonInputs = datasetCatalogInputs(root);
const datasetTypes = new Map(
	manifest.datasets.map(({ type, output }) => [output, type]),
);
class ComparableDatasetInput extends AtlasDatasetInput {
	constructor(
		repositoryRoot: string,
		output: string,
		readonly type: string,
	) {
		super(repositoryRoot, output);
	}
	read() {
		return JSON.stringify(
			comparableCompiled(this.type, JSON.parse(super.read())),
		);
	}
}
const comparable = (value: unknown): unknown => {
	if (!(value instanceof AtlasDatasetInput)) return value;
	const type = datasetTypes.get(value.output);
	return type && generatedFromRows(type)
		? new ComparableDatasetInput(root, value.output, type)
		: value;
};
for (const [key, value] of Object.entries(jsonInputs)) {
	if (key === "declared" && value && typeof value === "object")
		jsonInputs.declared = Object.fromEntries(
			Object.entries(value).map(([id, input]) => [id, comparable(input)]),
		);
	else (jsonInputs as Record<string, unknown>)[key] = comparable(value);
}
// Small-area census tables read raw files in both builds and are outside this migration.
delete jsonInputs.censusSmallAreaRoot;
const fromSqlite = (value: unknown) =>
	value instanceof AtlasDatasetInput
		? new AtlasDatasetInput(root, value.output, "atlas")
		: value;
const sqliteInputs = {
	...Object.fromEntries(
		Object.entries(jsonInputs).map(([key, value]) => [
			key,
			fromSqlite(value),
		]),
	),
	declared: Object.fromEntries(
		Object.entries(jsonInputs.declared ?? {}).map(([id, value]) => [
			id,
			fromSqlite(value),
		]),
	),
} as DataCatalogInputs;
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
	`Matched ${manifest.datasets.length} dataset payloads by value, ${Object.keys(after.artifacts).length} catalogue/observation outputs and ${Object.keys(after.responses).length} API responses byte for byte.`,
);
