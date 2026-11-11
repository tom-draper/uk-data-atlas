import { compileBoundaryAssets } from "../precompile/compileBoundaries.ts";

if (process.argv[1]?.endsWith("compile-boundaries.mts")) {
	await compileBoundaryAssets();
}
