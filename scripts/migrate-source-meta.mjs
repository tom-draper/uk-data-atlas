/**
 * Idempotent migration of each `meta.json` under `data/source` to the schema in
 * packages/datasets/src/data/catalog/meta.ts (docs/data-organisation.md, task
 * 11). It drops the free-text `topics`, and adds what replaces them:
 *
 * - a source that feeds a dataset gets `"dataset": "<registered id>"`;
 * - a `core/` source that feeds a build but no dataset gets `"kind": "support"`;
 * - a source in `_staging/` gets `"kind": "staged"`.
 *
 * Boundaries, `core/lookups` and `postcodes` already carry their `kind` and feed
 * no dataset, so they only lose `topics`.
 *
 *   node scripts/migrate-source-meta.mjs [--dry-run] [directory]
 *
 * `data/source` is not in git, so this cannot be a commit. Run it once per
 * machine; running it again changes nothing. The directory defaults to
 * `data/source`. It edits each file as text, so the rest of the formatting is as
 * it was, and updates `.source-release.json`, so the files still count as the
 * downloaded release. `pnpm data:download` runs it, after the layout migration,
 * including on a release published before the change.
 *
 * A folder this script does not know is reported and left alone, and the
 * consistency test then names it. tests/scripts/migrateSourceMeta.test.ts checks
 * the table below against tests/data/sourceDatasets.ts.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { migrateMarker } from "./migrate-source-layout.mjs";

/**
 * The dataset each source folder feeds, relative to `data/source`. A folder that
 * feeds several names the one it is named for. `regional-gdp` and
 * `energy-consumption` are named for none of theirs, so they take the first,
 * until task 15 merges the three ITL levels. The full lists stay in
 * tests/data/sourceDatasets.ts.
 */
export const DATASET_FOLDERS = Object.fromEntries([
	["population/population-estimates/census-2021-ts001", "census-2021-ts001"],
	["population/population-estimates/census-2021-ts003", "census-2021-ts003"],
	[
		"population/population-estimates/census-2021-ts007a",
		"census-2021-ts007a",
	],
	[
		"population/ethnicity-and-identity/census-2021-ts021",
		"census-2021-ts021",
	],
	["health/health-status/census-2021-ts037", "census-2021-ts037"],
	["housing/housing-stock/census-2021-ts054", "census-2021-ts054"],
	["economy/labour-market/census-2021-ts066", "census-2021-ts066"],
	["population/ethnicity-and-identity/ethnicity", "ethnicity"],
	["population/population-estimates/population-uk", "population-uk"],
	[
		"population/population-estimates/population-constituency",
		"population-constituency",
	],
	["population/population-estimates/population", "population"],
	["society/deprivation/imd", "imd"],
	["society/deprivation/nimdm", "nimdm"],
	["society/deprivation/simd", "simd"],
	["society/deprivation/wimd", "wimd"],
	["economy/business/business-activity", "business-activity"],
	["society/poverty/child-poverty", "child-poverty"],
	["economy/labour-market/claimant-count", "claimant-count"],
	["society/crime-and-justice/crime", "crime"],
	["society/poverty/fuel-poverty", "fuel-poverty"],
	["housing/homelessness/homelessness", "homelessness"],
	[
		"housing/prices-and-affordability/house-price/mean-price-by-ward",
		"house-price",
	],
	[
		"housing/prices-and-affordability/house-price/median-price-by-ward",
		"house-price",
	],
	[
		"housing/housing-stock/net-additional-dwellings",
		"net-additional-dwellings",
	],
	["economy/earnings-and-income/income", "income"],
	["economy/labour-market/jobs", "jobs"],
	[
		"economy/public-finance/local-government-finance",
		"local-government-finance",
	],
	["housing/housing-stock/council-tax", "council-tax"],
	["economy/economic-output/regional-gdp", "regional-gdp-itl1"],
	["economy/labour-market/unemployment", "unemployment"],
	[
		"housing/prices-and-affordability/housing-affordability",
		"housing-affordability",
	],
	[
		"education/schools/school-performance-constituency",
		"school-performance-constituency",
	],
	["education/schools/school-performance", "school-performance"],
	["education/schools/pupil-absence", "pupil-absence"],
	["education/qualifications/qualification", "qualification"],
	["environment/air-quality/air-quality", "air-quality"],
	["environment/energy/energy-consumption", "electricity-consumption"],
	["environment/emissions/ghg-emissions", "ghg-emissions"],
	["environment/waste/waste", "waste"],
	["core/land-area", "land-area"],
	[
		"health/social-care/adult-social-care-activity",
		"adult-social-care-activity",
	],
	[
		"health/social-care/adult-social-care-outcomes",
		"adult-social-care-outcomes",
	],
	["health/life-expectancy/life-expectancy", "life-expectancy"],
	["health/nhs-services/nhs-waiting", "nhs-waiting"],
	["health/health-status/public-health", "public-health"],
	["housing/planning/planning-applications", "planning-applications"],
	[
		"politics/general-elections/historical-general-election",
		"historical-general-election",
	],
	...["2010", "2015", "2017", "2019", "2024"].map((year) => [
		`politics/general-elections/general-election/${year}`,
		"general-election",
	]),
	...[
		"2016",
		"2017",
		"2018",
		"2019",
		"2021",
		"2022",
		"2023",
		"2024",
		"2025",
	].map((year) => [
		`politics/local-elections/local-election/${year}`,
		"local-election",
	]),
	["politics/referendums/brexit-constituency", "brexit-constituency"],
	["politics/referendums/brexit", "brexit"],
	["infrastructure/digital-connectivity/broadband", "broadband"],
	["infrastructure/digital-connectivity/mobile-coverage", "mobile-coverage"],
	["transport/vehicles/car-availability", "car-availability"],
	[
		"transport/vehicles/electric-vehicle-chargers",
		"electric-vehicle-chargers",
	],
	["transport/road-safety/road-collisions", "road-collisions"],
	["transport/commuting/travel-to-work", "travel-to-work"],
]);

