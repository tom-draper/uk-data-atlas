import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { ATLAS_LOCATIONS } from "../lib/atlas/pages";
import { decodeCompactPayload } from "../lib/data/compactPayload";
import {
	compileRanking,
	hasRankingPage,
	RANKED_MAPS,
	rankingSource,
} from "../lib/atlas/rankings";
import type { Editions } from "../lib/atlas/rankingRecipes";
import type { AreaProfile } from "../lib/places/profile";

const DATASETS = join(process.cwd(), "public", "data", "datasets");
export const RANKINGS_DIR = join(DATASETS, "rankings");
export const RANKING_PAGES_PATH = join(DATASETS, "ranking-pages.json");

async function readEditions(file: string): Promise<Editions> {
	return decodeCompactPayload(
		JSON.parse(await readFile(join(DATASETS, `${file}.json`), "utf8")),
	) as Editions;
}

/** Each ward's area in km², from the /places profiles. */
async function readWardAreas(): Promise<Record<string, number>> {
	const shards = join(DATASETS, "places", "areas");
	const areas: Record<string, number> = {};
	for (const shard of await readdir(shards)) {
		if (!/^[EW]05/.test(shard)) continue;
		const profiles = JSON.parse(
			await readFile(join(shards, shard), "utf8"),
		) as Record<string, AreaProfile>;
		for (const [code, profile] of Object.entries(profiles))
			if (profile.geography === "ward" && profile.areaKm2)
				areas[code] = profile.areaKm2;
	}
	return areas;
}

/** Inputs that are not compiled datasets, by the name a recipe asks for. */
const SPECIAL_INPUTS: Readonly<Record<string, () => Promise<unknown>>> = {
	"ward-areas": readWardAreas,
	"constituency-lad-overlaps": async () =>
		JSON.parse(
			await readFile(
				join(DATASETS, "constituency-lad-overlaps.json"),
				"utf8",
			),
		),
};

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
	const inputs = new Map<string, Promise<unknown>>();
	const input = (name: string) => {
		let read = inputs.get(name);
		if (!read) {
			read = (SPECIAL_INPUTS[name] ?? (() => readEditions(name)))();
			inputs.set(name, read);
		}
		return read;
	};
	for (const map of RANKED_MAPS) {
		const source = rankingSource(map)!;
		const extra = Object.fromEntries(
			await Promise.all(
				source.inputs.map(
					async (name) => [name, await input(name)] as const,
				),
			),
		);
		const ranking = compileRanking(
			map,
			await readEditions(source.file),
			extra,
		);
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
