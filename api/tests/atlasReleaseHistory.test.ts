import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	archiveCurrentAtlasRelease,
	readArchivedAtlasReleaseArtifact,
	readArchivedAtlasReleases,
} from "../src/atlasReleaseHistory";

const sha256 = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

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
		const content = '{"datasets":[]}\n';
		writeFileSync(join(directory, "data-catalog.json"), content);
		const artifacts = [
			{
				id: "data-catalog",
				path: "data-catalog.json",
				contentHash: sha256(content),
			},
		];
		const write = (release: object) =>
			writeFileSync(
				join(directory, "atlas-release.json"),
				JSON.stringify(release),
			);
		write({ schemaVersion: 1, releaseId: "sha256:fixture", artifacts });
		archiveCurrentAtlasRelease(directory);
		const archived = readArchivedAtlasReleases(directory)[0]!;
		assert.equal(
			readArchivedAtlasReleaseArtifact(
				directory,
				archived,
				"data-catalog",
			)?.body.toString("utf8"),
			content,
		);
		writeFileSync(
			join(directory, "data-catalog.json"),
			'{"datasets":[1]}\n',
		);
		assert.equal(
			readArchivedAtlasReleaseArtifact(
				directory,
				archived,
				"data-catalog",
			)?.body.toString("utf8"),
			content,
		);
		writeFileSync(join(directory, "data-catalog.json"), content);
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