/** `core/` sources that feed a build, not a dataset. */
export const SUPPORT_FOLDERS = [
	"core/census-2022-scotland-output-area",
	"core/population-weighted-centroids/oa-2021-ew-v4",
	"core/population-weighted-centroids/oa-2022-sc",
	"core/council-tax-stock/2026",
	"core/census-2021-lsoa",
	"core/census-2021-ni-data-zone",
	"core/historic-counties",
];

/** Roots whose sources have their own `kind` and feed no dataset. */
const KIND_ROOTS = ["boundaries/", "core/lookups/", "postcodes/"];

/** What a folder's `meta.json` must gain, or null if the folder is unknown. */
export function metaAdditions(folder) {
	if (KIND_ROOTS.some((root) => `${folder}/`.startsWith(root))) return {};
	if (folder.startsWith("_staging/")) return { kind: "staged" };
	if (SUPPORT_FOLDERS.includes(folder)) return { kind: "support" };
	if (Object.hasOwn(DATASET_FOLDERS, folder))
		return { dataset: DATASET_FOLDERS[folder] };
	return null;
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** JSON with sorted keys, so two parses compare whatever their key order. */
const stable = (value) =>
	JSON.stringify(value, (_, item) =>
		item && typeof item === "object" && !Array.isArray(item)
			? Object.fromEntries(
					Object.entries(item).sort(([a], [b]) => a.localeCompare(b)),
				)
			: item,
	);

// The `topics` array, on one line or several, as a whole line with its comma.
const TOPICS_LINE = /^[ \t]*"topics"[ \t]*:[ \t]*\[[^\]]*\][ \t]*,[ \t]*\r?\n/m;
// The same as the last property: take the comma off the property before it.
const TOPICS_LAST =
	/,[ \t]*\r?\n[ \t]*"topics"[ \t]*:[ \t]*\[[^\]]*\][ \t]*(?=\r?\n[ \t]*\})/;
const ID_LINE = /^([ \t]*)"id"[ \t]*:[ \t]*"(?:[^"\\]|\\.)*",?[ \t]*$/m;

/**
 * The text with `topics` removed and each of `add` put after the `id` line, or
 * null if the file is not laid out as expected.
 */
function editText(text, add) {
	let next = text.replace(TOPICS_LINE, "");
	if (next === text) next = text.replace(TOPICS_LAST, "");
	if (Object.keys(add).length === 0) return next;
	const id = ID_LINE.exec(next);
	if (!id) return null;
	const eol = next.includes("\r\n") ? "\r\n" : "\n";
	const lines = Object.entries(add)
		.map(
			([key, value]) =>
				`${eol}${id[1]}${JSON.stringify(key)}: ${JSON.stringify(value)},`,
		)
		.join("");
	const end = id.index + id[0].length;
	// `id` as the last property has no comma to carry on from.
	if (!id[0].trimEnd().endsWith(",")) return null;
	return next.slice(0, end) + lines + next.slice(end);
}

