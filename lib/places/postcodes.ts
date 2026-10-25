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

import type { BoundingBox } from "@/lib/places/profile";

export const POSTCODE_GEOGRAPHIES = [
	"localAuthority",
	"ward",
	"constituency",
] as const;

export type PostcodeGeography = (typeof POSTCODE_GEOGRAPHIES)[number];

/** Area code and the district's live postcodes in it, most first. */
export type AreaShare = [code: string, live: number][];

export type PostcodeDistrict = {
	live: number;
	terminated: number;
	/** Live postcodes serving a single large user, such as a business. */
	largeUser: number;
	/** Each sector, as "LS6 1", and its live postcodes, in order. */
	sectors: [sector: string, live: number][];
	/** Around the live postcodes' centroids, in WGS 84. */
	bbox: BoundingBox;
	areas: Record<PostcodeGeography, AreaShare>;
	/** The districts with the nearest centres, nearest first. */
	nearby: string[];
	/** A live postcode in the district, for an example request. */
	example: string;
};

export type PostcodeDistricts = {
	source: { title: string; edition: string; attribution: string[] };
	districts: Record<string, PostcodeDistrict>;
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
	areas: Record<
		PostcodeGeography,
		{
			codes: string[];
			area: number[];
			several?: Record<
				string,
				ReadonlyArray<readonly [number, ...unknown[]]>
			>;
		}
	>;
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

/**
 * Every district with a live postcode. `toLngLat` turns a British National
 * Grid easting and northing into WGS 84 longitude and latitude.
 */
export function compilePostcodeDistricts(
	sources: Iterable<SourceDistrict>,
	toLngLat: (easting: number, northing: number) => [number, number],
): Record<string, PostcodeDistrict> {
	const districts: Record<string, PostcodeDistrict> = {};
	const centres: [district: string, easting: number, northing: number][] = [];

	for (const source of sources) {
		let live = 0;
		let terminated = 0;
		let largeUser = 0;
		let example: string | undefined;
		const sectors = new Map<string, number>();
		const shares = Object.fromEntries(
			POSTCODE_GEOGRAPHIES.map((geography) => [
				geography,
				new Map<string, number>(),
			]),
		) as Record<PostcodeGeography, Map<string, number>>;
		let [minE, minN, maxE, maxN, sumE, sumN, placed] = [
			Infinity,
			Infinity,
			-Infinity,
			-Infinity,
			0,
			0,
			0,
		];

		source.postcodes.forEach((postcode, at) => {
			if (source.terminated[at] !== 0) {
				terminated += 1;
				return;
			}
			live += 1;
			example ??= postcode;
			if (source.largeUser[at] === "1") largeUser += 1;
			const sector = `${source.district} ${postcode[source.district.length]}`;
			sectors.set(sector, (sectors.get(sector) ?? 0) + 1);

			const easting = source.grid[at * 2];
			const northing = source.grid[at * 2 + 1];
			if (typeof easting === "number" && typeof northing === "number") {
				minE = Math.min(minE, easting);
				maxE = Math.max(maxE, easting);
				minN = Math.min(minN, northing);
				maxN = Math.max(maxN, northing);
				sumE += easting;
				sumN += northing;
				placed += 1;
			}

			for (const geography of POSTCODE_GEOGRAPHIES) {
				const column = source.areas[geography];
				const position =
					column.area[at]! >= 0
						? column.area[at]!
						: column.several?.[at]?.[0]?.[0];
				const code =
					position === undefined ? undefined : column.codes[position];
				if (code)
					shares[geography].set(
						code,
						(shares[geography].get(code) ?? 0) + 1,
					);
			}
		});
		if (live === 0 || placed === 0 || !example) continue;

		const corners = [
			toLngLat(minE, minN),
			toLngLat(minE, maxN),
			toLngLat(maxE, minN),
			toLngLat(maxE, maxN),
		];
		const lngs = corners.map(([lng]) => lng);
		const lats = corners.map(([, lat]) => lat);
		districts[source.district] = {
			live,
			terminated,
			largeUser,
			sectors: [...sectors].sort((a, b) => a[0].localeCompare(b[0])),
			bbox: [
				round4(Math.min(...lngs)),
				round4(Math.min(...lats)),
				round4(Math.max(...lngs)),
				round4(Math.max(...lats)),
			],
			areas: Object.fromEntries(
				POSTCODE_GEOGRAPHIES.map((geography) => [
					geography,
					[...shares[geography]].sort(
						(a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
					),
				]),
			) as Record<PostcodeGeography, AreaShare>,
			nearby: [],
			example: `${example.slice(0, -3)} ${example.slice(-3)}`,
		};
		centres.push([source.district, sumE / placed, sumN / placed]);
	}

	for (const [district, easting, northing] of centres)
		districts[district]!.nearby = centres
			.filter(([other]) => other !== district)
			.map(
				([other, e, n]) =>
					[other, (e - easting) ** 2 + (n - northing) ** 2] as const,
			)
			.sort((a, b) => a[1] - b[1])
			.slice(0, NEARBY)
			.map(([other]) => other);
	return districts;
}

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
