import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	CORE_COMPATIBILITY_KEY,
	buildModuleManifests,
} from "@uk-data-atlas/datasets/registry";
import { buildLog } from "@uk-data-atlas/atlas-db";
import { isMainModule } from "../lib/entrypoint.ts";
import { buildModules } from "../modules/buildModules.ts";
import {
	BUILD_FILE,
	VIEWS_FILE,
	renderBuildFile,
} from "../modules/buildFile.ts";
import { exportParquet } from "../modules/parquet.ts";
import { listParquet, renderDuckdbViews } from "../modules/duckdbViews.ts";

/**
 * Splits `data/build/atlas.sqlite` into core and per-module SQLite files with
 * Parquet beside them (roadmap tasks 19 to 23). `atlas.sqlite` is not changed.
 * The output tree has the layout of a release (`sqlite/`, `<module>/parquet/`)
 * and `build.json`, which `pnpm data:dist` reads to fill the manifests.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

if (isMainModule(import.meta.url)) {
	const outDir = join(root, "data/build/modules");
	rmSync(outDir, { recursive: true, force: true });
	mkdirSync(outDir, { recursive: true });
	// Licences do not enter the databases, so the manifests here carry none.
	const manifests = buildModuleManifests({ datasets: () => [] });
	const builds = await buildModules({
		atlasPath: join(root, "data/build/atlas.sqlite"),
		outDir,
		manifests,
		exportParquet,
	});
	writeFileSync(join(outDir, BUILD_FILE), renderBuildFile(builds));
	writeFileSync(
		join(outDir, VIEWS_FILE),
		renderDuckdbViews(listParquet(outDir)),
	);
	for (const [id, build] of Object.entries(builds))
		buildLog.info(
			`${id}: ${build.status === "built" ? `${build.bytes} bytes, ${build.files.length} files` : build.status}`,
		);
	buildLog.info(`Built modules for ${CORE_COMPATIBILITY_KEY} in ${outDir}`);
}
