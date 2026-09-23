import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	analysisConversion,
	compileAnalysisGeographies,
	readAnalysisGeographySupport,
} from "../src/analysisGeographies";
import type { CrosswalkInventory } from "../src/crosswalkInventory";
import type { DataCatalog } from "../src/dataCatalog";
import type { RelationshipPathInventory } from "../src/relationshipPaths";

const catalogue = {
	contentHash: "sha256:catalogue",
	measures: [
		{
			id: "fixture",
			aggregation: { kind: "extensive" },
			sources: [
				{
					datasetId: "fixture-dataset",
					periods: ["2025"],
					sourceGeography: { type: "lsoa", boundaryYear: 2021 },
				},
			],
		},
	],
} as unknown as DataCatalog;

const summary = (id: string, from: [string, string], to: [string, string]) => ({
	id,
	from: { geography: from[0], boundaryRelease: from[1] },
	to: { geography: to[0], boundaryRelease: to[1] },
	method: "clean-containment" as const,
	quality: "publisher-supplied" as const,
	weighting: { status: "not-applicable" as const },
	recordCount: 1,
	artifact: `crosswalks/${id}.json`,
	contentHash: `sha256:${id}`,
});

const crosswalks: CrosswalkInventory = {
	schemaVersion: 1,
	contentHash: "sha256:crosswalks",
	crosswalks: [
		summary("lsoa-to-lad", ["lsoa", "2021"], ["localAuthority", "2023"]),
		summary("lad-to-region", ["localAuthority", "2023"], ["region", "2023"]),
	],
};

const paths: RelationshipPathInventory = {
	schemaVersion: 1,
	contentHash: "sha256:paths",
	crosswalkInventoryHash: "sha256:crosswalks",
	paths: [
		{
			id: "lsoa-to-region",
			purpose: "membership",
			from: { geography: "lsoa", boundaryRelease: "2021" },
			to: { geography: "region", boundaryRelease: "2023" },
			quality: "publisher-supplied",
			origin: "declared",
			steps: ["lsoa-to-lad", "lad-to-region"].map((crosswalkId) => ({
				crosswalkId,
				direction: "forward" as const,
				method: "clean-containment" as const,
				purpose: "membership" as const,
			})),
		},
	],
};

const support = (route: { crosswalkId: string } | { pathId: string }, geography = "region") => ({
	measureId: "fixture",
	analysisGeography: { geography, boundaryRelease: "2023" },
	source: { datasetId: "fixture-dataset", geography: "lsoa", boundaryYear: 2021 },
	...route,
	note: "Reviewed.",
});

test("compiles a path-backed support with its reviewed steps", () => {
	const inventory = compileAnalysisGeographies(
		[support({ pathId: "lsoa-to-region" })],
		catalogue,
		crosswalks,
		paths,
	);
	const [compiled] = inventory.supports;

	assert.equal(inventory.relationshipPathInventoryHash, "sha256:paths");
	assert.equal(compiled?.crosswalk, undefined);
	assert.deepEqual(
		compiled?.path?.steps.map(({ crosswalk, direction }) => [crosswalk.id, direction]),
		[
			["lsoa-to-lad", "forward"],
			["lad-to-region", "forward"],
		],
	);
	assert.deepEqual(analysisConversion(compiled!), {
		id: "lsoa-to-region",
		method: "relationship-path",
		quality: "publisher-supplied",
		steps: compiled!.path!.steps,
	});
});

test("leaves the path inventory out of an inventory that uses no path", () => {
	const inventory = compileAnalysisGeographies(
		[support({ crosswalkId: "lsoa-to-lad" }, "localAuthority")],
		catalogue,
		crosswalks,
		paths,
	);

	assert.equal("relationshipPathInventoryHash" in inventory, false);
	assert.deepEqual(analysisConversion(inventory.supports[0]!), {
		id: "lsoa-to-lad",
		method: "clean-containment",
		quality: "publisher-supplied",
	});
});

test("refuses a path that is missing, unbuilt or ends elsewhere", () => {
	assert.throws(
		() =>
			compileAnalysisGeographies(
				[support({ pathId: "lsoa-to-region" })],
				catalogue,
				crosswalks,
			),
		/build the relationship paths/,
	);
	assert.throws(
		() =>
			compileAnalysisGeographies(
				[support({ pathId: "unpublished" })],
				catalogue,
				crosswalks,
				paths,
			),
		/relationship path is not published/,
	);
	assert.throws(
		() =>
			compileAnalysisGeographies(
				[support({ pathId: "lsoa-to-region" }, "localAuthority")],
				catalogue,
				crosswalks,
				paths,
			),
		/does not connect the declared analysis support/,
	);
});

test("requires exactly one of crosswalkId and pathId in the configuration", () => {
	const configured = (entry: Record<string, unknown>) => {
		const path = join(mkdtempSync(join(tmpdir(), "analysis-")), "config.json");
		writeFileSync(path, JSON.stringify({ schemaVersion: 1, supports: [entry] }));
		return () => readAnalysisGeographySupport(path);
	};
	const base = support({ pathId: "lsoa-to-region" });

	assert.deepEqual(configured(base)()[0]?.pathId, "lsoa-to-region");
	assert.throws(
		configured({ ...base, crosswalkId: "lsoa-to-lad" }),
		/exactly one of crosswalkId and pathId/,
	);
	const { pathId: _pathId, ...neither } = base as { pathId: string };
	assert.throws(configured(neither), /exactly one of crosswalkId and pathId/);
});
