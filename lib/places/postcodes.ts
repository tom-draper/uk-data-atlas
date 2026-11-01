/**
 * Postcode districts for the /places pages: each district's live postcodes,
 * sectors, and the councils, wards and constituencies its postcodes fall in.
 * Compiled from the API's postcode index and postcode area index by
 * `scripts/build-seo-data.mts`, as reading them means scanning every
 * postcode in the UK.
 *
 * A postcode is placed by one centroid, so an area holding a district's
 * postcodes need not hold all of their addresses. Districts have no official
 * boundary, so a page draws the wards its postcodes fall in.
 */

import type { BoundingBox } from "@uk-data-atlas/catalogue/place-profile";

export const POSTCODE_GEOGRAPHIES = [
	"localAuthority",
	"ward",
	"constituency",
] as const;

export type PostcodeGeography = (typeof POSTCODE_GEOGRAPHIES)[number];

/** Area code and the live postcodes in it, most first. */
export type AreaShare = [code: string, live: number][];

/** The deprivation indices, each published by neighbourhood for one nation. */
export const DEPRIVATION_INDICES = ["imd", "wimd", "simd"] as const;

export type DeprivationIndex = (typeof DEPRIVATION_INDICES)[number];

/** Each index's neighbourhoods, and the fields its rows hold. */
export const DEPRIVATION: Record<
	DeprivationIndex,
	{
		geography: string;
		/** The year its neighbourhoods' boundaries are from. */
		year: string;
		name: string;
		rank: string;
		decile: string;
	}
> = {
	imd: {
		geography: "lsoa",
		year: "2021",
		name: "lsoaName",
		rank: "imdRank",
		decile: "imdDecile",
	},
	wimd: {
		geography: "lsoa",
		year: "2011",
		name: "lsoaName",
		rank: "wimdRank",
		decile: "wimdDecile",
	},
	simd: {
		geography: "dataZone",
		year: "2011",
		name: "dzName",
		rank: "simdRank",
		decile: "simdDecile",
	},
};

/**
 * Each index's neighbourhoods by code, from its latest edition: a name, a
 * rank where 1 is the most deprived of `total`, and a decile.
 */
export type PlaceNeighbourhoods = Record<
	DeprivationIndex,
	{
		edition: string;
		total: number;
		areas: Record<string, [name: string, rank: number, decile: number]>;
	}
>;

type AreaRelease = {
	geography: string;
	boundaryRelease: string;
	purposes: readonly string[];
};

/**
 * The postcode area releases a page reads, keyed as the area shards key
 * them: each geography's default lookup, and each deprivation index's
 * neighbourhoods.
 */
export function postcodeReleases(releases: readonly AreaRelease[]) {
	const key = (release: AreaRelease | undefined, what: string) => {
		if (!release) throw new Error(`No postcode release for ${what}`);
		return `${release.geography}/${release.boundaryRelease}`;
	};
	return {
		areas: Object.fromEntries(
			POSTCODE_GEOGRAPHIES.map((geography) => [
				geography,
				key(
					releases.find(
						(entry) =>
							entry.geography === geography &&
							entry.purposes.includes("default-lookup"),
					),
					geography,
				),
			]),
		) as Record<PostcodeGeography, string>,
		deprivation: Object.fromEntries(
			DEPRIVATION_INDICES.map((index) => {
				const { geography, year } = DEPRIVATION[index];
				return [
					index,
					key(
						releases.find(
							(entry) =>
								entry.geography === geography &&
								entry.boundaryRelease.startsWith(year),
						),
						`${geography} ${year}`,
					),
				];
			}),
		) as Record<DeprivationIndex, string>,
	};
}

/** One release's placements for a district, as its area shard holds them. */
export type AreaColumn = {
	codes: string[];
	area: number[];
	several?: Record<string, ReadonlyArray<readonly [number, ...unknown[]]>>;
};

