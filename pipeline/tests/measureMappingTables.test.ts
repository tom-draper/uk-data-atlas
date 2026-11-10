import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { writeSqliteIndex } from "../src/storage/sqliteIndexWriter.ts";
import { measureMappingTables } from "../src/storage/measureMappingTables.ts";
import {
	readAtlasMeasureMapping,
	type MeasureDimensionsConfig,
} from "@uk-data-atlas/measures";
import { closeAllReadOnlyDatabases } from "@uk-data-atlas/atlas-db";

test("round trips catalogue mappings and additional vocabulary", () => {
	const root = mkdtempSync(join(tmpdir(), "mapping-"));
	const path = join(root, "atlas.sqlite");
	const config: MeasureDimensionsConfig = {
		schemaVersion: 1,
		measures: {
			computed: {
				label: "Computed",
				description: "Derived",
				reason: "No series",
			},
		},
		dimensions: {
			extra: {
				label: "Extra",
				reason: "Not stored",
				members: [{ code: "a", label: "A" }],
			},
		},
		members: { age: [{ code: "x", label: "X", parent: "total" }] },
		defaults: { population: { age: "total" } },
		ids: {
			people: {
				measure: "population",
				datasetId: "census",
				dimensions: { age: "x" },
			},
			total: { measure: "population" },
		},
	};
	try {
		writeSqliteIndex(path, {}, measureMappingTables(config));
		expect(readAtlasMeasureMapping(path)).toEqual(config);
	} finally {
		closeAllReadOnlyDatabases();
		rmSync(root, { recursive: true, force: true });
	}
});
