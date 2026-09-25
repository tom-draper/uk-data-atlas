import { createHash } from "node:crypto";
import { parseLookupCoordinate, type LookupPoint } from "./pointLookup";
import { compareCodeUnits, findSorted } from "./sortedIndex";

/**
 * The compiled postcode index: every unit postcode in the ONS Postcode
 * Directory, with the grid reference of its centroid, how that centroid was
 * placed and when the postcode was in use.
 *
 * It records where a postcode is, not which areas it falls in. Areas come
 * from testing the centroid against the Atlas's own boundary releases, so a
 * postcode resolves into every geography and vintage the Atlas holds, by the
 * same method and with the same caveats as any other point.
 *
 * The directory is too large to hold in memory, so postcodes are sharded by
 * postcode district (the outward code, such as SW1A) and a shard is read on
 * first use. A district holds some 900 postcodes on average, so a lookup reads
 * a few kilobytes, and a batch spread across the country keeps every district
 * it touches in memory at once. The manifest records each shard's hash, so pinning the manifest pins
 * every shard, and a shard that no longer matches it is refused.
 */
export type PostcodeIndexArtifact = {
	schemaVersion: 1;
	contentHash: string;
	source: PostcodeSource;
	/** Postcode areas the directory holds and this index deliberately omits. */
	excluded: Array<{ area: string; postcodes: number; reason: string }>;
	counts: {
		postcodes: number;
		live: number;
		terminated: number;
		withoutGridReference: number;
	};
	/** Sorted by district. */
	shards: Array<{
		district: string;
		path: string;
		postcodes: number;
		contentHash: string;
	}>;
};

export type PostcodeSource = {
	title: string;
	/** The directory's edition, as YYYY-MM. */
	edition: string;
	publisher: string;
	sourceUrl: string;
	retrieved: string;
	/** The SHA-256 of the permitted, filtered source file. */
	sha256: string;
	licence: { name: string; url: string };
	/** Statements the licence requires wherever the data is used. */
	attribution: string[];
};

/**
 * One postcode district, stored column by column: position `i` of every
 * column describes `postcodes[i]`.
 */
export type PostcodeShard = {
	schemaVersion: 1;
	district: string;
	/** Compact unit postcodes such as "AB10AA", sorted by code unit. */
	postcodes: string[];
	/** Easting then northing in whole metres for each postcode, or null twice. */
	grid: Array<number | null>;
	/** The directory's positional quality indicator, one digit per postcode. */
	quality: string;
	/** The first letter of the directory's country code, one per postcode. */
	country: string;
	/** Introduction month as YYYYMM. */
	introduced: number[];
	/** Termination month as YYYYMM, or 0 while the postcode is live. */
	terminated: number[];
	/** "1" where the postcode serves a single large user. */
	largeUser: string;
};

/** The fields of one directory row the index is compiled from. */
export type PostcodeSourceRow = {
	pcds: string;
	dointr: string;
	doterm: string;
	usrtypind: string;
	east1m: string;
	north1m: string;
	gridind: string;
	ctry: string;
};

/**
 * Northern Ireland postcodes come from Land and Property Services, whose
 * licence allows internal business use only. A public API cannot serve them.
 */
export const NORTHERN_IRELAND_EXCLUSION =
	"Northern Ireland postcodes are licensed by Land and Property Services for internal business use only, so this API does not serve them.";

const sha256 = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

const UNIT =
	/^(?:[A-Z]{1,2}[0-9][0-9A-Z]?[0-9][A-Z]{2}|GIR0AA|NPT[0-9][A-Z]{2})$/;
const DISTRICT = /^[A-Z]{1,2}[0-9][0-9A-Z]?$/;
const SECTOR = /^[A-Z]{1,2}[0-9][0-9A-Z]?[0-9]$/;

export type ParsedPostcode =
	| {
			kind: "unit";
			compact: string;
			display: string;
			/** The letters a postcode begins with, such as SW. */
			area: string;
			/** The outward code, such as SW1A. */
			district: string;
	  }
	| { kind: "district" | "sector"; display: string };

/**
 * Read a postcode however it was typed: any case, with or without its space.
 * A district ("M1") or sector ("M1 1") is recognised as such, so a caller can
 * be told a unit postcode is needed rather than that it does not exist.
 */
