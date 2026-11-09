import {
	buildLog,
	configDirectory,
	formatCount,
	formatDuration,
	repoPath,
} from "@uk-data-atlas/atlas-runtime/storage";
import { parseCrosswalkAdapters } from "@uk-data-atlas/atlas-runtime/relationships";
import { releaseKey } from "@uk-data-atlas/geography/postcode-area-types";
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isMainThread } from "node:worker_threads";
import { readWeightAtoms } from "./crosswalk-weights/inputs.ts";
import {
	ensurePlacements,
	placementFile,
} from "./crosswalk-weights/placements.ts";
import {
	weightAtomsDirectory,
	writeStoredAtoms,
} from "./crosswalk-weights/storedAtoms.ts";

/**
 * Build the atoms crosswalk weights are summed over (see
 * crosswalk-weights/atoms.ts), keep their measures, and place them in every
 * release a `postcode-overlap` crosswalk joins, one release at a time. Those
 * crosswalks are compiled from this, so it runs before the crosswalk
 * inventory; the `crosswalk-weights` stage places the releases other
 * crosswalks need, later.
 */
export const buildWeightAtomsStage = async (
	root: string,
	options: { rebuild?: boolean } = {},
) => {
	const started = performance.now();
	const atoms = await readWeightAtoms(root);
	writeStoredAtoms(root, atoms);
	const adapters = parseCrosswalkAdapters(
		readFileSync(
			join(configDirectory(root), "crosswalk-adapters.json"),
			"utf8",
		),
		"crosswalk-adapters.json",
	);
	const releases = new Map<
		string,
		{ geography: string; boundaryRelease: string }
	>();
	for (const adapter of adapters)
		if (adapter.method === "postcode-overlap")
			for (const side of [adapter.from, adapter.to])
				releases.set(releaseKey(side.geography, side.boundaryRelease), {
					geography: side.geography,
					boundaryRelease: side.boundaryRelease,
				});
	const directory = join(weightAtomsDirectory(root), "placements");
	const placed: Array<{ release: string; seconds: number | undefined }> = [];
	await ensurePlacements(root, atoms, [...releases.values()], [directory], {
		rebuild: options.rebuild,
		onPlaced: (release, seconds) => {
			placed.push({
				release: releaseKey(release.geography, release.boundaryRelease),
				seconds,
			});
			buildLog.detail(
				seconds === undefined
					? `Reused ${releaseKey(release.geography, release.boundaryRelease)}`
					: `Placed ${releaseKey(release.geography, release.boundaryRelease)} in ${formatDuration(seconds * 1000)}`,
			);
		},
	});
	// Placements of releases no postcode-overlap crosswalk joins any more.
	const keep = new Set(
		[...releases.values()].flatMap(({ geography, boundaryRelease }) => {
			const file = placementFile(directory, geography, boundaryRelease);
			return [file, `${file}.json`];
		}),
	);
	for (const name of readdirSync(directory))
		if (!keep.has(join(directory, name)))
			rmSync(join(directory, name), { force: true });
	return {
		atoms,
		releases: releases.size,
		placed,
		seconds: (performance.now() - started) / 1000,
		directory: weightAtomsDirectory(root),
	};
};

const scriptPath = fileURLToPath(import.meta.url);
if (
	isMainThread &&
	process.argv[1] &&
	resolve(process.argv[1]) === scriptPath
) {
	const result = await buildWeightAtomsStage(
		resolve(dirname(scriptPath), "../.."),
		{ rebuild: process.argv.includes("--rebuild") },
	);
	buildLog.info(
		`Placed ${formatCount(result.atoms.count)} atoms in ${formatCount(result.releases)} releases in ${formatDuration(result.seconds * 1000)}, to ${repoPath(result.directory)}`,
	);
}
