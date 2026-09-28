import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { format, resolveConfig } from "prettier";
import {
	boundaryCoverageMarkdown,
	datasetSourcesMarkdown,
} from "../lib/data/catalog/sources";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const README = join(ROOT, "README.md");
const START = "<!-- sources:start -->";
const END = "<!-- sources:end -->";
const BOUNDARIES_START = "<!-- boundaries:start -->";
const BOUNDARIES_END = "<!-- boundaries:end -->";

async function main() {
	const readme = await readFile(README, "utf8");
	const start = readme.indexOf(START);
	const end = readme.indexOf(END);
	if (start === -1 || end === -1 || end < start) {
		throw new Error(`Could not find ${START} and ${END} in README.md.`);
	}

	const boundaryStart = readme.indexOf(BOUNDARIES_START);
	const boundaryEnd = readme.indexOf(BOUNDARIES_END);
	if (
		boundaryStart === -1 ||
		boundaryEnd === -1 ||
		boundaryEnd < boundaryStart
	) {
		throw new Error(
			`Could not find ${BOUNDARIES_START} and ${BOUNDARIES_END} in README.md.`,
		);
	}

	const generatedSources = `${START}\n${datasetSourcesMarkdown()}\n${END}`;
	const sourcesUpdated = `${readme.slice(0, start)}${generatedSources}${readme.slice(end + END.length)}`;
	const updatedBoundaryStart = sourcesUpdated.indexOf(BOUNDARIES_START);
	const updatedBoundaryEnd = sourcesUpdated.indexOf(BOUNDARIES_END);
	const generatedBoundaries = `${BOUNDARIES_START}\n${boundaryCoverageMarkdown()}\n${BOUNDARIES_END}`;
	const updated = `${sourcesUpdated.slice(0, updatedBoundaryStart)}${generatedBoundaries}${sourcesUpdated.slice(updatedBoundaryEnd + BOUNDARIES_END.length)}`;
	// Prettier pads the generated tables, so format before comparing or the
	// committed README drifts from format:check on every regeneration.
	const config = await resolveConfig(README);
	const formatted = await format(updated, { ...config, filepath: README });
	if (formatted !== readme) await writeFile(README, formatted);
}

void main();
