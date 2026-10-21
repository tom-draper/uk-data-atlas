/** Compile map headlines and rankings from the website datasets. */
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	MAP_FIGURES_PATH,
	readFigureInputs,
	serialiseMapFigures,
} from "./map-figures";
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
