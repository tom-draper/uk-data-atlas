/**
 * One-off, idempotent move of `data/source` from the old subject layout to
 * `<theme>/<topic>/<dataset id>` (docs/data-organisation.md, tasks 5 and 6).
 * It runs in two stages, `SOURCE_MOVES` into the theme layout and then
 * `SOURCE_RENAMES` to the id of each dataset, so a machine on either layout
 * ends in the same place. A renamed folder's `meta.json` takes the folder name
 * as its `id`.
 *
 *   node scripts/migrate-source-layout.mjs [--dry-run] [directory]
 *
 * `data/source` is not in git, so `git mv` cannot do this. Run it once per
 * machine. It is safe to run again: a folder already at its new path is left
 * alone, and a machine already on the new layout is untouched. The directory
 * defaults to `data/source`.
 *
 * It also rewrites `.source-release.json`, so the folders still count as the
 * downloaded release. `pnpm data:download` runs it first, and again on a
 * release published before the move, so an old release lands in the new layout.
 *
 * The new paths are the ones `sourceDir()` returns
 * (packages/datasets/src/declaration/sources.ts).
 * tests/scripts/migrateSourceLayout.test.ts checks the two agree. Sources
 * nothing reads move to `_staging/`.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import {
	mkdir,
	readFile,
	readdir,
	rename,
	rmdir,
	stat,
	writeFile,
} from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** [old path, new path], relative to `data/source`. */
export const SOURCE_MOVES = [
	[
		"demographics/census-2021-small-area/ts001",
		"population/population-estimates/ts001",
	],
	[
		"demographics/census-2021-small-area/ts003",
		"population/population-estimates/ts003",
	],
	[
		"demographics/census-2021-small-area/ts007a",
		"population/population-estimates/ts007a",
	],
	[
		"demographics/census-2021-small-area/ts021",
		"population/ethnicity-and-identity/ts021",
	],
	["demographics/census-2021-small-area/ts037", "health/health-status/ts037"],
	[
		"demographics/census-2021-small-area/ts054",
		"housing/housing-stock/ts054",
	],
	[
		"demographics/census-2021-small-area/ts066",
		"economy/labour-market/ts066",
	],
	[
		"demographics/ethnicity/ts021-ethnic-group",
		"population/ethnicity-and-identity/ts021-ethnic-group",
	],
	[
		"demographics/population/mid-year-estimates/uk",
		"population/population-estimates/uk",
	],
	[
		"demographics/population/small-area-estimates/population-constituency-estimates",
		"population/population-estimates/population-constituency-estimates",
	],
	[
		"demographics/population/small-area-estimates/population-ward-estimates",
		"population/population-estimates/population-ward-estimates",
	],
	["deprivation/imd", "society/deprivation/imd"],
	["deprivation/nimdm", "society/deprivation/nimdm"],
	["deprivation/simd", "society/deprivation/simd"],
	["deprivation/wimd", "society/deprivation/wimd"],
	["economics/child-poverty", "society/poverty/child-poverty"],
	["economics/fuel-poverty", "society/poverty/fuel-poverty"],
	["economics/crime", "society/crime-and-justice/crime"],
	["economics/business-activity", "economy/business/business-activity"],
	["economics/claimant-count", "economy/labour-market/claimant-count"],
	["economics/jobs", "economy/labour-market/jobs"],
	["economics/unemployment/model-based", "economy/labour-market/model-based"],
	["economics/income", "economy/earnings-and-income/income"],
	[
		"economics/local-government-finance",
		"economy/public-finance/local-government-finance",
	],
	["economics/regional-gdp", "economy/economic-output/regional-gdp"],
	["economics/homelessness", "housing/homelessness/homelessness"],
	[
		"economics/housing/mean-price-by-ward",
		"housing/prices-and-affordability/mean-price-by-ward",
	],
	[
		"economics/housing/median-price-by-ward",
		"housing/prices-and-affordability/median-price-by-ward",
	],
	[
		"education/housing-affordability",
		"housing/prices-and-affordability/housing-affordability",
	],
	[
		"economics/housing/net-additional-dwellings",
		"housing/housing-stock/net-additional-dwellings",
	],
	[
		"economics/local-government-finance/council-tax",
		"housing/housing-stock/council-tax",
	],
	["housing/planning-applications", "housing/planning/planning-applications"],
	[
		"education/ks4-performance/local-authority-district",
		"education/schools/local-authority-district",
	],
	[
		"education/ks4-performance/ks4-constituency",
		"education/schools/ks4-constituency",
	],
	["education/pupil-attendance", "education/schools/pupil-attendance"],
	["education/qualification", "education/qualifications/qualification"],
	["environment/air-quality", "environment/air-quality/air-quality"],
	["environment/energy-consumption", "environment/energy/energy-consumption"],
	["environment/ghg-emissions", "environment/emissions/ghg-emissions"],
	["environment/waste", "environment/waste/waste"],
	["health/adult-social-care/activity", "health/social-care/activity"],
	["health/adult-social-care/ascof", "health/social-care/ascof"],
	["health/life-expectancy", "health/life-expectancy/life-expectancy"],
	["health/nhs-waiting-times", "health/nhs-services/nhs-waiting-times"],
	[
		"health/public-health-outcomes-framework",
		"health/health-status/public-health-outcomes-framework",
	],
	[
		"politics/elections/general-elections/1918-2019",
		"politics/general-elections/1918-2019",
	],
	[
		"politics/elections/general-elections/2010",
		"politics/general-elections/2010",
	],
	[
		"politics/elections/general-elections/2015",
		"politics/general-elections/2015",
	],
	[
		"politics/elections/general-elections/2017",
		"politics/general-elections/2017",
	],
	[
		"politics/elections/general-elections/2019",
		"politics/general-elections/2019",
	],
	[
		"politics/elections/general-elections/2024",
		"politics/general-elections/2024",
	],
	[
		"politics/elections/local-elections/2016",
		"politics/local-elections/2016",
	],
	[
		"politics/elections/local-elections/2017",
		"politics/local-elections/2017",
	],
	[
		"politics/elections/local-elections/2018",
		"politics/local-elections/2018",
	],
	[
		"politics/elections/local-elections/2019",
		"politics/local-elections/2019",
	],
	[
		"politics/elections/local-elections/2021",
		"politics/local-elections/2021",
	],
	[
		"politics/elections/local-elections/2022",
		"politics/local-elections/2022",
	],
	[
		"politics/elections/local-elections/2023",
		"politics/local-elections/2023",
	],
	[
		"politics/elections/local-elections/2024",
		"politics/local-elections/2024",
	],
	[
		"politics/elections/local-elections/2025",
		"politics/local-elections/2025",
	],
	[
		"politics/referendum/constituencies/2016",
		"politics/referendums/constituencies-2016",
	],
	[
		"politics/referendum/local-authorities/2016",
		"politics/referendums/local-authorities-2016",
	],
	["telecoms/broadband", "infrastructure/digital-connectivity/broadband"],
	["telecoms/mobile", "infrastructure/digital-connectivity/mobile"],
	["transport/car-availability", "transport/vehicles/car-availability"],
	[
		"transport/electric-vehicle-chargers",
		"transport/vehicles/electric-vehicle-chargers",
	],
	["transport/road-safety", "transport/road-safety/road-safety"],
	["transport/travel-to-work", "transport/commuting/travel-to-work"],
	["lookups", "core/lookups"],
	["geography/land-area", "core/land-area"],
	["demographics/population/census-2021-lsoa", "core/census-2021-lsoa"],
	[
		"demographics/population/census-2021-ni-data-zone",
		"core/census-2021-ni-data-zone",
	],
	[
		"demographics/population/census-2022-scotland-output-area",
		"core/census-2022-scotland-output-area",
	],
	["housing/council-tax-stock", "core/council-tax-stock"],
	[
		"geography/population-weighted-centroids",
		"core/population-weighted-centroids",
	],
	["geography/historic-counties", "core/historic-counties"],
	["geography/ceremonial-counties", "core/ceremonial-counties"],
	[
		"health/childhood-vaccination-cover",
		"_staging/childhood-vaccination-cover",
	],
	[
		"health/english-prescribing-dataset",
		"_staging/english-prescribing-dataset",
	],
	["health/gp-appointments", "_staging/gp-appointments"],
	["health/gp-registered-patients", "_staging/gp-registered-patients"],
	["health/hospital-admitted-care", "_staging/hospital-admitted-care"],
	["health/ons-deaths-by-area", "_staging/ons-deaths-by-area"],
	["health/primary-care-workforce", "_staging/primary-care-workforce"],
	[
		"economics/household-economic-activity",
		"_staging/household-economic-activity",
	],
	["demographics/census-2021-22-uk-wide", "_staging/census-2021-22-uk-wide"],
	[
		"demographics/ethnicity/ethnic-group-by-age-and-sex",
		"_staging/ethnic-group-by-age-and-sex",
	],
	[
		"demographics/population/mid-year-estimates/england-wales",
		"_staging/england-wales",
	],
	[
		"economics/unemployment/by-age-and-duration",
		"_staging/by-age-and-duration",
	],
	["economics/unemployment/local-indicators", "_staging/local-indicators"],
	["environment/flood-risk", "_staging/flood-risk"],
];

