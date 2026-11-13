/**
 * One-off, idempotent move of `data/source` from the old subject layout to
 * `<theme>/<topic>/<folder>` (docs/data-organisation.md, task 5).
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
import { dirname, join } from "node:path";
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

const MARKER = ".source-release.json";
/** Where folders wait between the two phases, so a new path can sit inside an old one. */
const HOLD = ".layout-move";

const inside = (path, folder) =>
	path === folder || path.startsWith(`${folder}/`);

/** The new path of a file in the old layout, or null if its folder did not move. */
export function movedPath(path) {
	// A path already inside a new folder that nests in its old one has moved.
	if (SOURCE_MOVES.some(([from, to]) => inside(to, from) && inside(path, to)))
		return null;
	const move = [...SOURCE_MOVES]
		.sort((a, b) => b[0].length - a[0].length)
		.find(([from]) => inside(path, from));
	return move ? move[1] + path.slice(move[0].length) : null;
}

/**
 * Moves the folders under `root`. Returns what it did and anything it could not
 * do: a folder wanted at a path that is already taken is a conflict and nothing
 * is moved until it is resolved.
 */
export async function migrateSourceLayout(root, { dryRun = false } = {}) {
	// Deepest first, so a folder nested in another leaves before its parent does.
	const moves = SOURCE_MOVES.map(([from, to], index) => ({
		from,
		to,
		index,
	})).sort((a, b) => b.from.split("/").length - a.from.split("/").length);
	const at = (path) => join(root, path);
	const held = (move) => join(root, HOLD, String(move.index));

	// A new path can sit inside its old one (`health/life-expectancy` becomes
	// `health/life-expectancy/life-expectancy`), so there the old path existing
	// beside the new one just means the folder has moved.
	const done = (move) =>
		existsSync(at(move.to)) && inside(move.to, move.from);
	const pending = moves.filter(
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
		SOURCE_MOVES.some(([, to]) => to === path || to.startsWith(`${path}/`));
	const strays = [];
	for (const dir of [...parents].sort((a, b) => b.length - a.length)) {
		if (!existsSync(at(dir))) continue;
		const left = await readdir(at(dir));
		if (left.length === 0) await rmdir(at(dir));
		else
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

/**
 * Rewrites the paths in the release marker to the new layout. The recorded
 * hashes stay. Renaming changes a file's ctime, so that one stamp is renewed
 * for each file whose size and mtime still match what was recorded; a file
 * that was edited keeps its old stamp and so still counts as edited.
 */
export async function migrateMarker(root) {
	const path = join(root, MARKER);
	let marker;
	try {
		marker = JSON.parse(await readFile(path, "utf8"));
	} catch {
		return 0;
	}
	if (!marker?.files || !Object.keys(marker.files).some(movedPath)) return 0;
	const files = {};
	const fileStamps = {};
	for (const [old, hash] of Object.entries(marker.files)) {
		const next = movedPath(old) ?? old;
		files[next] = hash;
		const recorded = marker.fileStamps?.[old];
		if (!recorded) continue;
		fileStamps[next] = recorded;
		try {
			const now = await stat(join(root, next));
			if (
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
	const { moved, conflicts, strays } = await migrateSourceLayout(root, {
		dryRun,
	});
	if (conflicts.length > 0) {
		console.error(
			`Not moved. These paths exist already, beside the old folders:\n${conflicts.map((c) => `  ${c}`).join("\n")}`,
		);
		process.exitCode = 1;
		return;
	}
	for (const [from, to] of moved) console.log(`${from} -> ${to}`);
	if (!dryRun) {
		const renamed = await migrateMarker(root);
		if (renamed > 0) console.log(`Rewrote ${renamed} paths in ${MARKER}`);
	}
	if (strays.length > 0)
		console.log(
			`Left in place, not part of any source folder:\n${strays.map((s) => `  ${s}`).join("\n")}`,
		);
	console.log(
		moved.length === 0
			? "Already in the theme layout"
			: `${dryRun ? "Would move" : "Moved"} ${moved.length} folders`,
	);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
	await main();
