import { compileBoundaryTiles } from "../precompile/compileBoundaryTiles.mts";

if (process.argv[1]?.endsWith("compile-boundary-tiles.mts"))
	await compileBoundaryTiles();
