import { join } from "node:path";

/**
 * Where build output and inputs sit on disk. Builders and readers take the
 * repository root and ask here for a path, so moving an
 * output tree is a change to this file rather than to every stage.
 */

/** The API project directory, which holds `openapi.yaml` and its config. */
export const apiRootOf = (repositoryRoot: string) =>
	join(repositoryRoot, "services", "api");

/** The directory the build writes its generated artifacts to. */
export const artifactDirectory = (repositoryRoot: string) =>
	join(buildDirectory(repositoryRoot), "artifacts");

/** The shared release the pipeline builds under `data/build`. */
export const buildDirectory = (repositoryRoot: string) =>
	join(repositoryRoot, "data", "build");

export const compiledObservationDirectory = (repositoryRoot: string) =>
	join(buildDirectory(repositoryRoot), "compiled-observations");

export const compiledObservationPath = (repositoryRoot: string, name: string) =>
	join(compiledObservationDirectory(repositoryRoot), `${name}.json`);

/** The release SQLite database, given the repository root. */
export const atlasDatabasePath = (repositoryRoot: string) =>
	join(buildDirectory(repositoryRoot), "atlas.sqlite");

/**
 * The database the build writes first, holding areas, crosswalks and named
 * locations once `atlas-sqlite` has run. `assemble-atlas` copies it into
 * `atlas.sqlite`, so stages that run before that read this file.
 */
export const atlasBaseDatabasePath = (repositoryRoot: string) =>
	join(buildDirectory(repositoryRoot), "atlas-base.sqlite");

/**
 * The website's precompressed pages and lookups. Only the Next.js website
 * reads them, so they stay out of `atlas.sqlite`, which is the API's data.
 */
export const websiteAssetsPath = (repositoryRoot: string) =>
	join(buildDirectory(repositoryRoot), "website-assets.sqlite");

/** The reviewed configuration the compilers read, kept with the API project. */
export const configDirectory = (repositoryRoot: string) =>
	join(apiRootOf(repositoryRoot), "config");

/** Generated statistics metadata, given the repository root. */
export const statisticsVocabularyPath = (repositoryRoot: string) =>
	join(buildDirectory(repositoryRoot), "statistics-vocabulary.json");

export const statisticsReadPathPath = (repositoryRoot: string) =>
	join(buildDirectory(repositoryRoot), "statistics-read-path.json");
