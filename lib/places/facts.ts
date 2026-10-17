import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
	ageShare,
	ethnicGroups,
	medianAge,
	type Editions,
} from "@/lib/atlas/rankingRecipes";

/**
 * Figures about the people of a place, for its /places page: median age and
 * ethnicity. Compiled from the committed datasets by
 * `pnpm seo:build` into one small file, kept apart from the place profiles so
 * a dataset update does not mean rebuilding them.
 */

export type PlaceFacts = {
	/** Median age, the share aged 65 and over, and the estimate's year. */
	age?: [median: number, over65: number, year: number];
	/** Percentages of residents who were White, and White British, in 2021. */
	ethnicity?: [white: number, whiteBritish: number];
};

export const PLACE_FACTS_FILE = "place-facts.json";

/** The datasets holding residents by single year of age, by geography. */
export const AGE_DATASETS = ["population", "population-uk"] as const;

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Every place's facts, keyed by area code, from the compiled datasets. */
export function compilePlaceFacts(
	ages: readonly Editions[],
	ethnicity: Editions,
): Record<string, PlaceFacts> {
	const facts: Record<string, PlaceFacts> = {};
	for (const editions of ages)
		for (const edition of Object.values(editions)) {
			const year = edition.year ?? 0;
			for (const [code, record] of Object.entries(edition.data)) {
				const known = facts[code]?.age;
				if (known && known[2] >= year) continue;
				const median = medianAge(record.total);
				const over65 = ageShare(record.total, 65);
				if (median === null || over65 === null) continue;
				facts[code] = {
					...facts[code],
					age: [round1(median), round1(over65), year],
				};
			}
		}
	const census = Object.values(ethnicity).at(-1);
	for (const [code, record] of Object.entries(census?.data ?? {})) {
		const groups = ethnicGroups(record);
		if (groups.total <= 0) continue;
		const share = (count: number) => round1((count / groups.total) * 100);
		facts[code] = {
			...facts[code],
			ethnicity: [share(groups.white), share(groups.whiteBritish)],
		};
	}
	return Object.fromEntries(
		Object.entries(facts).sort(([a], [b]) => a.localeCompare(b)),
	);
}

const FACTS_PATH = join(
	process.cwd(),
	"public",
	"data",
	"datasets",
	PLACE_FACTS_FILE,
);

let facts: Promise<Record<string, PlaceFacts>> | undefined;

/** A place's facts, read once per server instance. */
export async function placeFacts(code: string): Promise<PlaceFacts> {
	facts ??= readFile(FACTS_PATH, "utf8").then(JSON.parse);
	return (await facts)[code] ?? {};
}
