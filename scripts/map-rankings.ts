import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ATLAS_LOCATIONS } from "../lib/atlas/pages";
import { decodeCompactPayload } from "../lib/data/compactPayload";
import {
	compileRanking,
	hasRankingPage,
	RANKED_MAPS,
	rankingSource,
} from "../lib/atlas/rankings";

const DATASETS = join(process.cwd(), "public", "data", "datasets");
export const RANKINGS_DIR = join(DATASETS, "rankings");
export const RANKING_PAGES_PATH = join(DATASETS, "ranking-pages.json");

/**
 * Each ranked map's file contents, by map slug, and the index of which
 * places have a ranking page for which map.
 */
export async function serialiseRankings(): Promise<{
	files: Map<string, string>;
	pages: string;
}> {
	const files = new Map<string, string>();
	const pages: Record<string, string[]> = {};
	for (const map of RANKED_MAPS) {
		const { file } = rankingSource(map)!;
		const editions = decodeCompactPayload(
			JSON.parse(await readFile(join(DATASETS, `${file}.json`), "utf8")),
		) as Parameters<typeof compileRanking>[1];
		const ranking = compileRanking(map, editions);
		if (!ranking) continue;
		const places = ATLAS_LOCATIONS.filter((location) =>
			hasRankingPage(ranking, map, location),
		).map((location) => location.slug);
		if (places.length === 0) continue;
		files.set(map.slug, `${JSON.stringify(ranking)}\n`);
		pages[map.slug] = places;
	}
	return { files, pages: `${JSON.stringify(pages, null, "\t")}\n` };
}
