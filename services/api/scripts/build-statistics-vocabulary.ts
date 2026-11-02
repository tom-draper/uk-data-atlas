import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	atlasDatabasePath,
	readStatisticsVocabulary,
} from "@uk-data-atlas/atlas-runtime/storage";

/**
 * Write the measures and dimensions the statistics tables hold to
 * `config/statistics-vocabulary.json`, which the measure dimension mapping is
 * checked against. Run after a data build changes them; the built tests fail
 * while the file and the tables disagree.
 */
const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vocabulary = readStatisticsVocabulary(atlasDatabasePath(apiRoot));
const file = join(apiRoot, "config", "statistics-vocabulary.json");
writeFileSync(file, `${JSON.stringify(vocabulary, null, "\t")}\n`);
console.log(
	`Wrote ${Object.keys(vocabulary.measures).length} measures and ${Object.keys(vocabulary.dimensions).length} dimensions to ${file}`,
);
