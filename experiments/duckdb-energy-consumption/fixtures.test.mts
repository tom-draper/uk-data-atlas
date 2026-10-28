import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
	loadElectricityConsumption,
	loadGasConsumption,
} from "../../packages/datasets/src/data/energy-consumption/loader";
import { withDuckdbEnergyConsumption } from "../../pipeline/src/precompile/duckdbDatasetCsv.mts";
import { createTrackedReader } from "../../pipeline/src/precompile/trackedReader.mts";

for (const [name, load] of [
	["electricity", loadElectricityConsumption],
	["gas", loadGasConsumption],
] as const) {
	test(`${name} selection matches the loader and records the original source`, async () => {
		const root = await mkdtemp(join(tmpdir(), "duckdb-energy-"));
		const path = `environment/energy-consumption/${name}-lad-2015-2024.csv`;
		try {
			await mkdir(join(root, "environment/energy-consumption"), {
				recursive: true,
			});
			const csv =
				"ladCode,ladName,year,domesticGwh,nonDomesticGwh,allMetersGwh,metersThousands\nE06000001,One,2024,1,2,3,4\nE06000002,Missing,2024,,2,3,4\nW06000001,Two,2023,0,0,0,0\nE06000001,One,2024,5,6,7,8\n";
			await writeFile(join(root, path), csv);
			const { reader, artifacts } = createTrackedReader();
			const actual = await withDuckdbEnergyConsumption(
				reader,
				artifacts,
				(input) => load(input.text),
				root,
			);
			assert.deepEqual(actual, await load(async () => csv));
			assert.equal(
				artifacts.get(`text:${path}`)?.sha256,
				createHash("sha256").update(csv).digest("hex"),
			);
			await rm(join(root, path));
			await assert.rejects(
				withDuckdbEnergyConsumption(
					reader,
					new Map(),
					(input) => load(input.text),
					root,
				),
				{ code: "ENOENT" },
			);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
}
