import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { compileCrosswalks } from "../src/crosswalkInventory";

test("compiles a published lookup without inventing apportionment weights", () => {
	const root = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	const input = "boundaries/constituency/2024/lookup.geojson";
	const path = join(root, "data", input);
	mkdirSync(join(path, ".."), { recursive: true });
	writeFileSync(
		path,
		JSON.stringify({
			type: "FeatureCollection",
			features: [
				{
					properties: {
						OLDCD: "E14000001",
						OLDNM: "Old seat",
						NEWCD: "E14001001",
						NEWNM: "New seat A",
					},
				},
				{
					properties: {
						OLDCD: "E14000001",
						OLDNM: "Old seat",
						NEWCD: "E14001002",
						NEWNM: "New seat B",
					},
				},
			],
		}),
	);

	try {
		const { artifacts, inventory } = compileCrosswalks(root, [
			{
				id: "constituency-2010-to-2024",
				input,
				from: {
					geography: "constituency",
					boundaryRelease: "2010",
					codeProperty: "OLDCD",
					nameProperty: "OLDNM",
				},
				to: {
					geography: "constituency",
					boundaryRelease: "2024",
					codeProperty: "NEWCD",
					nameProperty: "NEWNM",
				},
			},
		]);
		assert.deepEqual(artifacts[0].weighting, { status: "not-provided" });
		assert.deepEqual(artifacts[0].records, [
			{
				source: { code: "E14000001", labels: ["Old seat"] },
				targets: [
					{ code: "E14001001", labels: ["New seat A"] },
					{ code: "E14001002", labels: ["New seat B"] },
				],
			},
		]);
		assert.deepEqual(artifacts[0].validation.sourceNameConflicts, []);
		assert.equal(inventory.crosswalks[0].recordCount, 1);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
