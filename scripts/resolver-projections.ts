/**
 * Which API build each committed resolver projection came from.
 *
 * `pnpm lineage:build` and `pnpm containment:build` ask the API's geography
 * resolver where areas go and commit its answers to public/data/datasets.
 * The API's own build is not committed, so these files are the only trace of
 * it in the repository. Each script records, beside its outputs, the API
 * release it read and a hash of every file it wrote. `pnpm precompile:verify`
 * then fails when a file was edited after it was written, or when the
 * projections came from different API builds, as happens when only one of
 * the two scripts is rerun after an API rebuild.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const RESOLVER_PROJECTIONS_FILE = "resolver-projections.json";

export type ResolverProjection = {
	/** The `releaseId` of the API build the file was compiled from. */
	apiRelease: string;
	sha256: string;
	/** The command that writes the file. */
	writtenBy: string;
};

export type ResolverProjections = {
	version: 1;
	files: Record<string, ResolverProjection>;
};

const sha256 = (contents: string | Buffer) =>
	createHash("sha256").update(contents).digest("hex");

export const readResolverProjections = (
	datasets: string,
): ResolverProjections => {
	const path = join(datasets, RESOLVER_PROJECTIONS_FILE);
	if (!existsSync(path)) return { version: 1, files: {} };
	const record = JSON.parse(readFileSync(path, "utf8"));
	if (record?.version !== 1 || typeof record.files !== "object")
		throw new Error(`${RESOLVER_PROJECTIONS_FILE} is not version 1.`);
	return record as ResolverProjections;
};

/** Record the files one command has just written, keeping the others'. */
export const recordResolverProjections = (
	datasets: string,
	apiRelease: string,
	writtenBy: string,
	outputs: ReadonlyMap<string, string>,
) => {
	const { files } = readResolverProjections(datasets);
	for (const [name, contents] of outputs)
		files[name] = { apiRelease, sha256: sha256(contents), writtenBy };
	const sorted = Object.fromEntries(
		Object.entries(files).sort(([a], [b]) => a.localeCompare(b)),
	);
	writeFileSync(
		join(datasets, RESOLVER_PROJECTIONS_FILE),
		`${JSON.stringify({ version: 1, files: sorted }, null, "\t")}\n`,
	);
};

/** Every way the committed projections disagree with their record. */
export const resolverProjectionProblems = (datasets: string): string[] => {
	const { files } = readResolverProjections(datasets);
	const entries = Object.entries(files);
	if (entries.length === 0)
		return [`${RESOLVER_PROJECTIONS_FILE} records no projections.`];
	const problems: string[] = [];
	for (const [name, { sha256: expected, writtenBy }] of entries) {
		const path = join(datasets, name);
		if (!existsSync(path))
			problems.push(`${name} is missing; run ${writtenBy}.`);
		else if (sha256(readFileSync(path)) !== expected)
			problems.push(
				`${name} has changed since ${writtenBy} wrote it; run it again.`,
			);
	}
	const releases = new Map<string, string[]>();
	for (const [name, { apiRelease }] of entries)
		releases.set(apiRelease, [...(releases.get(apiRelease) ?? []), name]);
	if (releases.size > 1)
		problems.push(
			"The resolver projections come from different API builds: " +
				[...releases]
					.map(
						([release, names]) =>
							`${names.join(", ")} from ${release}`,
					)
					.join("; ") +
				". Run pnpm lineage:build and pnpm containment:build against one build.",
		);
	return problems;
};
