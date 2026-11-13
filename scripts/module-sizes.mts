import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	buildModuleManifests,
	type ModuleBuild,
} from "@uk-data-atlas/datasets/registry";
import { BUILD_FILE } from "../pipeline/src/modules/buildFile.ts";
import {
	beforeSplits,
	moduleSizes,
	renderSizes,
} from "./module-sizes-table.mts";

/**
 * Prints rows and bytes per module from a module build.
 *
 *   pnpm data:sizes [--build <dir>] [--before-splits]
 *
 * `--build` defaults to `data/build/modules` (run `pnpm data:build` first).
 * `--before-splits` adds each split module back into the module it came from.
 */
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const flag = (name: string) => args.indexOf(name);
const buildAt = flag("--build");
const dir = resolve(
	buildAt >= 0 ? (args[buildAt + 1] ?? "") : join(ROOT, "data/build/modules"),
);
const file = join(dir, BUILD_FILE);
if (!existsSync(file)) {
	console.error(`No ${BUILD_FILE} in ${dir}. Run pnpm data:build first.`);
	process.exit(1);
}
const { modules } = JSON.parse(readFileSync(file, "utf8")) as {
	modules: Record<string, ModuleBuild>;
};
const sizes = moduleSizes(
	modules,
	buildModuleManifests({ datasets: () => [] }),
);
process.stdout.write(
	renderSizes(flag("--before-splits") >= 0 ? beforeSplits(sizes) : sizes),
);
