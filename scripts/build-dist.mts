import {
	existsSync,
	linkSync,
	readdirSync,
	readFileSync,
	copyFileSync,
} from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isStagedPath, parseDatasetMeta } from "@uk-data-atlas/datasets";
import {
	DATASET_SOURCES,
	CORE_COMPATIBILITY_KEY,
	buildModuleManifests,
	type DatasetFoundationPart,
} from "@uk-data-atlas/datasets/registry";
import { BUILD_FILE } from "../pipeline/src/modules/buildFile.ts";
import {
	licenceInputOf,
	planDist,
	type DistBuilds,
	type DistFacts,
	type SourceFact,
} from "./dist-modules.mts";

/**
 * Writes `data/dist/uk-data-atlas-<release>/`: module manifests, generated
 * READMEs and the indexes (docs/data-organisation.md, task 12). The tree is
 * the product layout and is not in git; only this code is. It reads the
 * `meta.json` of every source folder, so it needs `pnpm data:download` first.
 *
 *   pnpm data:dist [--release <name>]
 */

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SOURCE = join(ROOT, "data/source");
const DIST = join(ROOT, "data/dist");

/** Which foundation part a source kind feeds. */
const PART_OF_KIND: Readonly<Record<string, DatasetFoundationPart>> = {
	boundary: "boundaries",
	"postcode-directory": "postcodes",
	lookup: "core",
	support: "core",
};

/** Source folders under `dir`, less the staged ones, which no module ships. */
const metaFolders = (dir: string, root = dir): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		if (!entry.isDirectory() || entry.name.startsWith(".")) return [];
		const path = join(dir, entry.name);
		if (isStagedPath(relative(root, path))) return [];
		return [
			...(existsSync(join(path, "meta.json")) ? [path] : []),
			...metaFolders(path, root),
		];
	});

const factOf = (meta: ReturnType<typeof parseDatasetMeta>): SourceFact => ({
	title: meta.title,
	publisher: meta.publisher,
	sourceUrl: meta.sourceUrl,
	licenceName: meta.licence.name,
	...(meta.licence.url === undefined ? {} : { licenceUrl: meta.licence.url }),
	attribution:
		meta.attribution === undefined
			? []
			: Array.isArray(meta.attribution)
				? meta.attribution
				: [meta.attribution],
});

/** The facts of every source under `data/source`, by dataset and foundation part. */
export const readDistFacts = (source = SOURCE): DistFacts => {
	const datasets: Record<string, SourceFact[]> = {};
	const foundation: Record<DatasetFoundationPart, SourceFact[]> = {
		core: [],
		boundaries: [],
		postcodes: [],
	};
	const fed = new Map(DATASET_SOURCES.map(([folder, ids]) => [folder, ids]));
	for (const path of metaFolders(source)) {
		const folder = relative(source, path);
		const meta = parseDatasetMeta(
			JSON.parse(readFileSync(join(path, "meta.json"), "utf8")),
			folder.split("/").at(-1)!,
		);
		const fact = factOf(meta);
		const ids = fed.get(folder);
		if (ids) for (const id of ids) (datasets[id] ??= []).push(fact);
		const part = PART_OF_KIND[meta.kind];
		if (part) foundation[part].push(fact);
	}
	return { datasets, foundation };
};

/** Fails when a licence is missing or unknown, so a dist never claims one it lacks. */
export const checkDistFacts = (facts: DistFacts): string[] => {
	const manifests = buildModuleManifests(licenceInputOf(facts));
	return manifests.flatMap((manifest) => [
		...manifest.datasets
			.filter(({ licences }) => licences.length === 0)
			.map(({ id }) => `${manifest.id}: ${id} has no recorded licence`),
		...manifest.unresolvedLicences.map(
			(name) => `${manifest.id}: unknown licence "${name}"`,
		),
		...(manifest.licences?.length === 0
			? [`${manifest.id}: no licences derived`]
			: []),
	]);
};

const BUILT = join(ROOT, "data/build/modules");

/** The results of `pnpm data:build --only build-modules`, or none when it has not run. */
export const readBuilds = (dir = BUILT): DistBuilds => {
	const path = join(dir, BUILD_FILE);
	if (!existsSync(path)) return {};
	const file = JSON.parse(readFileSync(path, "utf8")) as {
		schemaVersion?: number;
		core?: string;
		modules?: DistBuilds;
	};
	if (file.schemaVersion !== 1 || file.core !== CORE_COMPATIBILITY_KEY)
		throw new Error(
			`${path} was written for ${String(file.core)}, this code is ${CORE_COMPATIBILITY_KEY}. Run the module build again.`,
		);
	const modules = file.modules ?? {};
	for (const build of Object.values(modules))
		if (build.status === "built")
			for (const { path: relativePath } of build.files)
				if (!existsSync(join(dir, relativePath)))
					throw new Error(
						`${relativePath} is listed in ${path} but missing. Run the module build again.`,
					);
	return modules;
};

/** Hard links the built files into the release (a copy across file systems). */
const placeBuilt = async (builds: DistBuilds, root: string) => {
	for (const build of Object.values(builds)) {
		if (build.status !== "built") continue;
		for (const { path } of build.files) {
			const to = join(root, path);
			await mkdir(dirname(to), { recursive: true });
			try {
				linkSync(join(BUILT, path), to);
			} catch {
				copyFileSync(join(BUILT, path), to);
			}
		}
	}
};

const main = async () => {
	const args = process.argv.slice(2);
	const at = args.indexOf("--release");
	const release = at === -1 ? "dev" : (args[at + 1] ?? "");
	if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(release))
		throw new Error("--release needs a name such as 2026.11 or dev.");
	if (!existsSync(SOURCE))
		throw new Error(
			"data/source is missing. Run pnpm data:download first, the licences come from its meta.json files.",
		);
	const facts = readDistFacts();
	const problems = checkDistFacts(facts);
	if (problems.length > 0)
		throw new Error(`Cannot describe the modules:\n${problems.join("\n")}`);
	const root = join(DIST, `uk-data-atlas-${release}`);
	await rm(root, { recursive: true, force: true });
	const builds = readBuilds();
	await placeBuilt(builds, root);
	for (const [path, text] of planDist(facts, release, builds)) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), text);
	}
	console.log(`Wrote ${relative(ROOT, root)}`);
};

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
	await main();
