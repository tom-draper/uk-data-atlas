import { compileBoundaryTiles } from "../precompile/compileBoundaryTiles.ts";
import { runTrialable } from "../lib/trialRun.ts";

if (process.argv[1]?.endsWith("compile-boundary-tiles.ts"))
	await runTrialable(compileBoundaryTiles);
