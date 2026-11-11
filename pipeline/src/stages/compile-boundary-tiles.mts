import { compileBoundaryTiles } from "../precompile/compileBoundaryTiles.ts";

if (process.argv[1]?.endsWith("compile-boundary-tiles.mts"))
	await compileBoundaryTiles();
