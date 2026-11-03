/** Compile map headlines and rankings from the website datasets. */
import {
	buildLog,
	formatCount,
	repoPath,
} from "@uk-data-atlas/atlas-runtime/storage";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
	MAP_FIGURES_PATH,
	readFigureInputs,
	serialiseMapFigures,
} from "./map-figures";
import {
	PLACE_ELECTIONS_PATH,
	serialisePlaceElections,
} from "./place-elections";
import {
	PLACE_POSTCODE_SECTORS_PATH,
	PLACE_POSTCODES_PATH,
	PLACE_NEIGHBOURHOODS_PATH,
	serialisePlacePostcodes,
} from "./place-postcodes.mts";
import {
	RANKING_PAGES_PATH,
	RANKINGS_DIR,
	serialiseRankings,
} from "./map-rankings";

await writeFile(
	MAP_FIGURES_PATH,
	serialiseMapFigures(await readFigureInputs()),
);
buildLog.detail(`Wrote ${repoPath(MAP_FIGURES_PATH)}`);

const { files, pages } = await serialiseRankings();
await rm(RANKINGS_DIR, { recursive: true, force: true });
await mkdir(RANKINGS_DIR, { recursive: true });
for (const [slug, contents] of files)
	await writeFile(join(RANKINGS_DIR, `${slug}.json`), contents);
await writeFile(RANKING_PAGES_PATH, pages);
buildLog.detail(
	`Wrote ${formatCount(files.size)} rankings to ${repoPath(RANKINGS_DIR)}`,
);

await writeFile(PLACE_ELECTIONS_PATH, serialisePlaceElections());
buildLog.detail(`Wrote ${repoPath(PLACE_ELECTIONS_PATH)}`);

const postcodes = serialisePlacePostcodes();
await writeFile(PLACE_POSTCODES_PATH, postcodes.districts);
await writeFile(PLACE_POSTCODE_SECTORS_PATH, postcodes.sectors);
await writeFile(PLACE_NEIGHBOURHOODS_PATH, postcodes.neighbourhoods);
buildLog.detail(
	`Wrote ${repoPath(PLACE_POSTCODES_PATH)} and ${repoPath(PLACE_POSTCODE_SECTORS_PATH)}`,
);
buildLog.info(
	`Wrote SEO data for ${formatCount(files.size)} rankings, map figures, place elections and place postcodes`,
);
