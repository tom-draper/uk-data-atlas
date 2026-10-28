import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
	loadElectricityConsumption,
	loadGasConsumption,
} from "../../packages/datasets/src/data/energy-consumption/loader";
import { withDuckdbEnergyConsumption } from "../../pipeline/src/precompile/duckdbDatasetCsv.mts";
import { createTrackedReader } from "../../pipeline/src/precompile/trackedReader.mts";

const root = join(process.cwd(), "data/source");
for (const [name, load] of [
	["electricity", loadElectricityConsumption],
	["gas", loadGasConsumption],
] as const) {
	const path = `environment/energy-consumption/${name}-lad-2015-2024.csv`;
	const original = await readFile(join(root, path), "utf8");
	const { reader, artifacts } = createTrackedReader();
	const actual = await withDuckdbEnergyConsumption(
		reader,
		artifacts,
		(input) => load(input.text),
		root,
	);
	assert.deepEqual(actual, await load(async () => original), name);
	assert.equal(
		artifacts.get(`text:${path}`)?.sha256,
		createHash("sha256").update(original).digest("hex"),
	);
	console.log(`Matched ${name}: ${Object.keys(actual).length} years`);
}