/**
 * [path in the theme layout, final path], relative to `data/source`. The second
 * stage renames a folder to the id of the dataset it feeds (task 6). It runs
 * after the first, so a machine on either layout ends up in the same place.
 */
export const SOURCE_RENAMES = [
	[
		"population/population-estimates/ts001",
		"population/population-estimates/census-2021-ts001",
	],
	[
		"population/population-estimates/ts003",
		"population/population-estimates/census-2021-ts003",
	],
	[
		"population/population-estimates/ts007a",
		"population/population-estimates/census-2021-ts007a",
	],
	[
		"population/ethnicity-and-identity/ts021",
		"population/ethnicity-and-identity/census-2021-ts021",
	],
	["health/health-status/ts037", "health/health-status/census-2021-ts037"],
	["housing/housing-stock/ts054", "housing/housing-stock/census-2021-ts054"],
	["economy/labour-market/ts066", "economy/labour-market/census-2021-ts066"],
	[
		"population/ethnicity-and-identity/ts021-ethnic-group",
		"population/ethnicity-and-identity/ethnicity",
	],
	[
		"population/population-estimates/uk",
		"population/population-estimates/population-uk",
	],
	[
		"population/population-estimates/population-constituency-estimates",
		"population/population-estimates/population-constituency",
	],
	[
		"population/population-estimates/population-ward-estimates",
		"population/population-estimates/population",
	],
	["economy/labour-market/model-based", "economy/labour-market/unemployment"],
	[
		"housing/prices-and-affordability/mean-price-by-ward",
		"housing/prices-and-affordability/house-price/mean-price-by-ward",
	],
	[
		"housing/prices-and-affordability/median-price-by-ward",
		"housing/prices-and-affordability/house-price/median-price-by-ward",
	],
	[
		"education/schools/local-authority-district",
		"education/schools/school-performance",
	],
	[
		"education/schools/ks4-constituency",
		"education/schools/school-performance-constituency",
	],
	["education/schools/pupil-attendance", "education/schools/pupil-absence"],
	[
		"health/social-care/activity",
		"health/social-care/adult-social-care-activity",
	],
	[
		"health/social-care/ascof",
		"health/social-care/adult-social-care-outcomes",
	],
	[
		"health/nhs-services/nhs-waiting-times",
		"health/nhs-services/nhs-waiting",
	],
	[
		"health/health-status/public-health-outcomes-framework",
		"health/health-status/public-health",
	],
	[
		"politics/general-elections/1918-2019",
		"politics/general-elections/historical-general-election",
	],
	[
		"politics/general-elections/2010",
		"politics/general-elections/general-election/2010",
	],
	[
		"politics/general-elections/2015",
		"politics/general-elections/general-election/2015",
	],
	[
		"politics/general-elections/2017",
		"politics/general-elections/general-election/2017",
	],
	[
		"politics/general-elections/2019",
		"politics/general-elections/general-election/2019",
	],
	[
		"politics/general-elections/2024",
		"politics/general-elections/general-election/2024",
	],
	[
		"politics/local-elections/2016",
		"politics/local-elections/local-election/2016",
	],
	[
		"politics/local-elections/2017",
		"politics/local-elections/local-election/2017",
	],
	[
		"politics/local-elections/2018",
		"politics/local-elections/local-election/2018",
	],
	[
		"politics/local-elections/2019",
		"politics/local-elections/local-election/2019",
	],
	[
		"politics/local-elections/2021",
		"politics/local-elections/local-election/2021",
	],
	[
		"politics/local-elections/2022",
		"politics/local-elections/local-election/2022",
	],
	[
		"politics/local-elections/2023",
		"politics/local-elections/local-election/2023",
	],
	[
		"politics/local-elections/2024",
		"politics/local-elections/local-election/2024",
	],
	[
		"politics/local-elections/2025",
		"politics/local-elections/local-election/2025",
	],
	[
		"politics/referendums/constituencies-2016",
		"politics/referendums/brexit-constituency",
	],
	[
		"politics/referendums/local-authorities-2016",
		"politics/referendums/brexit",
	],
	[
		"infrastructure/digital-connectivity/mobile",
		"infrastructure/digital-connectivity/mobile-coverage",
	],
	[
		"transport/road-safety/road-safety",
		"transport/road-safety/road-collisions",
	],
];

