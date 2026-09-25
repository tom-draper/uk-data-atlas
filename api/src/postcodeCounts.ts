import { createHash } from "node:crypto";
import {
	SEVERAL,
	type PostcodeAreaColumn,
	type PostcodeAreasArtifact,
	type PostcodeAreasShard,
	releaseKey,
} from "./postcodeAreas";
import type { PostcodeIndexArtifact, PostcodeShard } from "./postcodes";
import { compareCodeUnits } from "./sortedIndex";

export type PostcodeCounts = {
	/** Unit postcodes with no termination date in this ONS directory edition. */
	live: number;
	/** Unit postcodes with a termination date in this ONS directory edition. */
	terminated: number;
	/** Live unit postcodes marked as large-user postcodes. */
	largeUser: number;
	edition: string;
};

export type PostcodeCountsArtifact = {
	schemaVersion: 1;
	contentHash: string;
	postcodeIndex: string;
	postcodeAreas: string;
	releases: Array<{
		geography: string;
		boundaryRelease: string;
		/** Counts are omitted for areas with no postcode centroids. */
		areas: Record<string, Omit<PostcodeCounts, "edition">>;
	}>;
};

const sha256 = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

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

export const postcodeCountsMismatch = (
	artifact: PostcodeCountsArtifact,
	postcodeIndex: PostcodeIndexArtifact,
	postcodeAreas: PostcodeAreasArtifact,
): string | undefined => {
	if (artifact.schemaVersion !== 1 || !Array.isArray(artifact.releases))
		return "is malformed";
	const { contentHash, ...body } = artifact;
	if (sha256(JSON.stringify(body)) !== contentHash)
		return "does not match its own content hash";
	if (artifact.postcodeIndex !== postcodeIndex.contentHash)
		return "was not compiled from the current postcode index";
	if (artifact.postcodeAreas !== postcodeAreas.contentHash)
		return "was not compiled from the current postcode area index";
	return undefined;
};

/** Compact per-area counts derived from the postcode placements artifact. */
export class PostcodeCountsIndex {
	private readonly releases = new Map<
		string,
		Map<string, Omit<PostcodeCounts, "edition">>
	>();

	constructor(
		readonly artifact: PostcodeCountsArtifact,
		private readonly edition: string,
	) {
		for (const release of artifact.releases)
			this.releases.set(
				releaseKey(release.geography, release.boundaryRelease),
				new Map(Object.entries(release.areas)),
			);
	}

	forArea(
		geography: string,
		boundaryRelease: string,
		code: string,
	): PostcodeCounts | undefined {
		const areas = this.releases.get(releaseKey(geography, boundaryRelease));
		if (!areas) return undefined;
		return {
			...(areas.get(code) ?? { live: 0, terminated: 0, largeUser: 0 }),
			edition: this.edition,
		};
	}
}
