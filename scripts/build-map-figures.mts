/**
 * Compiles the headline figures map pages lead their search snippets with,
 * from the committed datasets. Run after `pnpm precompile` changes any of
 * them; tests/data/mapFigures.test.ts fails while the file is stale.
 */
import { writeFile } from "node:fs/promises";
import {
	MAP_FIGURES_PATH,
	readFigureInputs,
	serialiseMapFigures,
} from "./map-figures";

await writeFile(
	MAP_FIGURES_PATH,
	serialiseMapFigures(await readFigureInputs()),
);
console.log(`Wrote ${MAP_FIGURES_PATH}`);