export const parsePostcode = (input: string): ParsedPostcode | undefined => {
	const compact = input.toUpperCase().replace(/\s+/g, "");
	if (UNIT.test(compact))
		return {
			kind: "unit",
			compact,
			display: `${compact.slice(0, -3)} ${compact.slice(-3)}`,
			area: /^[A-Z]+/.exec(compact)![0],
			district: compact.slice(0, -3),
		};
	if (DISTRICT.test(compact)) return { kind: "district", display: compact };
	if (SECTOR.test(compact))
		return {
			kind: "sector",
			display: `${compact.slice(0, -1)} ${compact.slice(-1)}`,
		};
	return undefined;
};

/** A unit postcode as the index keys it, "SW1A 1AA" as "SW1A1AA". */
export const compactPostcode = (postcode: string) =>
	postcode.replace(/\s+/g, "").toUpperCase();

type QualityIndicator = {
	indicator: number;
	description: string;
	/**
	 * How far the centroid may lie from where the directory means it to be,
	 * in metres, when the directory says. Null where it does not.
	 */
	accuracyM: number | null;
};

// The directory's own descriptions of each positional quality indicator.
const QUALITY: Record<string, Omit<QualityIndicator, "indicator">> = {
	"1": {
		description:
			"Within the building of the matched address closest to the postcode mean.",
		accuracyM: 0.5,
	},
	"2": {
		description:
			"Within the building of the matched address closest to the postcode mean, placed by visual inspection of Landline maps.",
		accuracyM: 0.5,
	},
	"3": { description: "Approximate to within 50 metres.", accuracyM: 50 },
	"4": {
		description:
			"The mean of the postcode's matched addresses, not snapped to a building.",
		accuracyM: 0.5,
	},
	"5": {
		description:
			"Imputed by ONS by reference to surrounding postcodes' grid references.",
		accuracyM: null,
	},
	"6": {
		description: "The mean of the postcode sector, mainly for PO Boxes.",
		accuracyM: null,
	},
	// England and Wales grid references from before November 2000 are to
	// 100 metres, the rest of the UK's to 10: the error is half a cell's
	// diagonal.
	"8": {
		description:
			"Terminated before November 2000; the last grid reference ONS knew.",
		accuracyM: null,
	},
	"9": { description: "No grid reference is available.", accuracyM: null },
};

const preGridlinkAccuracyM = (country: string) =>
	Math.round(
		(country === "E" || country === "W" ? 50 : 5) * Math.SQRT2 * 100,
	) / 100;

/** The GSS codes the directory gives the countries it covers. */
const COUNTRY_CODES: Record<string, string> = {
	E: "E92000001",
	W: "W92000004",
	S: "S92000003",
	N: "N92000002",
	L: "L93000001",
	M: "M83000003",
};

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

const monthNumber = (text: string, field: string, postcode: string) => {
	if (!/^\d{6}$/.test(text))
		throw new Error(
			`${postcode}: ${field} ${JSON.stringify(text)} is not YYYYMM`,
		);
	return Number(text);
};

/**
 * Compile directory rows into shard files and the manifest that pins them.
 * Northern Ireland is left out unless `includeNorthernIreland` is set, for a
 * build that will not be served publicly.
 */
