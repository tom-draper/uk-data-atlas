import type { PostcodeSource } from "@uk-data-atlas/geography/postcode-index-types";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDuckdbPostcodeIndex } from "./duckdbPostcodeIndex";

/**
 * Compile the newest filtered ONS Postcode Directory under
 * data/source/postcodes/onspd into the shared atlas.sqlite database.
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

/** Permitted ONSPD rows streamed from the stored, filtered source. */
export const buildPostcodeIndex = async (repositoryRoot: string) => {
	const directory = latestDirectory(repositoryRoot);
	const meta = JSON.parse(readFileSync(join(directory, "meta.json"), "utf8"));
	const sourceFile = meta.files.find(
		(file: { role: string }) => file.role === "source",
	);
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

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
	const { outputPath, artifact } = await buildPostcodeIndex(
		resolve(dirname(scriptPath), "../.."),
	);
	console.log(
		`Wrote ${artifact.counts.postcodes} postcodes (${artifact.counts.live} live) in ${artifact.shards.length} districts to ${outputPath}${artifact.excluded.length ? `, leaving out ${artifact.excluded.map((entry) => `${entry.area} (${entry.postcodes})`).join(", ")}` : ""}`,
	);
}
