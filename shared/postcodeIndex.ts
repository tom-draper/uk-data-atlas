import { compareCodeUnits, findSorted } from "./sortedIndex";
import { sha256 } from "./contentHash";
import {
	COUNTRY_CODES,
	NORTHERN_IRELAND_EXCLUSION,
	QUALITY,
	type ParsedPostcode,
	type QualityIndicator,
} from "./postcodeRules";
import type {
	PostcodeIndexArtifact,
	PostcodeShard,
} from "./postcodeIndexTypes";

const preGridlinkAccuracyM = (country: string) =>
	Math.round(
		(country === "E" || country === "W" ? 50 : 5) * Math.SQRT2 * 100,
	) / 100;

export type PostcodeCentroid = {
	crs: "EPSG:27700" | "EPSG:29902";
	easting: number;
	northing: number;
	positionalQuality: QualityIndicator;
};

export type PostcodeRecord = {
	postcode: string;
	status: "live" | "terminated";
	/** YYYY-MM */
	introduced: string;
	/** YYYY-MM, when terminated. */
	terminated?: string;
	userType: "small" | "large";
	/** The country code the directory assigns, including the Crown Dependencies. */
	country: string;
	centroid: PostcodeCentroid | null;
};

const month = (yyyymm: number) =>
	`${String(yyyymm).slice(0, 4)}-${String(yyyymm).slice(4, 6)}`;

export { postcodeIndexMismatch } from "./postcodeIndexMismatch";

export type PostcodeLookup =
	| { status: "found"; record: PostcodeRecord }
	| { status: "excluded"; reason: string }
	| { status: "not-found" };

/** Unit postcodes read through a hash-checked district reader, a few districts at a time. */
export class PostcodeIndex {
	private readonly shards = new Map<string, PostcodeShard>();
	private readonly districts: string[];
	/** Shards already checked against the manifest; a re-read need not be. */
	private readonly verified = new Set<string>();

	constructor(
		readonly artifact: PostcodeIndexArtifact,
		/** The text of a shard at its path in the manifest. */
		private readonly readShard: (path: string) => string,
		/**
		 * How many districts stay in memory. A district averages some 900
		 * postcodes and the largest holds a few thousand, so this is a few
		 * tens of megabytes at most.
		 */
		private readonly capacity = 512,
	) {
		this.districts = artifact.shards.map((shard) => shard.district);
	}

	private shard(district: string): PostcodeShard | undefined {
		const cached = this.shards.get(district);
		if (cached) {
			// Most recently used last, so the first entry is evicted first.
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
					`The postcode shard ${entry.path} does not match the postcode index. Run pnpm --dir ../.. data:build --only postcode-index.`,
				);
			this.verified.add(entry.path);
		}
		const shard = JSON.parse(text) as PostcodeShard;
		this.shards.set(district, shard);
		if (this.shards.size > this.capacity)
			this.shards.delete(this.shards.keys().next().value!);
		return shard;
	}

	/** Where a compact unit postcode sits: its district and position there. */
	position(postcode: string): { district: string; at: number } | undefined {
		const district = postcode.slice(0, -3);
		const shard = this.shard(district);
		if (!shard) return undefined;
		const at = findSorted(shard.postcodes, postcode);
		return at === -1 ? undefined : { district, at };
	}

	lookup(
		postcode: Extract<ParsedPostcode, { kind: "unit" }>,
	): PostcodeLookup {
		const shard = this.shard(postcode.district);
		if (!shard) {
			const excluded = this.artifact.excluded.find(
				(entry) => entry.area === postcode.area,
			);
			if (excluded)
				return { status: "excluded", reason: excluded.reason };
			// The stored directory has its Northern Ireland rows removed before
			// the index is built, so they leave no exclusion behind. Every
			// Northern Ireland postcode is in the BT area, and only they are.
			return postcode.area === "BT"
				? { status: "excluded", reason: NORTHERN_IRELAND_EXCLUSION }
				: { status: "not-found" };
		}
		const at = findSorted(shard.postcodes, postcode.compact);
		if (at === -1) return { status: "not-found" };
		const quality = shard.quality[at]!;
		const country = shard.country[at]!;
		const easting = shard.grid[at * 2];
		const northing = shard.grid[at * 2 + 1];
		const terminated = shard.terminated[at]!;
		return {
			status: "found",
			record: {
				postcode: postcode.display,
				status: terminated ? "terminated" : "live",
				introduced: month(shard.introduced[at]!),
				...(terminated ? { terminated: month(terminated) } : {}),
				userType: shard.largeUser[at] === "1" ? "large" : "small",
				country: COUNTRY_CODES[country]!,
				centroid:
					easting == null || northing == null
						? null
						: {
								crs:
									country === "N"
										? "EPSG:29902"
										: "EPSG:27700",
								easting,
								northing,
								positionalQuality: {
									indicator: Number(quality),
									...QUALITY[quality]!,
									...(quality === "8"
										? {
												accuracyM:
													preGridlinkAccuracyM(
														country,
													),
											}
										: {}),
								},
							},
			},
		};
	}
}
