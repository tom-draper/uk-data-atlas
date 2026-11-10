import { compileBoundaryAssets } from "../precompile/compileBoundaries.mts";

if (process.argv[1]?.endsWith("compile-boundaries.mts")) {
	await compileBoundaryAssets();
}
