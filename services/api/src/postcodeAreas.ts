import type { PostcodeIndex } from "./postcodes";
import { findSorted } from "./sortedIndex";
import { sha256 } from "./contentHash";

import {
	NONE,
	SEVERAL,
	releaseKey,
	type PostcodeAreaMatch,
	type PostcodeAreasArtifact,
	type PostcodeAreasShard,
} from "../../../shared/postcodeAreaCompiler";
export * from "../../../shared/postcodeAreaCompiler";

/** Precompiled placements of unit postcodes, a few districts at a time. */
export class PostcodeAreaIndex {
	private readonly shards = new Map<string, PostcodeAreasShard>();
	private readonly districts: string[];
	private readonly releases: Set<string>;
	private readonly verified = new Set<string>();

	constructor(
		readonly artifact: PostcodeAreasArtifact,
		private readonly postcodes: PostcodeIndex,
		/** The text of a shard at its path in the manifest. */
		private readonly readShard: (path: string) => string,
		/**
		 * How many districts stay in memory. A district's shard holds every
		 * compiled release, some tens of kilobytes parsed.
		 */
		private readonly capacity = 256,
	) {
		this.districts = artifact.shards.map((shard) => shard.district);
		this.releases = new Set(
			artifact.releases.map((release) =>
				releaseKey(release.geography, release.boundaryRelease),
			),
		);
	}

	covers(geography: string, boundaryRelease: string) {
		return this.releases.has(releaseKey(geography, boundaryRelease));
	}

	private shard(district: string): PostcodeAreasShard | undefined {
		const cached = this.shards.get(district);
		if (cached) {
			this.shards.delete(district);
			this.shards.set(district, cached);
			return cached;
		}
		const at = findSorted(this.districts, district);
		if (at === -1) return undefined;
		const entry = this.artifact.shards[at]!;
		const text = this.readShard(entry.path);
		if (!this.verified.has(entry.path)) {
			if (sha256(text) !== entry.contentHash)
				throw new Error(
					`The postcode area shard ${entry.path} does not match the postcode area index. Run pnpm --dir ../.. data:build --only postcode-areas.`,
				);
			this.verified.add(entry.path);
		}
		const shard = JSON.parse(text) as PostcodeAreasShard;
		this.shards.set(district, shard);
		if (this.shards.size > this.capacity)
			this.shards.delete(this.shards.keys().next().value!);
		return shard;
	}

	/**
	 * The areas of one release a unit postcode's centroid lies in, ordered by
	 * code, or undefined when this index does not hold that release or
	 * postcode and the answer must be found live.
	 */
	containing(
		postcode: string,
		geography: string,
		boundaryRelease: string,
	): PostcodeAreaMatch[] | undefined {
		const key = releaseKey(geography, boundaryRelease);
		if (!this.releases.has(key)) return undefined;
		const position = this.postcodes.position(postcode);
		if (!position) return undefined;
		const column = this.shard(position.district)?.releases[key];
		if (!column) return undefined;
		const area = column.area[position.at];
		if (area === undefined || area === NONE) return [];
		if (area >= 0)
			return [
				{
					code: column.codes[area]!,
					containment: "interior",
					distanceToBoundaryM: column.distanceCm[position.at]! / 100,
				},
			];
		return (column.several?.[position.at] ?? []).map(
			([codeAt, containment, distance]) => ({
				code: column.codes[codeAt]!,
				containment,
				distanceToBoundaryM: distance / 100,
			}),
		);
	}
}

export { postcodeAreaReleases } from "../../../shared/postcodeAreaReleases";
