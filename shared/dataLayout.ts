import { join, resolve } from "node:path";

/**
 * Where build output and inputs sit on disk. Builders and readers take the
 * repository root or the API root and ask here for a path, so moving an
 * output tree is a change to this file rather than to every stage.
 */

/** The API project directory, which holds `openapi.yaml` and its config. */
export const apiRootOf = (repositoryRoot: string) =>
	join(repositoryRoot, "services", "api");

/** The repository root, given the API project directory. */
export const repositoryRootOf = (apiRoot: string) => resolve(apiRoot, "../..");

/** The directory the build writes its generated artifacts to. */
export const artifactDirectory = (repositoryRoot: string) =>
	join(apiRootOf(repositoryRoot), "public");

/** The generated artifact directory, given the API project directory. */
export const artifactRoot = (apiRoot: string) => join(apiRoot, "public");

/** The shared release the pipeline builds under `data/build`. */
export const buildDirectory = (repositoryRoot: string) =>
	join(repositoryRoot, "data", "build");

/** The release SQLite database, given the API project directory. */
export const atlasDatabasePath = (apiRoot: string) =>
	join(buildDirectory(repositoryRootOf(apiRoot)), "atlas.sqlite");

/** The reviewed configuration the compilers read, kept with the API project. */
export const configDirectory = (repositoryRoot: string) =>
	join(apiRootOf(repositoryRoot), "config");
