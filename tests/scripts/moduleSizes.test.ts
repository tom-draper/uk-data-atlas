import { describe, expect, it } from "vitest";
import type { ModuleBuild } from "@uk-data-atlas/datasets/registry";
import { buildModuleManifests } from "@uk-data-atlas/datasets/registry";
import {
	beforeSplits,
	moduleSizes,
	renderSizes,
} from "../../scripts/module-sizes-table.mjs";

const built = (
	bytes: number,
	parquet: number,
	rows: Record<string, number>,
): ModuleBuild => ({
	status: "built",
	bytes,
	files: [
		{ path: "a.sqlite", format: "sqlite", bytes, sha256: "a".repeat(64) },
		{
			path: "a.parquet",
			format: "parquet",
			bytes: parquet,
			sha256: "b".repeat(64),
		},
	],
	rows,
});

const builds: Record<string, ModuleBuild> = {
	population: built(1000, 100, { observation: 5, payloads: 9 }),
	"population-detail": built(9000, 900, { observation: 50, series: 2 }),
	politics: built(4000, 400, { observation: 30 }),
	"politics-sharealike": built(1000, 100, { observation: 10 }),
	transport: { status: "not-built", bytes: null, files: null },
};
const manifests = buildModuleManifests({ datasets: () => [] });

describe("module sizes", () => {
	const sizes = moduleSizes(builds, manifests);

	it("skips modules that are not built and ignores payload rows", () => {
		expect(sizes.map(({ id }) => id)).not.toContain("transport");
		const population = sizes.find(({ id }) => id === "population")!;
		expect(population.rows).toBe(5);
		expect(population.parquetBytes).toBe(100);
	});

	it("adds each split back into the module it came from", () => {
		const before = beforeSplits(sizes);
		expect(before.map(({ id }) => id).sort()).toEqual([
			"politics",
			"population",
		]);
		const population = before.find(({ id }) => id === "population")!;
		expect(population.observations).toBe(55);
		expect(population.sqliteBytes).toBe(10000);
		const datasets = (id: string) =>
			manifests.find((manifest) => manifest.id === id)!.datasets.length;
		expect(population.datasets).toBe(
			datasets("population") + datasets("population-detail"),
		);
		const politics = before.find(({ id }) => id === "politics")!;
		expect(politics.datasets).toBe(datasets("politics"));
		expect(politics.observations).toBe(40);
	});

	it("renders a table with the largest module first and no em dashes", () => {
		const text = renderSizes(sizes);
		expect(text.split("\n")[2]).toContain("population-detail");
		expect(text.includes("—")).toBe(false);
	});
});