const MARKER = ".source-release.json";
/** Where folders wait between the two phases, so a new path can sit inside an old one. */
const HOLD = ".layout-move";

const inside = (path, folder) =>
	path === folder || path.startsWith(`${folder}/`);

/** The path a file has once `moves` are applied, or null if its folder is not in them. */
const mapped = (moves, path) => {
	const move = [...moves]
		.sort((a, b) => b[0].length - a[0].length)
		.find(([from]) => inside(path, from));
	return move ? move[1] + path.slice(move[0].length) : null;
};

/** The final path of a folder the theme layout put in `to`. */
const finalFolder = (to, renames) => mapped(renames, to) ?? to;

/**
 * The new path of a file at `path` in any earlier layout, or null if its
 * folder did not move.
 */
export function movedPath(path, renames = SOURCE_RENAMES) {
	// A path already inside a folder that nests in its old one has moved: the
	// theme layout's, or the one it is renamed to.
	const settled = SOURCE_MOVES.some(
		([from, to]) =>
			inside(to, from) &&
			(inside(path, to) || inside(path, finalFolder(to, renames))),
	);
	const themed = settled ? null : mapped(SOURCE_MOVES, path);
	const current = themed ?? path;
	// The nested moves above are settled in the theme layout, not the final one,
	// so a path in the theme layout still goes through the renames.
	const final = mapped(renames, current) ?? current;
	return final === path ? null : final;
}

