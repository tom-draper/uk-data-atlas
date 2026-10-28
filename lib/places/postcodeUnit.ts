/**
 * A single postcode for its /places page, read from the compiled database
 * when the page is first rendered, as there are some 1.7 million postcodes:
 * its directory row, the areas its centroid falls in, and its nearest
 * neighbours in the same district.
 */

import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import proj4 from "proj4";
import { readAtlasPayload } from "@uk-data-atlas/atlas-runtime/storage";
import {
	DEPRIVATION_INDICES,
	POSTCODE_GEOGRAPHIES,
	postcodeReleases,
	type DeprivationIndex,
	type PostcodeGeography,
} from "@/lib/places/postcodes";

const UNIT = /^[A-Z]{1,2}[0-9][0-9A-Z]?[0-9][A-Z]{2}$/;

/** "WA35DW" as "WA3 5DW". */
export const displayPostcode = (compact: string) =>
	`${compact.slice(0, -3)} ${compact.slice(-3)}`;

/** A postcode as typed, "wa3 5dw", as the directory keys it, or undefined. */
export function compactUnit(input: string) {
	const compact = input.replace(/\s+/g, "").toUpperCase();
	return UNIT.test(compact) ? compact : undefined;
}

/** A postcode's page, "WA3 5DW" at /places/postcodes/WA3/5DW. */
export function postcodeHref(postcode: string) {
	const compact = postcode.replace(/\s+/g, "");
	return `/places/postcodes/${compact.slice(0, -3)}/${compact.slice(-3)}`;
}

export type DistrictRow = {
	postcode: string;
	easting: number | null;
	northing: number | null;
	quality: string;
	country: string;
	introduced: number;
	terminated: number;
	largeUser: string;
};

export type PostcodeUnit = {
	/** As written, "WA3 5DW". */
	postcode: string;
	district: string;
	/** As written, "WA3 5". */
	sector: string;
	/** Month introduced, as YYYYMM. */
	introduced: number;
	/** Month terminated, as YYYYMM, or 0 while live. */
	terminated: number;
	/** Serves a single large user, such as a business. */
	largeUser: boolean;
	/** The directory's positional quality indicator. */
	quality: string;
	/** The directory's country letter, E, W, S, L or M. */
	country: string;
	grid?: [easting: number, northing: number];
	/** WGS 84 longitude and latitude. */
	lngLat?: [lng: number, lat: number];
	/** The code of each area its centroid falls in. */
	areas: Partial<Record<PostcodeGeography, string>>;
	/**
	 * The neighbourhood its centroid falls in, by deprivation index. An
	 * index's neighbourhood release can cover a nation the index does not,
	 * so a reader keeps only those the index ranks.
	 */
	neighbourhoods: Partial<Record<DeprivationIndex, string>>;
	/** The nearest live postcodes in its district, nearest first. */
	nearby: string[];
};

const NEARBY = 10;

// British National Grid to WGS 84, as the API reprojects postcode centroids.
const britishNationalGrid = proj4(
	"+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 " +
		"+ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 " +
		"+units=m +no_defs",
	"+proj=longlat +datum=WGS84 +no_defs",
);

const round5 = (value: number) => Math.round(value * 1e5) / 1e5;

/**
 * The postcode at `at` in its district's rows, with the code of the area it
 * is placed in for each release, keyed as `geography/boundaryRelease`.
 */
export function readPostcodeUnit(
	district: string,
	rows: readonly DistrictRow[],
	at: number,
	areaCode: (release: string) => string | undefined,
	releases: ReturnType<typeof postcodeReleases>,
): PostcodeUnit {
	const row = rows[at]!;
	const grid =
		row.easting === null || row.northing === null
			? undefined
			: ([row.easting, row.northing] as [number, number]);
	const areas: PostcodeUnit["areas"] = {};
	for (const geography of POSTCODE_GEOGRAPHIES) {
		const code = areaCode(releases.areas[geography]);
		if (code) areas[geography] = code;
	}
	const neighbourhoods: PostcodeUnit["neighbourhoods"] = {};
	for (const index of DEPRIVATION_INDICES) {
		const code = areaCode(releases.deprivation[index]);
		if (code) neighbourhoods[index] = code;
	}
	const nearby = grid
		? rows
				.flatMap((other, position) =>
					position !== at &&
					other.terminated === 0 &&
					other.easting !== null &&
					other.northing !== null
						? [
								[
									other.postcode,
									(other.easting - grid[0]) ** 2 +
										(other.northing - grid[1]) ** 2,
								] as const,
							]
						: [],
				)
				.sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
				.slice(0, NEARBY)
				.map(([postcode]) => displayPostcode(postcode))
		: [];
	const postcode = displayPostcode(row.postcode);
	return {
		postcode,
		district,
		sector: postcode.slice(0, -2),
		introduced: row.introduced,
		terminated: row.terminated,
		largeUser: row.largeUser === "1",
		quality: row.quality,
		country: row.country,
		...(grid
			? {
					grid,
					lngLat: britishNationalGrid.forward(grid).map(round5) as [
						number,
						number,
					],
				}
			: {}),
		areas,
		neighbourhoods,
		nearby,
	};
}

