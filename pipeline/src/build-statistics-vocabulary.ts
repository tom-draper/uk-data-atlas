import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	statisticsVocabularyPath,
	buildDirectory,
	buildLog,
	formatCount,
	repoPath,
} from "@uk-data-atlas/atlas-db";
import { readStatisticsVocabulary } from "@uk-data-atlas/measures";

/** Generate the vocabulary from the statistics database for the data build. */
const repositoryRoot = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../..",
);
const vocabulary = readStatisticsVocabulary(
	join(buildDirectory(repositoryRoot), "atlas-base.sqlite"),
);
const file = statisticsVocabularyPath(repositoryRoot);
writeFileSync(file, `${JSON.stringify(vocabulary, null, "\t")}\n`);
buildLog.info(
	`Wrote ${formatCount(Object.keys(vocabulary.measures).length)} measures and ${formatCount(Object.keys(vocabulary.dimensions).length)} dimensions to ${repoPath(file)}`,
);
