import { compileBoundaryTiles } from "../precompile/compileBoundaryTiles.ts";

if (process.argv[1]?.endsWith("compile-boundary-tiles.ts"))
	await compileBoundaryTiles();
