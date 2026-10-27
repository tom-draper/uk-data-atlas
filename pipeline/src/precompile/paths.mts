import { dirname, join } from "path";
import { fileURLToPath } from "url";

export const ROOT = dirname(
	dirname(dirname(dirname(fileURLToPath(import.meta.url)))),
);
export const PUBLIC_DATA = join(ROOT, "public", "data");
export const SOURCE_DATA = join(ROOT, "data/source");
// Browser-ready output is built where Next serves it from. Raw
// inputs remain in data/source/, which is restored from the pinned data release.
export const OUT_DIR = join(PUBLIC_DATA, "datasets");
// Compiled output the website and the API share. See data/build/README.md.
export const COMPILED = join(ROOT, "data/build");
export const COMPILED_DATASETS = join(COMPILED, "datasets");

// Private geometry intermediates. Only properties and map resources are published.
export const BOUNDARY_DATA = join(COMPILED, "website-boundaries");
