import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { decodeCompactPayload } from "../lib/data/compactPayload";
import type { Editions } from "../lib/atlas/rankingRecipes";
import {
	AGE_DATASETS,
	compilePlaceFacts,
	PLACE_FACTS_FILE,
} from "../lib/places/facts";

const DATASETS = join(process.cwd(), "public", "data", "datasets");
export const PLACE_FACTS_PATH = join(DATASETS, PLACE_FACTS_FILE);

const readEditions = async (file: string) =>
	decodeCompactPayload(
		JSON.parse(await readFile(join(DATASETS, `${file}.json`), "utf8")),
	) as Editions;

/** The place facts file's contents, from the committed datasets. */
export async function serialisePlaceFacts(): Promise<string> {
	const facts = compilePlaceFacts(
		await Promise.all(AGE_DATASETS.map(readEditions)),
		await readEditions("ethnicity"),
	);
	return `${JSON.stringify(facts)}\n`;
}