/**
 * Moves the folders of `moves` under `root`. Returns what it did and anything
 * it could not do: a folder wanted at a path that is already taken is a
 * conflict and nothing is moved until it is resolved.
 */
async function moveFolders(
	root,
	moves,
	{ dryRun = false, settled = () => false, reportStrays = true } = {},
) {
	// Deepest first, so a folder nested in another leaves before its parent does.
	const ordered = moves
		.map(([from, to], index) => ({ from, to, index }))
		.sort((a, b) => b.from.split("/").length - a.from.split("/").length);
	const at = (path) => join(root, path);
	const held = (move) => join(root, HOLD, String(move.index));

	// A new path can sit inside its old one (`health/life-expectancy` becomes
	// `health/life-expectancy/life-expectancy`), so there the old path existing
	// beside the new one just means the folder has moved.
	const done = (move) =>
		inside(move.to, move.from) &&
		(existsSync(at(move.to)) || settled(move));
	const pending = ordered.filter(
		(move) =>
			!done(move) &&
			(existsSync(at(move.from)) || existsSync(held(move))),
	);
	const conflicts = pending.filter(
		(move) => existsSync(at(move.from)) && existsSync(at(move.to)),
	);
	if (conflicts.length > 0)
		return { moved: [], conflicts: conflicts.map((m) => m.to), strays: [] };
	if (dryRun)
		return {
			moved: pending.map((m) => [m.from, m.to]),
			conflicts: [],
			strays: [],
		};

	for (const move of pending) {
		if (!existsSync(at(move.from))) continue;
		await mkdir(dirname(held(move)), { recursive: true });
		await rename(at(move.from), held(move));
	}
	for (const move of pending) {
		await mkdir(dirname(at(move.to)), { recursive: true });
		await rename(held(move), at(move.to));
	}
	await rmdir(join(root, HOLD)).catch(() => {});

	// Old parents left empty go. What else is in them is reported, not touched,
	// unless it is a folder the move itself filled (`housing/` is old and new).
	const parents = new Set();
	for (const move of pending) {
		for (let dir = dirname(move.from); dir !== "."; dir = dirname(dir))
			parents.add(dir);
	}
	const filled = (path) =>
		parents.has(path) ||
		moves.some(([, to]) => to === path || to.startsWith(`${path}/`));
	const strays = [];
	for (const dir of [...parents].sort((a, b) => b.length - a.length)) {
		if (!existsSync(at(dir))) continue;
		const left = await readdir(at(dir));
		if (left.length === 0) await rmdir(at(dir));
		else if (reportStrays)
			strays.push(
				...left
					.map((name) => `${dir}/${name}`)
					.filter((path) => !filled(path)),
			);
	}
	return {
		moved: pending.map((m) => [m.from, m.to]),
		conflicts: [],
		strays,
	};
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/**
 * Sets the `id` in the `meta.json` of each folder to the folder's name, which
 * `parseDatasetMeta` requires. It edits the one value in place, so the rest of
 * the file is as it was. Returns the files changed, as their path with the hash
 * before and after, which the release marker needs.
 */
async function setMetaIds(root, folders, dryRun) {
	const rewrites = [];
	for (const folder of folders) {
		const path = `${folder}/meta.json`;
		let raw;
		try {
			raw = await readFile(join(root, path));
		} catch {
			continue;
		}
		const id = basename(folder);
		try {
			if (JSON.parse(raw.toString("utf8")).id === id) continue;
			const text = raw
				.toString("utf8")
				.replace(
					/("id"\s*:\s*)"(?:[^"\\]|\\.)*"/,
					(_, key) => `${key}${JSON.stringify(id)}`,
				);
			if (JSON.parse(text).id !== id) continue;
			const next = Buffer.from(text);
			rewrites.push({ path, before: sha256(raw), after: sha256(next) });
			if (!dryRun) await writeFile(join(root, path), next);
		} catch {
			// Not JSON we can edit: leave it for the build to report.
		}
	}
	return rewrites;
}

