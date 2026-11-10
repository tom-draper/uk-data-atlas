import {
	buildLog,
	configDirectory,
	formatDuration,
} from "@uk-data-atlas/atlas-db";
import { parseCrosswalkAdapters } from "@uk-data-atlas/relationships";
import { releaseKey } from "@uk-data-atlas/geography";
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { readWeightAtoms } from "./inputs.ts";
import { ensurePlacements, placementFile } from "./placements.ts";
import { weightAtomsDirectory, writeStoredAtoms } from "./storedAtoms.ts";

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