export const compilePostcodeIndex = (
	rows: Iterable<PostcodeSourceRow>,
	source: PostcodeSource,
	options: { includeNorthernIreland?: boolean } = {},
): {
	artifact: PostcodeIndexArtifact;
	files: Array<{ path: string; text: string }>;
} => {
	type Entry = {
		compact: string;
		grid: [number, number] | null;
		quality: string;
		country: string;
		introduced: number;
		terminated: number;
		largeUser: boolean;
	};
	const byDistrict = new Map<string, Entry[]>();
	const excluded = new Map<string, number>();
	for (const row of rows) {
		const parsed = parsePostcode(row.pcds);
		if (parsed?.kind !== "unit" || parsed.display !== row.pcds)
			throw new Error(
				`${JSON.stringify(row.pcds)} is not a unit postcode`,
			);
		const country = row.ctry.charAt(0);
		if (!(country in COUNTRY_CODES))
			throw new Error(`${row.pcds}: unknown country ${row.ctry}`);
		if (country === "N" && !options.includeNorthernIreland) {
			excluded.set(parsed.area, (excluded.get(parsed.area) ?? 0) + 1);
			continue;
		}
		if (!(row.gridind in QUALITY))
			throw new Error(`${row.pcds}: unknown gridind ${row.gridind}`);
		const hasGrid = row.gridind !== "9";
		if (hasGrid !== (row.east1m !== "" && row.north1m !== ""))
			throw new Error(
				`${row.pcds}: gridind ${row.gridind} disagrees with its grid reference`,
			);
		const entries = byDistrict.get(parsed.district) ?? [];
		byDistrict.set(parsed.district, entries);
		entries.push({
			compact: parsed.compact,
			grid: hasGrid ? [Number(row.east1m), Number(row.north1m)] : null,
			quality: row.gridind,
			country,
			introduced: monthNumber(row.dointr, "dointr", row.pcds),
			terminated:
				row.doterm === ""
					? 0
					: monthNumber(row.doterm, "doterm", row.pcds),
			largeUser: row.usrtypind === "1",
		});
	}
	const counts = {
		postcodes: 0,
		live: 0,
		terminated: 0,
		withoutGridReference: 0,
	};
	const files: Array<{ path: string; text: string }> = [];
	const shards: PostcodeIndexArtifact["shards"] = [];
	for (const district of [...byDistrict.keys()].sort(compareCodeUnits)) {
		const entries = byDistrict
			.get(district)!
			.sort((left, right) =>
				compareCodeUnits(left.compact, right.compact),
			);
		for (let at = 1; at < entries.length; at += 1)
			if (entries[at]!.compact === entries[at - 1]!.compact)
				throw new Error(`${entries[at]!.compact} appears twice`);
		const shard: PostcodeShard = {
			schemaVersion: 1,
			district,
			postcodes: entries.map((entry) => entry.compact),
			grid: entries.flatMap((entry) => entry.grid ?? [null, null]),
			quality: entries.map((entry) => entry.quality).join(""),
			country: entries.map((entry) => entry.country).join(""),
			introduced: entries.map((entry) => entry.introduced),
			terminated: entries.map((entry) => entry.terminated),
			largeUser: entries
				.map((entry) => (entry.largeUser ? "1" : "0"))
				.join(""),
		};
		const text = `${JSON.stringify(shard)}\n`;
		const path = `postcodes/${/^[A-Z]+/.exec(district)![0]}/${district}.json`;
		files.push({ path, text });
		shards.push({
			district,
			path,
			postcodes: entries.length,
			contentHash: sha256(text),
		});
		for (const entry of entries) {
			counts.postcodes += 1;
			if (entry.terminated) counts.terminated += 1;
			else counts.live += 1;
			if (!entry.grid) counts.withoutGridReference += 1;
		}
	}
	const body = {
		schemaVersion: 1 as const,
		source,
		excluded: [...excluded.entries()]
			.sort(([left], [right]) => compareCodeUnits(left, right))
			.map(([area, postcodes]) => ({
				area,
				postcodes,
				reason: NORTHERN_IRELAND_EXCLUSION,
			})),
		counts,
		shards,
	};
	return {
		artifact: { ...body, contentHash: sha256(JSON.stringify(body)) },
		files,
	};
};

/** Whether a manifest can be served. Undefined when it can. */
export const postcodeIndexMismatch = (
	artifact: PostcodeIndexArtifact,
): string | undefined => {
	if (
		artifact.schemaVersion !== 1 ||
		typeof artifact.source?.edition !== "string" ||
		!Array.isArray(artifact.shards) ||
		!Array.isArray(artifact.excluded)
	)
		return "is malformed";
	const { contentHash, ...body } = artifact;
	if (sha256(JSON.stringify(body)) !== contentHash)
		return "does not match its own content hash";
	return undefined;
};

export type PostcodeLookup =
	| { status: "found"; record: PostcodeRecord }
	| { status: "excluded"; reason: string }
	| { status: "not-found" };

/** Unit postcodes read from the shards a manifest pins, a few districts at a time. */
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
					`The postcode shard ${entry.path} does not match the postcode index. Run pnpm build:postcode-index.`,
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
			return excluded
				? { status: "excluded", reason: excluded.reason }
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

/**
 * The postcode's centroid as a lookup point. Where the directory states the
 * centroid's accuracy it becomes the point's; where it does not, the point
 * carries only the precision of its grid reference, and the caller must say
 * that its boundary tolerance is understated.
 */
export const postcodeLookupPoint = (
	centroid: PostcodeCentroid,
): LookupPoint => {
	const { accuracyM } = centroid.positionalQuality;
	return parseLookupCoordinate(
		centroid.crs,
		{
			easting: String(centroid.easting),
			northing: String(centroid.northing),
		},
		accuracyM === null || accuracyM <= 0.5 ? undefined : accuracyM,
	)!;
};