/**
 * Moves `data/source` into the theme layout and renames its folders to dataset
 * ids. Returns each folder moved, from where it was found to where it ended,
 * and anything it could not do.
 */
export async function migrateSourceLayout(
	root,
	{ dryRun = false, renames = SOURCE_RENAMES } = {},
) {
	const first = await moveFolders(root, SOURCE_MOVES, {
		dryRun,
		// A nested folder whose renamed path exists has moved on already.
		settled: ({ to }) => existsSync(join(root, finalFolder(to, renames))),
	});
	if (first.conflicts.length > 0)
		return { ...first, moved: [], rewrites: [] };
	const second = await moveFolders(root, renames, {
		dryRun,
		reportStrays: false,
	});
	// A dry run has not moved the first stage, so say where it would end.
	const moved = [
		...first.moved.map(([from, to]) => [from, finalFolder(to, renames)]),
		...second.moved.filter(
			([from]) => !first.moved.some(([, to]) => to === from),
		),
	];
	if (second.conflicts.length > 0)
		return { moved, conflicts: second.conflicts, strays: [], rewrites: [] };
	return {
		moved,
		conflicts: [],
		strays: first.strays,
		rewrites: await setMetaIds(
			root,
			renames.map(([, to]) => to),
			dryRun,
		),
	};
}

