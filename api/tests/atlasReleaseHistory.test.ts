import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	archiveCurrentAtlasRelease,
	readArchivedAtlasReleases,
} from "../src/atlasReleaseHistory";

test("archives each prior release manifest once", () => {
	const directory = mkdtempSync(join(tmpdir(), "uk-data-atlas-history-"));
	try {
		const release = {
			schemaVersion: 1,
			releaseId: "sha256:fixture",
			artifacts: [],
		};
		writeFileSync(
			join(directory, "atlas-release.json"),
			JSON.stringify(release),
		);
		assert.deepEqual(archiveCurrentAtlasRelease(directory), release);
		assert.deepEqual(archiveCurrentAtlasRelease(directory), release);
		assert.deepEqual(readArchivedAtlasReleases(directory), [release]);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("adds fingerprints to an archived release only when its artifacts match", () => {
	const directory = mkdtempSync(join(tmpdir(), "uk-data-atlas-history-"));
	try {
		const artifacts = [
			{
				id: "data-catalog",
				path: "data-catalog.json",
				contentHash: "sha256:a",
			},
		];
		const write = (release: object) =>
			writeFileSync(
				join(directory, "atlas-release.json"),
				JSON.stringify(release),
			);
		write({ schemaVersion: 1, releaseId: "sha256:fixture", artifacts });
		archiveCurrentAtlasRelease(directory);
		const resources = { datasets: { crime: "sha256:b" } };
		write({
			schemaVersion: 1,
			releaseId: "sha256:fixture",
			artifacts,
			resources,
		});
		archiveCurrentAtlasRelease(directory);
		assert.deepEqual(
			readArchivedAtlasReleases(directory)[0]?.resources,
			resources,
		);

		write({
			schemaVersion: 1,
			releaseId: "sha256:fixture",
			artifacts: [{ ...artifacts[0], contentHash: "sha256:other" }],
		});
		assert.throws(
			() => archiveCurrentAtlasRelease(directory),
			/Conflicting archived atlas release/,
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});
