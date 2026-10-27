import { join } from "path";
import {
	outputMatches as outputMatchesIn,
	loadReuseContext as loadReuseContextIn,
} from "../../pipeline/src/precompile/cache.mts";
import { out as outIn } from "../../pipeline/src/precompile/output.mts";
import { ROOT } from "../../pipeline/src/precompile/paths.mts";
import type { CompiledOutput } from "../../pipeline/src/precompile/types.mts";

// Browser-ready output is built where Next serves it from.
export const PUBLIC_DATA = join(ROOT, "public", "data");
export const OUT_DIR = join(PUBLIC_DATA, "datasets");

/** Writes `name`.json into the browser data folder and describes the result. */
export const out = (name: string, data: unknown) => outIn(name, data, OUT_DIR);

export const outputMatches = (name: string, expected: CompiledOutput) =>
	outputMatchesIn(name, expected, OUT_DIR);

/** The reuse context from the manifest an earlier website run left. */
export const loadReuseContext = () => loadReuseContextIn(OUT_DIR);
