import type { PostcodeSource } from "@uk-data-atlas/geography";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { buildDuckdbPostcodeIndex } from "./duckdbPostcodeIndex.ts";
import { readJsonSync } from "../lib/json.ts";

/**
 * Compile the newest filtered ONS Postcode Directory under
 * data/source/postcodes/onspd into the postcode index component.
 * District ordering is retained for postcode-to-area joins. The stored source excludes
 * Northern Ireland before it is included in the public data release.
 */

const latestDirectory = (repositoryRoot: string) => {
	const root = join(repositoryRoot, "data/source", "postcodes", "onspd");
	const editions = existsSync(root)
		? readdirSync(root)
				.filter((name) => existsSync(join(root, name, "meta.json")))
				.sort()
		: [];
	if (editions.length === 0)
		throw new Error(
			`No permitted ONS Postcode Directory under ${root}. Run pnpm --dir pipeline fetch:onspd.`,
		);
	return join(root, editions.at(-1)!);
};

/** What the stored source's meta.json records, as far as the index reads it. */
type SourceMeta = {
	files: Array<{ role: string; sha256: string; path: string }>;
	title: string;
	temporalCoverage: string;
	publisher: string;
	sourceUrl: string;
	retrieved: string;
	licence: { name: string; url: string };
	attribution: string[];
};

/** Permitted ONSPD rows streamed from the stored, filtered source. */
export const buildPostcodeIndex = async (repositoryRoot: string) => {
	const directory = latestDirectory(repositoryRoot);
	const meta = readJsonSync<SourceMeta>(join(directory, "meta.json"));
	const sourceFile = meta.files.find((file) => file.role === "source");
	if (!sourceFile)
		throw new Error(
			`${directory}: no source file is recorded in meta.json`,
		);
	const source: PostcodeSource = {
		title: meta.title,
		edition: meta.temporalCoverage,
		publisher: meta.publisher,
		sourceUrl: meta.sourceUrl,
		retrieved: meta.retrieved,
		sha256: `sha256:${sourceFile.sha256}`,
		licence: { name: meta.licence.name, url: meta.licence.url },
		attribution: meta.attribution,
	};
	return buildDuckdbPostcodeIndex(
		repositoryRoot,
		join(directory, sourceFile.path),
		source,
	);
};