/**
 * The migrated text of one `meta.json`, or null if it needs no change. Throws
 * if the file names a different `dataset` or `kind` than the table expects, or
 * is not JSON.
 */
export function migrateMetaText(text, additions) {
	const parsed = JSON.parse(text);
	const add = {};
	for (const [key, value] of Object.entries(additions)) {
		if (parsed[key] === undefined) add[key] = value;
		else if (parsed[key] !== value)
			throw new Error(
				`has ${key} ${JSON.stringify(parsed[key])}, expected ${JSON.stringify(value)}`,
			);
	}
	if (parsed.topics === undefined && Object.keys(add).length === 0)
		return null;

	const { topics: _topics, ...rest } = parsed;
	const expected = stable({ ...rest, ...add });
	const edited = editText(text, add);
	try {
		if (edited !== null && stable(JSON.parse(edited)) === expected)
			return edited;
	} catch {
		// Fall through to the whole-file rewrite.
	}
	// An unusual layout: rewrite the file in the repo's JSON style.
	const rewritten = {};
	for (const [key, value] of Object.entries(rest)) {
		rewritten[key] = value;
		if (key === "id") Object.assign(rewritten, add);
	}
	if (rewritten.id === undefined) Object.assign(rewritten, add);
	return `${JSON.stringify(rewritten, null, "\t")}\n`;
}

/** Every folder under `root` that holds a `meta.json`, relative to it. */
async function metaFolders(root, dir = "") {
	const found = [];
	for (const entry of await readdir(join(root, dir), {
		withFileTypes: true,
	})) {
		if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
		const folder = dir ? `${dir}/${entry.name}` : entry.name;
		if (existsSync(join(root, folder, "meta.json"))) found.push(folder);
		found.push(...(await metaFolders(root, folder)));
	}
	return found;
}

/**
 * Migrates every `meta.json` under `root`. Returns the files changed, as their
 * path with the hash before and after, which the release marker needs; the
 * folders it does not know, which are left alone; and the files it could not
 * migrate.
 */
export async function migrateSourceMeta(root, { dryRun = false } = {}) {
	const rewrites = [];
	const unknown = [];
	const failed = [];
	for (const folder of (await metaFolders(root)).sort()) {
		const path = `${folder}/meta.json`;
		const additions = metaAdditions(folder);
		const raw = await readFile(join(root, path));
		const text = raw.toString("utf8");
		try {
			if (additions === null) {
				const parsed = JSON.parse(text);
				if (parsed.topics !== undefined || parsed.dataset === undefined)
					unknown.push(folder);
				continue;
			}
			const next = migrateMetaText(text, additions);
			if (next === null) continue;
			const bytes = Buffer.from(next);
			rewrites.push({ path, before: sha256(raw), after: sha256(bytes) });
			if (!dryRun) await writeFile(join(root, path), bytes);
		} catch (error) {
			failed.push(`${path}: ${error.message}`);
		}
	}
	return { rewrites, unknown, failed };
}

async function main() {
	const args = process.argv.slice(2);
	const dryRun = args.includes("--dry-run");
	const root =
		args.find((arg) => !arg.startsWith("--")) ??
		join(dirname(dirname(fileURLToPath(import.meta.url))), "data/source");
	if (!existsSync(root)) {
		console.log(`${root} does not exist, nothing to migrate`);
		return;
	}
	const { rewrites, unknown, failed } = await migrateSourceMeta(root, {
		dryRun,
	});
	if (!dryRun && rewrites.length > 0) await migrateMarker(root, { rewrites });
	if (unknown.length > 0)
		console.log(
			`Not in the table, left alone (add them to scripts/migrate-source-meta.mjs):\n${unknown.map((f) => `  ${f}`).join("\n")}`,
		);
	if (failed.length > 0) {
		console.error(
			`Not migrated:\n${failed.map((f) => `  ${f}`).join("\n")}`,
		);
		process.exitCode = 1;
	}
	console.log(
		rewrites.length === 0
			? "Every meta.json is already migrated"
			: `${dryRun ? "Would migrate" : "Migrated"} ${rewrites.length} meta.json files`,
	);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
	await main();
