import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { datasetSourcesMarkdown } from "../lib/data/catalog/sources";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const README = join(ROOT, "README.md");
const START = "<!-- sources:start -->";
const END = "<!-- sources:end -->";

async function main() {
	const readme = await readFile(README, "utf8");
	const start = readme.indexOf(START);
	const end = readme.indexOf(END);
	if (start === -1 || end === -1 || end < start) {
		throw new Error(`Could not find ${START} and ${END} in README.md.`);
	}

	const generated = `${START}\n${datasetSourcesMarkdown()}\n${END}`;
	const updated = `${readme.slice(0, start)}${generated}${readme.slice(end + END.length)}`;
	if (updated !== readme) await writeFile(README, updated);
}

void main();