/** The area a district's postcode is placed in, the first where it lies on an edge. */
export function areaCodeAt(column: AreaColumn | undefined, at: number) {
	if (!column) return undefined;
	const position =
		column.area[at]! >= 0
			? column.area[at]
			: column.several?.[at]?.[0]?.[0];
	return position === undefined ? undefined : column.codes[position];
}

/** A district's or sector's postcodes, as a page shows them. */
export type PostcodeGroup = {
	live: number;
	terminated: number;
	/** Live postcodes serving a single large user, such as a business. */
	largeUser: number;
	/** Around the live postcodes' centroids, in WGS 84. */
	bbox: BoundingBox;
	areas: Record<PostcodeGeography, AreaShare>;
	/**
	 * Live postcodes by the deprivation decile of the neighbourhood each falls
	 * in, most deprived first, for each index that covers any of them.
	 */
	deprivation: Partial<Record<DeprivationIndex, number[]>>;
	/** The districts or sectors with the nearest centres, nearest first. */
	nearby: string[];
	/** A live postcode in it, for an example request. */
	example: string;
};

export type PostcodeDistrict = PostcodeGroup & {
	/** Each sector, as "LS6 1", and its live postcodes, in order. */
	sectors: [sector: string, live: number][];
};

export type PostcodeSource = {
	title: string;
	edition: string;
	attribution: string[];
};

export type PostcodeDistricts = {
	source: PostcodeSource;
	districts: Record<string, PostcodeDistrict>;
};

export type PostcodeSectors = {
	source: PostcodeSource;
	/** Keyed as written, "LS6 1". */
	sectors: Record<string, PostcodeGroup>;
};

/** One district's postcodes, column by column as the postcode index holds them. */
export type SourceDistrict = {
	district: string;
	/** Compact unit postcodes such as "LS61AA". */
	postcodes: string[];
	/** Easting then northing for each postcode, or null twice. */
	grid: (number | null)[];
	/** Termination month, or 0 while live. */
	terminated: number[];
	largeUser: string;
	/** For each geography, the position in `codes` of each postcode's area, or below 0 for none. */
	areas: Record<PostcodeGeography, AreaColumn>;
	/** Each postcode's neighbourhood deprivation decile, where an index covers it. */
	deprivation?: (readonly [DeprivationIndex, number] | undefined)[];
};

const NEARBY = 6;

/** Districts in reading order: letters, then number, then any final letter. */
export const compareDistricts = (a: string, b: string) => {
	const parts = (district: string) => {
		const [, letters = "", digits = "", rest = ""] =
			/^([A-Z]+)(\d+)(.*)$/.exec(district) ?? [];
		return [letters, Number(digits), rest] as const;
	};
	const [la, na, ra] = parts(a);
	const [lb, nb, rb] = parts(b);
	return la.localeCompare(lb) || na - nb || ra.localeCompare(rb);
};

const round4 = (value: number) => Math.round(value * 1e4) / 1e4;

/** A running total of one district's or sector's live postcodes. */
class Tally {
	live = 0;
	terminated = 0;
	largeUser = 0;
	example?: string;
	shares = Object.fromEntries(
		POSTCODE_GEOGRAPHIES.map((geography) => [
			geography,
			new Map<string, number>(),
		]),
	) as Record<PostcodeGeography, Map<string, number>>;
	deprivation: Partial<Record<DeprivationIndex, number[]>> = {};
	grid = [Infinity, Infinity, -Infinity, -Infinity, 0, 0, 0];

