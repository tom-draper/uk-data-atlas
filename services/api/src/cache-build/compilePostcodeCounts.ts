import {
	SEVERAL,
	releaseKey,
	type PostcodeAreaColumn,
	type PostcodeAreasArtifact,
	type PostcodeAreasShard,
} from "@uk-data-atlas/geography/postcode-area-types";
import type {
	PostcodeIndexArtifact,
	PostcodeShard,
} from "@uk-data-atlas/geography/postcode-index-types";
import type {
	PostcodeCounts,
	PostcodeCountsArtifact,
} from "@uk-data-atlas/geography/postcode-count-types";
import { compareCodeUnits } from "@uk-data-atlas/search-index";
import { sha256 } from "@uk-data-atlas/artifacts";

const add = (
	areas: Map<string, Omit<PostcodeCounts, "edition">>,
	code: string,
	postcode: PostcodeShard,
	at: number,
) => {
	const counts = areas.get(code) ?? { live: 0, terminated: 0, largeUser: 0 };
	if (postcode.terminated[at] === 0) {
		counts.live += 1;
		if (postcode.largeUser[at] === "1") counts.largeUser += 1;
	} else counts.terminated += 1;
	areas.set(code, counts);
};

const addColumn = (
	areas: Map<string, Omit<PostcodeCounts, "edition">>,
	column: PostcodeAreaColumn,
	postcode: PostcodeShard,
) => {
	column.area.forEach((area, at) => {
		if (area >= 0) add(areas, column.codes[area]!, postcode, at);
		else if (area === SEVERAL)
			for (const [codeAt] of column.several?.[at] ?? [])
				add(areas, column.codes[codeAt]!, postcode, at);
	});
};

/** Aggregate the precompiled postcode placements without loading geometry. */
export const compilePostcodeCounts = (
	postcodeIndex: PostcodeIndexArtifact,
	postcodeAreas: PostcodeAreasArtifact,
	readPostcodeShard: (path: string) => PostcodeShard,
	readPostcodeAreaShard: (path: string) => PostcodeAreasShard,
): PostcodeCountsArtifact => {
	if (postcodeAreas.postcodeIndex !== postcodeIndex.contentHash)
		throw new Error(
			"The postcode area index was not compiled from the current postcode index.",
		);
	if (postcodeAreas.shards.length !== postcodeIndex.shards.length)
		throw new Error(
			"The postcode and postcode area indexes have different shard counts.",
		);
	const areasByRelease = new Map<
		string,
		Map<string, Omit<PostcodeCounts, "edition">>
	>();
	for (let at = 0; at < postcodeIndex.shards.length; at += 1) {
		const postcodeEntry = postcodeIndex.shards[at]!;
		const areaEntry = postcodeAreas.shards[at];
		if (!areaEntry || areaEntry.district !== postcodeEntry.district)
			throw new Error(
				`Postcode area shard order does not match ${postcodeEntry.district}.`,
			);
		const postcodeShard = readPostcodeShard(postcodeEntry.path);
		const areaShard = readPostcodeAreaShard(areaEntry.path);
		if (
			areaShard.postcodeShard !== postcodeEntry.contentHash ||
			areaShard.district !== postcodeEntry.district ||
			postcodeShard.postcodes.length !== postcodeEntry.postcodes
		)
			throw new Error(
				`Postcode area shard ${areaEntry.path} was not built from the current postcode shard.`,
			);
		for (const release of postcodeAreas.releases) {
			const key = releaseKey(release.geography, release.boundaryRelease);
			const column = areaShard.releases[key];
			if (!column)
				throw new Error(
					`Postcode area shard ${areaEntry.path} has no ${key} column.`,
				);
			if (
				column.area.length !== postcodeEntry.postcodes ||
				column.distanceCm.length !== postcodeEntry.postcodes
			)
				throw new Error(
					`Postcode area shard ${areaEntry.path} has invalid column lengths for ${key}.`,
				);
			const areas = areasByRelease.get(key) ?? new Map();
			areasByRelease.set(key, areas);
			addColumn(areas, column, postcodeShard);
		}
	}
	const releases = postcodeAreas.releases
		.map(({ geography, boundaryRelease }) => {
			const areas = areasByRelease.get(
				releaseKey(geography, boundaryRelease),
			);
			return {
				geography,
				boundaryRelease,
				areas: Object.fromEntries(
					[...(areas ?? new Map())].sort(([left], [right]) =>
						compareCodeUnits(left, right),
					),
				),
			};
		})
		.sort((left, right) =>
			compareCodeUnits(
				releaseKey(left.geography, left.boundaryRelease),
				releaseKey(right.geography, right.boundaryRelease),
			),
		);
	const body = {
		schemaVersion: 1 as const,
		postcodeIndex: postcodeIndex.contentHash,
		postcodeAreas: postcodeAreas.contentHash,
		releases,
	};
	return { ...body, contentHash: sha256(JSON.stringify(body)) };
};
