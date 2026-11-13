import {
	CORE_COMPATIBILITY_KEY,
	type ModuleBuild,
} from "@uk-data-atlas/datasets/registry";

/** Written beside the module files; `pnpm data:dist` reads it. */
export const BUILD_FILE = "build.json";
/** The DuckDB views file, at the root of the build and of a release. */
export const VIEWS_FILE = "duckdb-views.sql";

export const renderBuildFile = (
	modules: Readonly<Record<string, ModuleBuild>>,
): string =>
	`${JSON.stringify({ schemaVersion: 1, core: CORE_COMPATIBILITY_KEY, modules }, null, "\t")}\n`;
