/**
 * Compiles what the map, ranking and place pages read from the committed
 * datasets: the headline figures their search snippets lead with, each map's
 * areas ranked, and the figures about each place's residents. Run after `pnpm precompile` changes a dataset; tests/built/data/seoData
 * fails while either is stale.
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	MAP_FIGURES_PATH,
	readFigureInputs,
	serialiseMapFigures,
} from "./map-figures";
import { PLACE_FACTS_PATH, serialisePlaceFacts } from "./place-facts";
import {
	RANKING_PAGES_PATH,
	RANKINGS_DIR,
	serialiseRankings,
} from "./map-rankings";

await writeFile(
	MAP_FIGURES_PATH,
	serialiseMapFigures(await readFigureInputs()),
);
console.log(`Wrote ${MAP_FIGURES_PATH}`);

const { files, pages } = await serialiseRankings();
await rm(RANKINGS_DIR, { recursive: true, force: true });
await mkdir(RANKINGS_DIR, { recursive: true });
for (const [slug, contents] of files)
	await writeFile(join(RANKINGS_DIR, `${slug}.json`), contents);
await writeFile(RANKING_PAGES_PATH, pages);
console.log(`Wrote ${files.size} rankings to ${RANKINGS_DIR}`);

await writeFile(PLACE_FACTS_PATH, await serialisePlaceFacts());
console.log(`Wrote ${PLACE_FACTS_PATH}`);