	add(source: SourceDistrict, at: number, codes: (string | undefined)[]) {
		if (source.terminated[at] !== 0) {
			this.terminated += 1;
			return;
		}
		this.live += 1;
		this.example ??= source.postcodes[at];
		if (source.largeUser[at] === "1") this.largeUser += 1;
		const easting = source.grid[at * 2];
		const northing = source.grid[at * 2 + 1];
		if (typeof easting === "number" && typeof northing === "number") {
			const grid = this.grid;
			grid[0] = Math.min(grid[0]!, easting);
			grid[1] = Math.min(grid[1]!, northing);
			grid[2] = Math.max(grid[2]!, easting);
			grid[3] = Math.max(grid[3]!, northing);
			grid[4]! += easting;
			grid[5]! += northing;
			grid[6]! += 1;
		}
		POSTCODE_GEOGRAPHIES.forEach((geography, index) => {
			const code = codes[index];
			if (code)
				this.shares[geography].set(
					code,
					(this.shares[geography].get(code) ?? 0) + 1,
				);
		});
		const decile = source.deprivation?.[at];
		if (decile) {
			const [index, value] = decile;
			(this.deprivation[index] ??= Array(10).fill(0))[value - 1] += 1;
		}
	}

	/** The group, or undefined with no live, placed postcode. */
	finish(
		toLngLat: (easting: number, northing: number) => [number, number],
	): [PostcodeGroup, centre: [number, number]] | undefined {
		const [minE, minN, maxE, maxN, sumE, sumN, placed] = this.grid as [
			number,
			number,
			number,
			number,
			number,
			number,
			number,
		];
		if (this.live === 0 || placed === 0 || !this.example) return undefined;
		const corners = [
			toLngLat(minE, minN),
			toLngLat(minE, maxN),
			toLngLat(maxE, minN),
			toLngLat(maxE, maxN),
		];
		const lngs = corners.map(([lng]) => lng);
		const lats = corners.map(([, lat]) => lat);
		return [
			{
				live: this.live,
				terminated: this.terminated,
				largeUser: this.largeUser,
				bbox: [
					round4(Math.min(...lngs)),
					round4(Math.min(...lats)),
					round4(Math.max(...lngs)),
					round4(Math.max(...lats)),
				],
				areas: Object.fromEntries(
					POSTCODE_GEOGRAPHIES.map((geography) => [
						geography,
						[...this.shares[geography]].sort(
							(a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
						),
					]),
				) as Record<PostcodeGeography, AreaShare>,
				deprivation: this.deprivation,
				nearby: [],
				example: `${this.example.slice(0, -3)} ${this.example.slice(-3)}`,
			},
			[sumE / placed, sumN / placed],
		];
	}
}

/** Each group's nearest others by centre, in place. */
function setNearby(
	groups: Record<string, PostcodeGroup>,
	centres: [name: string, easting: number, northing: number][],
) {
	// Sorted by easting, so each search stops once the gap alone is too far.
	const sorted = [...centres].sort((a, b) => a[1] - b[1]);
	sorted.forEach(([name, easting, northing], at) => {
		const best: [string, number][] = [];
		const consider = (other: (typeof sorted)[number]) => {
			const distance =
				(other[1] - easting) ** 2 + (other[2] - northing) ** 2;
			if (best.length === NEARBY && distance >= best.at(-1)![1]) return;
			best.push([other[0], distance]);
			best.sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
			if (best.length > NEARBY) best.pop();
		};
		const far = (other: (typeof sorted)[number]) =>
			best.length === NEARBY &&
			(other[1] - easting) ** 2 >= best.at(-1)![1];
		for (let i = at + 1; i < sorted.length && !far(sorted[i]!); i++)
			consider(sorted[i]!);
		for (let i = at - 1; i >= 0 && !far(sorted[i]!); i--)
			consider(sorted[i]!);
		groups[name]!.nearby = best.map(([other]) => other);
	});
}

/**
 * Every district and sector with a live postcode. `toLngLat` turns a British
 * National Grid easting and northing into WGS 84 longitude and latitude.
 */
export function compilePostcodes(
	sources: Iterable<SourceDistrict>,
	toLngLat: (easting: number, northing: number) => [number, number],
): {
	districts: Record<string, PostcodeDistrict>;
	sectors: Record<string, PostcodeGroup>;
} {
	const districts: Record<string, PostcodeDistrict> = {};
	const sectors: Record<string, PostcodeGroup> = {};
	const districtCentres: [string, number, number][] = [];
	const sectorCentres: [string, number, number][] = [];

	for (const source of sources) {
		const district = new Tally();
		const bySector = new Map<string, Tally>();
		source.postcodes.forEach((postcode, at) => {
			const codes = POSTCODE_GEOGRAPHIES.map((geography) =>
				areaCodeAt(source.areas[geography], at),
			);
			const name = `${source.district} ${postcode[source.district.length]}`;
			let sector = bySector.get(name);
			if (!sector) bySector.set(name, (sector = new Tally()));
			district.add(source, at, codes);
			sector.add(source, at, codes);
		});

		const finished = district.finish(toLngLat);
		if (!finished) continue;
		const counts: [string, number][] = [];
		for (const [name, tally] of [...bySector].sort((a, b) =>
			a[0].localeCompare(b[0]),
		)) {
			const sector = tally.finish(toLngLat);
			if (!sector) continue;
			sectors[name] = sector[0];
			sectorCentres.push([name, ...sector[1]]);
			counts.push([name, sector[0].live]);
		}
		districts[source.district] = { ...finished[0], sectors: counts };
		districtCentres.push([source.district, ...finished[1]]);
	}

	setNearby(districts, districtCentres);
	setNearby(sectors, sectorCentres);
	return { districts, sectors };
}

/** A sector's page, "LS6 1" at /places/postcodes/LS6/1. */
export const sectorHref = (sector: string) =>
	`/places/postcodes/${sector.replace(" ", "/")}`;

/** A district as written, "ls6" or " LS6 " as "LS6". */
export const normaliseDistrict = (input: string) =>
	input.replace(/\s+/g, "").toUpperCase();

let compiled: Promise<PostcodeDistricts | null> | undefined;

/** The compiled districts, or null where the build has not written them. */
export function loadPostcodeDistricts() {
	compiled ??= import("@/public/data/datasets/place-postcodes.json")
		.then((module) => module.default as unknown as PostcodeDistricts)
		.catch(() => null);
	return compiled;
}

let compiledSectors: Promise<PostcodeSectors | null> | undefined;

/** The compiled sectors, or null where the build has not written them. */
export function loadPostcodeSectors() {
	compiledSectors ??=
		import("@/public/data/datasets/place-postcode-sectors.json")
			.then((module) => module.default as unknown as PostcodeSectors)
			.catch(() => null);
	return compiledSectors;
}

export async function postcodeDistrict(district: string) {
	return (await loadPostcodeDistricts())?.districts[district];
}

let byArea:
	Promise<Map<string, [district: string, live: number][]>> | undefined;

/** The districts with postcodes in an area, in reading order. */
export async function areaPostcodeDistricts(code: string) {
	byArea ??= loadPostcodeDistricts().then((data) => {
		const index = new Map<string, [string, number][]>();
		for (const [district, entry] of Object.entries(data?.districts ?? {}))
			for (const geography of POSTCODE_GEOGRAPHIES)
				for (const [area, live] of entry.areas[geography]) {
					let list = index.get(area);
					if (!list) index.set(area, (list = []));
					list.push([district, live]);
				}
		for (const list of index.values())
			list.sort((a, b) => compareDistricts(a[0], b[0]));
		return index;
	});
	return (await byArea).get(code) ?? [];
}

let compiledNeighbourhoods: Promise<PlaceNeighbourhoods | null> | undefined;

/** The compiled neighbourhoods, or null where the build has not written them. */
export function loadNeighbourhoods() {
	compiledNeighbourhoods ??=
		import("@/public/data/datasets/place-neighbourhoods.json")
			.then((module) => module.default as unknown as PlaceNeighbourhoods)
			.catch(() => null);
	return compiledNeighbourhoods;
}
