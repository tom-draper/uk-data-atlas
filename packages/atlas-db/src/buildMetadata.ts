import { existsSync } from "node:fs";
import { atlasBaseDatabasePath, atlasDatabasePath } from "./dataLayout.ts";
import {
	openReadOnlyDatabase,
	type ReadOnlyDatabase,
} from "./readOnlyDatabase.ts";
import { unpackText } from "./storedPayload.ts";

/**
 * The build metadata of a database lives in a file beside it, never in the
 * database. `atlas.sqlite` is domain tables and views. What the build keeps
 * about its own artifacts (content hashes, artifact paths, byte and record
 * counts, compiler fingerprints, the JSON documents the API loads whole) is
 * in `atlas-build.sqlite`. The pair mirrors the assembly:
 * `atlas-base.sqlite` has `atlas-base-build.sqlite`.
 *
 * Every reader that takes a database path finds its metadata from that path,
 * so a test or a stage that reads another file reads that file's metadata.
 */
const SUFFIX = ".sqlite";
const BUILD_SUFFIX = "-build.sqlite";

/** The build metadata file of a database: `x.sqlite` has `x-build.sqlite`. */
export function buildMetadataPathOf(databasePath: string): string {
	if (!databasePath.endsWith(SUFFIX) || databasePath.endsWith(BUILD_SUFFIX))
		throw new Error(
			`${databasePath} is not a database that has a build metadata file`,
		);
	return `${databasePath.slice(0, -SUFFIX.length)}${BUILD_SUFFIX}`;
}

/** The build metadata of the release database. */
export const atlasBuildMetadataPath = (repositoryRoot: string) =>
	buildMetadataPathOf(atlasDatabasePath(repositoryRoot));

/** The build metadata of the base database, read by stages before assembly. */
export const atlasBaseBuildMetadataPath = (repositoryRoot: string) =>
	buildMetadataPathOf(atlasBaseDatabasePath(repositoryRoot));

/**
 * Lease the build metadata of `databasePath`. Connections are shared and
 * reopen when the file is replaced, as for any other database.
 */
export function openBuildMetadata(
	databasePath: string,
	options: { fresh?: boolean } = {},
): ReadOnlyDatabase {
	const path = buildMetadataPathOf(databasePath);
	if (!existsSync(path))
		throw new Error(
			`Missing build metadata ${path} for ${databasePath}. Run pnpm data:build.`,
		);
	return openReadOnlyDatabase(path, options);
}

/** A payload document of the build, or undefined when it holds none. */
export function readBuildPayload(
	databasePath: string,
	id: string,
): string | undefined {
	const database = openBuildMetadata(databasePath);
	try {
		return unpackText(
			database.prepare("SELECT payload FROM payload WHERE id = ?").get(id)
				?.payload,
		);
	} finally {
		database.release();
	}
}
