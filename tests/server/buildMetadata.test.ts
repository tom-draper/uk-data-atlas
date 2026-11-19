import { mkdtempSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
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
		new DatabaseSync(database).close();
		new DatabaseSync(join(directory, "other.sqlite")).close();
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
		const database = join(directory, "atlas.sqlite");
		expect(() => openBuildMetadata(database)).toThrow(
			/unable to open database file .*Run pnpm data:build/,
		);
		new DatabaseSync(database).close();
		expect(() => openBuildMetadata(database)).toThrow(
			/Missing build metadata .*Run pnpm data:build/,
		);
	});

	it("is no use without its database", () => {
		const database = join(directory, "atlas.sqlite");
		writeBuildMetadata(database, {
			payload: payloadTable([["one", "{}"]]),
		});
		expect(() => readBuildPayload(database, "one")).toThrow(
			/unable to open database file/,
		);
	});
});