let releases: ReturnType<typeof postcodeReleases> | undefined;

const databasePath = () => join(process.cwd(), "data/build/atlas.sqlite");

// A district's postcodes, in the order its area placements are numbered.
const DISTRICT_ROWS =
	"SELECT postcode, easting, northing, quality, country, introduced, terminated, largeUser FROM postcodes WHERE postcode >= ? AND postcode < ? AND length(postcode) = ? ORDER BY postcode";
const districtRange = (district: string) =>
	[district, `${district}\x7f`, district.length + 3] as const;

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

/** The postcode, or undefined where the directory has no such postcode. */
export function lookupPostcodeUnit(compact: string): PostcodeUnit | undefined {
	releases ??= postcodeReleases(
		JSON.parse(readAtlasPayload(process.cwd(), "postcode-areas")).releases,
	);
	const district = compact.slice(0, -3);
	const database = new DatabaseSync(databasePath(), { readOnly: true });
	try {
		const rows = database
			.prepare(DISTRICT_ROWS)
			.all(...districtRange(district))
			.map((row): DistrictRow => ({
				postcode: String(row.postcode),
				easting: row.easting === null ? null : Number(row.easting),
				northing: row.northing === null ? null : Number(row.northing),
				quality: String(row.quality),
				country: String(row.country),
				introduced: Number(row.introduced),
				terminated: Number(row.terminated),
				largeUser: String(row.largeUser),
			}));
		const at = rows.findIndex((row) => row.postcode === compact);
		if (at === -1) return undefined;
		const columns = new Map(
			database
				.prepare(
					"SELECT position, geography, boundaryRelease, areaColumn FROM postcode_area_releases",
				)
				.all()
				.map((row) => [
					`${row.geography}/${row.boundaryRelease}`,
					{
						position: Number(row.position),
						column: String(row.areaColumn),
					},
				]),
		);
		// The area it is placed in, or the first it touches where it lies
		// on an edge between several.
		const areaCode = (release: string) => {
			const found = columns.get(release);
			if (!found) return undefined;
			const placed = database
				.prepare(
					`SELECT a.code FROM postcodes p JOIN areas a ON a.id = p.${quote(found.column)} WHERE p.postcode = ?`,
				)
				.get(compact);
			const edge = placed
				? undefined
				: database
						.prepare(
							"SELECT a.code FROM postcode_area_matches m JOIN areas a ON a.id = m.areaId WHERE m.district = ? AND m.releasePosition = ? AND m.postcodePosition = ? ORDER BY m.position LIMIT 1",
						)
						.get(district, found.position, at);
			const code = (placed ?? edge)?.code;
			return code === undefined ? undefined : String(code);
		};
		return readPostcodeUnit(district, rows, at, areaCode, releases);
	} finally {
		database.close();
	}
}

/** A sector's live postcodes, as written, in the directory's order. */
export function sectorPostcodes(sector: string) {
	const [district, digit] = sector.split(" ");
	const database = new DatabaseSync(databasePath(), { readOnly: true });
	try {
		return database
			.prepare(
				"SELECT postcode FROM postcodes WHERE postcode >= ? AND postcode < ? AND length(postcode) = ? AND terminated = 0 ORDER BY postcode",
			)
			.all(...districtRange(district!))
			.map((row) => String(row.postcode))
			.filter((postcode) => postcode[district!.length] === digit)
			.map(displayPostcode);
	} finally {
		database.close();
	}
}
