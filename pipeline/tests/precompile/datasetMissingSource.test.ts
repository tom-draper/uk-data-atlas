import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, expect, test, vi } from "vitest";
import { landAreaDatasetDefinition } from "@uk-data-atlas/datasets";

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

import { compileStaleDataset } from "../../src/precompile/compileDataset.ts";
import { canReuseDataset } from "../../src/precompile/cache.ts";

afterAll(() => rmSync(paths.ROOT, { recursive: true, force: true }));

test("preserved datasets record missing inputs and rebuild when they return", async () => {
	const source = join(paths.SOURCE_DATA, "geography/land-area");
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
	const original = await compileStaleDataset(
		definition,
		new Map(),
		undefined,
		"fingerprint",
	);
	const legacy = { ...original, inputTrackingVersion: undefined };
	expect(
		await canReuseDataset(legacy, definition, undefined, "fingerprint"),
	).toBeUndefined();
	const missing = join(source, "additional.csv");
	const updated = {
		...definition,
		precompile: async (
			reader: Parameters<typeof definition.precompile>[0],
		) => {
			await reader.text("geography/land-area/additional.csv");
			return definition.precompile(reader);
		},
	};
	const preserved = await compileStaleDataset(
		updated,
		new Map(),
		legacy,
		"fingerprint",
	);
	expect(preserved.missingSource).toBe("geography/land-area/additional.csv");
	expect(preserved.inputTrackingVersion).toBe(1);
	expect(
		await canReuseDataset(preserved, updated, undefined, "fingerprint"),
	).toBeDefined();
	writeFileSync(missing, "restored");
	expect(
		await canReuseDataset(preserved, updated, undefined, "fingerprint"),
	).toBeUndefined();
	const rebuilt = await compileStaleDataset(
		updated,
		new Map(),
		preserved,
		"fingerprint",
	);
	expect(rebuilt.missingSource).toBeUndefined();
	expect(rebuilt.inputTrackingVersion).toBe(1);
	expect(rebuilt.inputs.map((input) => input.path)).toContain(
		"geography/land-area/additional.csv",
	);
	expect(
		await canReuseDataset(rebuilt, updated, undefined, "fingerprint"),
	).toBeDefined();
});
