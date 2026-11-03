import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	repositoryStatisticsVocabularyPath,
	buildDirectory,
	readStatisticsVocabulary,
} from "@uk-data-atlas/atlas-runtime/storage";

/** Generate the vocabulary from the statistics database for the data build. */
const repositoryRoot = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const vocabulary = readStatisticsVocabulary(
	join(buildDirectory(repositoryRoot), "atlas-base.sqlite"),
);
const file = repositoryStatisticsVocabularyPath(repositoryRoot);
writeFileSync(file, `${JSON.stringify(vocabulary, null, "\t")}\n`);
console.log(
	`Wrote ${Object.keys(vocabulary.measures).length} measures and ${Object.keys(vocabulary.dimensions).length} dimensions to ${file}`,
);
