import { dirname, join } from "path";
import { fileURLToPath } from "url";

export const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
export const PUBLIC_DATA = join(ROOT, "public", "data");
export const SOURCE_DATA = join(ROOT, "data");
// Browser-ready output is committed exactly where Next serves it from. Raw
// inputs remain in data/, which is restored from the pinned data release.
export const OUT_DIR = join(PUBLIC_DATA, "datasets");
