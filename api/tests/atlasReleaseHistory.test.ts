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
