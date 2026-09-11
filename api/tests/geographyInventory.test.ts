import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { tmpdir } from "node:os";
import { createBoundaryRegistry } from "../scripts/build-boundary-registry";
import { createGeographyInventory } from "../src/geographyInventory";
import { createSourceInventory } from "../src/sourceInventory";

const repositoryRoot = new URL("../..", import.meta.url).pathname;

test("discovers source metadata and reports boundary compiler coverage", () => {
	const sourceInventory = createSourceInventory(repositoryRoot);
	const boundaryRegistry = createBoundaryRegistry(repositoryRoot);
	const geographyInventory = createGeographyInventory(
		boundaryRegistry,
		sourceInventory,
	);

	assert.ok(
		sourceInventory.sources.length > boundaryRegistry.releases.length,
	);
	assert.ok(
		sourceInventory.sources.some(
			(source) => source.key === "demographics/population/uk",
		),
	);
	assert.equal(
		geographyInventory.releases.length,
		boundaryRegistry.releases.length,
	);
	assert.ok(geographyInventory.geographies.length > 0);
	assert.ok(
		geographyInventory.releases.every(
			(release) => release.areaIdentities.status === "not-compiled",
		),
	);
	assert.match(geographyInventory.contentHash, /^sha256:[a-f0-9]{64}$/);
});

test("reports crosswalk relationship coverage and its gaps", () => {
	const sourceInventory = createSourceInventory(repositoryRoot);
	const boundaryRegistry = createBoundaryRegistry(repositoryRoot);
	const geographyInventory = createGeographyInventory(
		boundaryRegistry,
		sourceInventory,
		undefined,
		{
			schemaVersion: 1,
			contentHash: "sha256:test",
			crosswalks: [
				{
					id: "constituency-2010-to-2024-official-lookup-v2",
					from: { geography: "constituency", boundaryRelease: "2010" },
					to: {
						geography: "constituency",
						boundaryRelease: "2024-07-uk-bgc",
					},
					method: "official-lookup",
					quality: "publisher-supplied",
					weighting: { status: "not-provided" },
					recordCount: 650,
					artifact:
						"crosswalks/constituency-2010-to-2024-official-lookup-v2.json",
					contentHash: "sha256:test",
				},
			],
		},
	);

	const target = geographyInventory.releases.find(
		(release) =>
			release.geography === "constituency" &&
			release.id === "2024-07-uk-bgc",
	);
	assert.deepEqual(target?.relationships, {
		status: "available",
		crosswalks: [
			{
				id: "constituency-2010-to-2024-official-lookup-v2",
				direction: "to",
				counterpart: { geography: "constituency", boundaryRelease: "2010" },
				method: "official-lookup",
				quality: "publisher-supplied",
				weighting: { status: "not-provided" },
			},
		],
	});

	const unrelated = geographyInventory.releases.find(
		(release) => release !== target,
	);
	assert.deepEqual(unrelated?.relationships, {
		status: "not-compiled",
		reason: "No published crosswalk references this boundary release yet.",
	});
});

test("discovers new source metadata without a hard-coded dataset list", () => {
	const temporaryRoot = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	const sourceDirectory = join(
		temporaryRoot,
		"data",
		"environment",
		"rainfall",
	);
	mkdirSync(sourceDirectory, { recursive: true });
	writeFileSync(
		join(sourceDirectory, "meta.json"),
		JSON.stringify({
			id: "rainfall",
			title: "Annual rainfall",
			publisher: "Example publisher",
			files: [{ path: "rainfall.csv", role: "source" }],
		}),
	);

	try {
		const inventory = createSourceInventory(temporaryRoot);
		assert.deepEqual(inventory.sources, [
			{
				key: "environment/rainfall",
				metadataId: "rainfall",
				title: "Annual rainfall",
				publisher: "Example publisher",
				files: [{ extension: ".csv", role: "source" }],
				metadataHash: inventory.sources[0].metadataHash,
			},
		]);
	} finally {
		rmSync(temporaryRoot, { recursive: true, force: true });
	}
});
