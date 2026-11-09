import {
	NONE,
	SEVERAL,
	releaseKey,
	type PostcodeAreasArtifact,
	type PostcodeAreasShard,
} from "@uk-data-atlas/geography/postcode-area-types";
import { distanceToBoundaryM } from "@uk-data-atlas/geography/area-distance";
import { createAreaGeometryCache } from "@uk-data-atlas/geometry";
import { sha256 } from "@uk-data-atlas/artifacts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readPostcodeCoordinates } from "../postcodes/postcodeCoordinates.ts";
import {
	placementsFromShards,
	toCentimetres,
	type ReleasePlacements,
} from "../postcodes/postcodeAreaCompiler.ts";
import {
	postcodeAreasDirectory,
	readPostcodeAreaComponent,
} from "../postcodes/storePostcodeAreas.ts";

/** What a live lookup finds for a point: area code, containment and distance. */
export type LiveLookup = (
	at: number,
	point: [number, number],
) => Array<[string, string, number]>;

/**
 * Check a release's stored placements against a live lookup, for every
 * `every`th postcode and for every postcode in several areas. Throws at the
 * first difference, and returns how many postcodes it checked.
 */
export function checkPlacements(
	key: string,
	placements: ReleasePlacements,
	longitudes: Float64Array,
	latitudes: Float64Array,
	live: LiveLookup,
	every: number,
): number {
	const expected = (at: number) => {
		const area = placements.area[at]!;
		if (area === NONE) return [];
		if (area === SEVERAL)
			return placements.several
				.get(at)!
				.map(([codeAt, containment, distance]) => [
					placements.codes[codeAt]!,
					containment,
					distance,
				]);
		return [
			[placements.codes[area]!, "interior", placements.distanceCm[at]!],
		];
	};
	let checked = 0;
	const check = (at: number) => {
		const point: [number, number] = [longitudes[at]!, latitudes[at]!];
		const found = live(at, point);
		const stored = expected(at);
		if (JSON.stringify(found) !== JSON.stringify(stored))
			throw new Error(
				`${key}: point ${at} at ${point.join(",")} is placed in ${JSON.stringify(stored)}, but a live lookup finds ${JSON.stringify(found)}.`,
			);
		checked += 1;
	};
	for (let at = 0; at < longitudes.length; at += every)
		if (!Number.isNaN(longitudes[at]!)) check(at);
	for (const at of placements.several.keys()) check(at);
	return checked;
}

/**
 * Check the postcode areas the build stored against a live containment test,
 * one release at a time. The build places each postcode once; this reads the
 * stored shards back and asks the geometry again for a sample.
 */
export function verifyPostcodeAreas(
	repositoryRoot: string,
	{ every = 5_000 }: { every?: number } = {},
) {
	const { postcodeArtifact, lng, lat } =
		readPostcodeCoordinates(repositoryRoot);
	const manifest = JSON.parse(
		readFileSync(
			join(postcodeAreasDirectory(repositoryRoot), "manifest.json"),
			"utf8",
		),
	) as PostcodeAreasArtifact;
	if (manifest.postcodeIndex !== postcodeArtifact.contentHash)
		throw new Error(
			"The postcode areas were built from a different postcode index.",
		);
	const keys = manifest.releases.map((release) =>
		releaseKey(release.geography, release.boundaryRelease),
	);
	const count = postcodeArtifact.counts.postcodes;
	const shards = function* () {
		let offset = 0;
		for (const [index, entry] of manifest.shards.entries()) {
			const text = readPostcodeAreaComponent(repositoryRoot, entry.path);
			if (sha256(text) !== entry.contentHash)
				throw new Error(`Invalid postcode area shard ${entry.path}`);
			yield { offset, shard: JSON.parse(text) as PostcodeAreasShard };
			offset += postcodeArtifact.shards[index]!.postcodes;
		}
	};
	const placed = placementsFromShards(keys, shards(), count);
	const cache = createAreaGeometryCache(repositoryRoot, 1);
	let checked = 0;
	for (const release of manifest.releases) {
		const { geography, boundaryRelease } = release;
		const key = releaseKey(geography, boundaryRelease);
		checked += checkPlacements(
			key,
			placed.get(key)!,
			lng,
			lat,
			(_at, point) =>
				cache
					.findContaining(geography, boundaryRelease, point)
					.map(({ code, containment }) => [
						code,
						containment,
						toCentimetres(
							distanceToBoundaryM(
								point,
								cache.get(geography, boundaryRelease, code)!,
							),
						),
					]),
			every,
		);
	}
	return { releases: manifest.releases.length, checked };
}
