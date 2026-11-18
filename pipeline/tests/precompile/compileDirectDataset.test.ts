import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, expect, test, vi } from "vitest";
import { landArea, definitionOf, sourceDir } from "@uk-data-atlas/datasets";

const landAreaDatasetDefinition = definitionOf(landArea);

const paths = await vi.hoisted(async () => {
	const { mkdtempSync } = await import("node:fs");
	const { tmpdir } = await import("node:os");
	const { join } = await import("node:path");
	const root = mkdtempSync(join(tmpdir(), "atlas-dataset-missing-"));
	return {
		ROOT: root,
		SOURCE_DATA: join(root, "data/source"),
		COMPILED_DATASETS: join(root, "data/build/datasets"),
		BOUNDARY_DATA: join(root, "data/build/website-boundaries"),
		COMPILED: join(root, "data/build"),
	};
});

vi.mock("../../src/precompile/paths.ts", () => paths);

import { compileDirectDataset } from "../../src/precompile/compileDirectDataset.ts";

afterAll(() => rmSync(paths.ROOT, { recursive: true, force: true }));

test("direct land area records its source without a compiled payload", async () => {
	const source = join(paths.SOURCE_DATA, sourceDir("land-area"));
	mkdirSync(source, { recursive: true });
	mkdirSync(paths.COMPILED_DATASETS, { recursive: true });
	writeFileSync(
		join(source, "sam-lad-2024-12.csv"),
		"ladCode,ladName,landHectares,extentHectares,inlandWaterHectares\nE06000001,Example,100,100,0\n",
	);
	const definition = {
		...landAreaDatasetDefinition,
		ingestion: {
			...landAreaDatasetDefinition.ingestion,
			minimumDataRecords: 1,
		},
	};
	const result = await compileDirectDataset(definition, "fingerprint");
	expect(result.direct).toBe(true);
	expect(result.summary).toMatchObject({ dataRecordCount: 1 });
	expect(result.inputs.map((input) => input.path)).toContain(
		sourceDir("land-area", "sam-lad-2024-12.csv"),
	);
	expect(existsSync(join(paths.COMPILED_DATASETS, "land-area.json"))).toBe(
		false,
	);
});