/**
 * Rewrites the paths in the release marker to the new layout. The recorded
 * hashes stay, except for a `meta.json` whose id was set (`rewrites`) and that
 * still had the hash the release recorded: it takes the hash of the rewritten
 * file and its stamp, so the folder still counts as the downloaded release.
 * Renaming changes a file's ctime, so that one stamp is renewed for each file
 * whose size and mtime still match what was recorded; a file that was edited
 * keeps its old stamp and hash, and so still counts as edited.
 *
 * @param {string} root
 * @param {{
 *   renames?: readonly (readonly [string, string])[],
 *   rewrites?: { path: string, before: string, after: string }[],
 * }} [options]
 */
export async function migrateMarker(
	root,
	{ renames = SOURCE_RENAMES, rewrites = [] } = {},
) {
	const path = join(root, MARKER);
	let marker;
	try {
		marker = JSON.parse(await readFile(path, "utf8"));
	} catch {
		return 0;
	}
	const target = (old) => movedPath(old, renames);
	if (!marker?.files) return 0;
	const rewritten = new Map(rewrites.map((r) => [r.path, r]));
	const changes = Object.keys(marker.files).some(
		(old) => target(old) || rewritten.has(old),
	);
	if (!changes) return 0;
	const files = {};
	const fileStamps = {};
	for (const [old, hash] of Object.entries(marker.files)) {
		const next = target(old) ?? old;
		const rewrite = rewritten.get(next);
		const refreshed = rewrite?.before === hash;
		files[next] = refreshed ? rewrite.after : hash;
		const recorded = marker.fileStamps?.[old];
		if (!recorded) continue;
		fileStamps[next] = recorded;
		try {
			const now = await stat(join(root, next));
			if (refreshed)
				fileStamps[next] = {
					bytes: now.size,
					modifiedAt: now.mtimeMs,
					changedAt: now.ctimeMs,
				};
			else if (
				now.size === recorded.bytes &&
				now.mtimeMs === recorded.modifiedAt
			)
				fileStamps[next] = { ...recorded, changedAt: now.ctimeMs };
		} catch {}
	}
	const next = { ...marker, files };
	if (marker.fileStamps) next.fileStamps = fileStamps;
	await writeFile(path, `${JSON.stringify(next, null, "\t")}\n`);
	return Object.keys(files).length;
}

async function main() {
	const args = process.argv.slice(2);
	const dryRun = args.includes("--dry-run");
	const root =
		args.find((arg) => !arg.startsWith("--")) ??
		join(dirname(dirname(fileURLToPath(import.meta.url))), "data/source");
	if (!existsSync(root)) {
		console.log(`${root} does not exist, nothing to move`);
		return;
	}
	const { moved, conflicts, strays, rewrites } = await migrateSourceLayout(
		root,
		{ dryRun },
	);
	if (conflicts.length > 0) {
		console.error(
			`Not moved. These paths exist already, beside the old folders:\n${conflicts.map((c) => `  ${c}`).join("\n")}`,
		);
		process.exitCode = 1;
		return;
	}
	for (const [from, to] of moved) console.log(`${from} -> ${to}`);
	if (!dryRun) {
		if (rewrites.length > 0)
			console.log(`Set the id in ${rewrites.length} meta.json files`);
		const renamed = await migrateMarker(root, { rewrites });
		if (renamed > 0) console.log(`Rewrote ${renamed} paths in ${MARKER}`);
	}
	if (strays.length > 0)
		console.log(
			`Left in place, not part of any source folder:\n${strays.map((s) => `  ${s}`).join("\n")}`,
		);
	console.log(
		moved.length === 0 && rewrites.length === 0
			? "Already in the final layout"
			: `${dryRun ? "Would move" : "Moved"} ${moved.length} folders`,
	);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
	await main();
