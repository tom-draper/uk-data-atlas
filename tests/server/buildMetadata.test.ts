import { mkdtempSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	atlasBaseBuildMetadataPath,
	atlasBuildMetadataPath,
	buildMetadataPathOf,
	closeAllReadOnlyDatabases,
	openBuildMetadata,
	readBuildPayload,
} from "@uk-data-atlas/atlas-db";
import {
	payloadTable,
	writeBuildMetadata,
} from "../../pipeline/src/storage/buildMetadataWriter";

let directory: string;

beforeEach(() => {
	directory = mkdtempSync(join(tmpdir(), "build-metadata-"));
});

afterEach(() => {
	closeAllReadOnlyDatabases();
	rmSync(directory, { recursive: true, force: true });
});

describe("build metadata beside a database", () => {
	it("names the file beside each database", () => {
		expect(buildMetadataPathOf("/data/build/atlas.sqlite")).toBe(
			"/data/build/atlas-build.sqlite",
		);
		expect(atlasBuildMetadataPath("/repo")).toBe(
			"/repo/data/build/atlas-build.sqlite",
		);
		expect(atlasBaseBuildMetadataPath("/repo")).toBe(
			"/repo/data/build/atlas-base-build.sqlite",
		);
	});

	it("refuses a path that is not a database or is already metadata", () => {
		expect(() => buildMetadataPathOf("/data/build/atlas.json")).toThrow();
		expect(() =>
			buildMetadataPathOf("/data/build/atlas-build.sqlite"),
		).toThrow();
	});

	it("round-trips payload documents compressed and replaces atomically", () => {
		const database = join(directory, "atlas.sqlite");
		writeBuildMetadata(database, {
			payload: payloadTable([["one", '{"a":1}']]),
		});
		expect(readBuildPayload(database, "one")).toBe('{"a":1}');
		expect(readBuildPayload(database, "missing")).toBeUndefined();
		const replacement = join(directory, "other.sqlite");
		writeBuildMetadata(replacement, {
			payload: payloadTable([["one", '{"a":2}']]),
		});
		renameSync(
			buildMetadataPathOf(replacement),
			buildMetadataPathOf(database),
		);
		expect(readBuildPayload(database, "one")).toBe('{"a":2}');
	});

	it("names the command that builds a missing file", () => {
		expect(() =>
			openBuildMetadata(join(directory, "atlas.sqlite")),
		).toThrow(/Run pnpm data:build/);
	});
});
