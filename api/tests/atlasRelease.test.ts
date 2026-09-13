import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { createAtlasRelease } from "../src/atlasRelease";

const writeArtifacts = (directory: string, crosswalkContent = "[]") => {
	writeFileSync(join(directory, "boundary-releases.json"), "{}");
	writeFileSync(join(directory, "derived-boundaries.json"), "{}");
	writeFileSync(join(directory, "area-inventory.json"), "{}");
	writeFileSync(join(directory, "named-locations.json"), "{}");
	writeFileSync(join(directory, "data-catalog.json"), "{}");
	writeFileSync(join(directory, "measure-compatibility.json"), "{}");
	writeFileSync(join(directory, "population-observations.json"), "{}");
	writeFileSync(
		join(directory, "population-local-authority-observations.json"),
		"{}",
	);
	writeFileSync(join(directory, "geometry-sources.json"), "{}");
	writeFileSync(
		join(directory, "crosswalk-inventory.json"),
		crosswalkContent,
	);
	writeFileSync(join(directory, "relationship-candidates.json"), "{}");
	writeFileSync(join(directory, "geography-inventory.json"), "{}");
	writeFileSync(join(directory, "validation-report.json"), "{}");
	writeFileSync(join(directory, "source-inventory.json"), "{}");
};

test("references every build-time artifact by content hash", () => {
	const directory = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		writeArtifacts(directory);
		const release = createAtlasRelease(directory);
		assert.equal(release.artifacts.length, 14);
		assert.ok(
			release.artifacts.every((artifact) =>
				/^sha256:[a-f0-9]{64}$/.test(artifact.contentHash),
			),
		);
		assert.match(release.releaseId, /^sha256:[a-f0-9]{64}$/);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("is deterministic for unchanged artifacts and changes when content changes", () => {
	const directory = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		writeArtifacts(directory);
		const first = createAtlasRelease(directory);
		const second = createAtlasRelease(directory);
		assert.deepEqual(first, second);

		writeArtifacts(directory, '[{"id":"changed"}]');
		const third = createAtlasRelease(directory);
		assert.notEqual(first.releaseId, third.releaseId);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("pins every non-legacy observation artifact declared by the catalogue", () => {
	const directory = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		writeArtifacts(directory);
		writeFileSync(
			join(directory, "data-catalog.json"),
			JSON.stringify({
				measures: [
					{
						id: "fixture-measure",
						sources: [
							{
								datasetId: "fixture",
								periods: ["2024"],
								sourceGeography: {
									type: "ward",
									boundaryYear: 2024,
								},
								observationArtifact: "fixture-observations",
							},
						],
					},
				],
			}),
		);
		writeFileSync(join(directory, "fixture-observations.json"), "[]");
		const release = createAtlasRelease(directory);
		assert.deepEqual(
			release.artifacts.find(
				(artifact) =>
					artifact.id === "observations/fixture-observations",
			),
			{
				id: "observations/fixture-observations",
				path: "fixture-observations.json",
				contentHash:
					"sha256:4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
			},
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("fails loudly when a referenced artifact is missing", () => {
	const directory = mkdtempSync(join(tmpdir(), "uk-data-atlas-api-"));
	try {
		assert.throws(() => createAtlasRelease(directory), /boundary-registry/);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
