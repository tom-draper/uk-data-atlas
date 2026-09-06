import type { PropertyKeys } from "@/lib/types/geometry";
import { withCDN } from "@/lib/helpers/cdn";

/** The countries a release draws. */
export type BoundaryExtent = "uk" | "gb" | "ew" | "en" | "w" | "sc" | "ni";

/**
 * One published boundary release.
 *
 * `id` is the folder it occupies under `data/boundaries/<geography>/` and its
 * identity everywhere else. It leads with the publication date so string order
 * is chronological, and it carries the month because ONS republishes a
 * geography more than once a year — May and December 2023 wards are different
 * files, and only the May one names each ward's local authority.
 */
type BoundaryRelease = {
	id: string;
	year: number;
	/** 1–12. Omitted when the publisher dates a release to the year alone. */
	month?: number;
	extent: BoundaryExtent;
	/**
	 * The properties this release's features carry, read off the file rather
	 * than shared across the geography. Sharing them is how the Dec 2020 ward
	 * and Dec 2015 constituency assets came to be compiled with every property
	 * stripped: the geography's key list did not happen to mention WD20CD, and
	 * spelled pcon15cd in the wrong case, and nothing could notice.
	 */
	codeKey: PropertyKeys;
	nameKey: string;
	/** The containing area's code, for the releases that publish one. */
	parentCodeKey?: PropertyKeys;
	/** The served asset. Absent for a release held but not yet compiled. */
	asset?: string;
};

type BoundaryProperties = {
	code: readonly PropertyKeys[];
	name: readonly string[];
	parentCode?: readonly PropertyKeys[];
};

type BoundaryFamily = {
	/** Newest first. */
	releases: readonly BoundaryRelease[];
	/** Years served by another year's release, because the areas did not change. */
	aliases?: Readonly<Record<number, string>>;
	/**
	 * Code and name spellings no release here uses, but an uploaded file might.
	 * Kept out of `releases` so a release always describes exactly one file.
	 */
	alsoAccepts?: BoundaryProperties;
};

const asset = (geography: string, release: string) =>
	withCDN(`/data/boundaries/${geography}/${release}/boundaries.topojson`);

/**
 * Authoritative catalogue of the boundary releases the atlas supports.
 *
 * Add a release here and it is served, compiled and offered as a match target;
 * nothing else needs editing. Everything the rest of the app reads — property
 * keys, per-year assets, the geography a code key belongs to — is derived from
 * this list below, so the list cannot disagree with itself.
 */
const CATALOG = {
	ward: {
		releases: [
			{
				id: "2025-12-uk-bgc",
				year: 2025,
				month: 12,
				extent: "uk",
				codeKey: "WD25CD",
				nameKey: "WD25NM",
				parentCodeKey: "LAD25CD",
				asset: asset("ward", "2025-12-uk-bgc"),
			},
			{
				id: "2025-05-uk-bgc-v2",
				year: 2025,
				month: 5,
				extent: "uk",
				codeKey: "WD25CD",
				nameKey: "WD25NM",
				parentCodeKey: "LAD25CD",
				asset: asset("ward", "2025-05-uk-bgc-v2"),
			},
			{
				id: "2024-12-uk-bgc",
				year: 2024,
				month: 12,
				extent: "uk",
				codeKey: "WD24CD",
				nameKey: "WD24NM",
				parentCodeKey: "LAD24CD",
				asset: asset("ward", "2024-12-uk-bgc"),
			},
			{
				id: "2023-12-uk-bgc",
				year: 2023,
				month: 12,
				extent: "uk",
				codeKey: "WD23CD",
				nameKey: "WD23NM",
				asset: asset("ward", "2023-12-uk-bgc"),
			},
			{
				id: "2023-05-uk-bgc",
				year: 2023,
				month: 5,
				extent: "uk",
				codeKey: "WD23CD",
				nameKey: "WD23NM",
				parentCodeKey: "LAD23CD",
				asset: asset("ward", "2023-05-uk-bgc"),
			},
			{
				id: "2022-12-uk-bgc",
				year: 2022,
				month: 12,
				extent: "uk",
				codeKey: "WD22CD",
				nameKey: "WD22NM",
				parentCodeKey: "LAD22CD",
				asset: asset("ward", "2022-12-uk-bgc"),
			},
			{
				id: "2021-12-uk-bgc",
				year: 2021,
				month: 12,
				extent: "uk",
				codeKey: "WD21CD",
				nameKey: "WD21NM",
				asset: asset("ward", "2021-12-uk-bgc"),
			},
			{
				id: "2020-12-uk-bgc",
				year: 2020,
				month: 12,
				extent: "uk",
				codeKey: "WD20CD",
				nameKey: "WD20NM",
				asset: asset("ward", "2020-12-uk-bgc"),
			},
			{
				id: "2019-12-gb-bgc",
				year: 2019,
				month: 12,
				extent: "gb",
				codeKey: "wd19cd",
				nameKey: "wd19nm",
				asset: asset("ward", "2019-12-gb-bgc"),
			},
			{
				id: "2018-12-uk-bgc",
				year: 2018,
				month: 12,
				extent: "uk",
				codeKey: "wd18cd",
				nameKey: "wd18nm",
				asset: asset("ward", "2018-12-uk-bgc"),
			},
			{
				id: "2017-12-gb-bgc",
				year: 2017,
				month: 12,
				extent: "gb",
				codeKey: "wd17cd",
				nameKey: "wd17nm",
				asset: asset("ward", "2017-12-gb-bgc"),
			},
			{
				id: "2016-12-gb-bgc",
				year: 2016,
				month: 12,
				extent: "gb",
				codeKey: "wd16cd",
				nameKey: "wd16nm",
				parentCodeKey: "lad16cd",
				asset: asset("ward", "2016-12-gb-bgc"),
			},
		],
		// May and December 2025 publish the same 8,405 wards; the May release
		// is the corrected V2 and stays the one served for the year.
		aliases: { 2025: "2025-05-uk-bgc-v2", 2023: "2023-12-uk-bgc" },
	},
	constituency: {
		releases: [
			{
				id: "2024-07-uk-bgc",
				year: 2024,
				month: 7,
				extent: "uk",
				codeKey: "PCON24CD",
				nameKey: "PCON24NM",
				asset: asset("constituency", "2024-07-uk-bgc"),
			},
			{
				id: "2019-12-uk-bgc",
				year: 2019,
				month: 12,
				extent: "uk",
				codeKey: "pcon19cd",
				nameKey: "pcon19nm",
				asset: asset("constituency", "2019-12-uk-bgc"),
			},
			{
				id: "2017-12-uk-bgc",
				year: 2017,
				month: 12,
				extent: "uk",
				codeKey: "PCON17CD",
				nameKey: "PCON17NM",
				asset: asset("constituency", "2017-12-uk-bgc"),
			},
			{
				id: "2016-12-uk-bgc",
				year: 2016,
				month: 12,
				extent: "uk",
				codeKey: "pcon16cd",
				nameKey: "pcon16nm",
				asset: asset("constituency", "2016-12-uk-bgc"),
			},
			{
				id: "2015-12-gb-bgc",
				year: 2015,
				month: 12,
				extent: "gb",
				codeKey: "pcon15cd",
				nameKey: "pcon15nm",
				asset: asset("constituency", "2015-12-gb-bgc"),
			},
		],
		// The 2010–2019 boundary set did not change, so the 2017 geometry also
		// supplies the code-compatible 2010 and 2015 election maps. 2015 is
		// aliased rather than served from its own release because the Dec 2015
		// file covers Great Britain only, and is short six of its own
		// constituencies besides — 626 of the 650 areas — so serving it would
		// drop Northern Ireland, five Scottish seats and one Welsh seat from a
		// year whose areas are identical to 2017's.
		aliases: { 2010: "2017-12-uk-bgc", 2015: "2017-12-uk-bgc" },
	},
	localAuthority: {
		releases: [
			{
				id: "2025-05-uk-bgc-v2",
				year: 2025,
				month: 5,
				extent: "uk",
				codeKey: "LAD25CD",
				nameKey: "LAD25NM",
				asset: asset("local-authority", "2025-05-uk-bgc-v2"),
			},
			{
				id: "2024-05-uk-bgc",
				year: 2024,
				month: 5,
				extent: "uk",
				codeKey: "LAD24CD",
				nameKey: "LAD24NM",
				asset: asset("local-authority", "2024-05-uk-bgc"),
			},
			{
				id: "2023-05-uk-bgc-v2",
				year: 2023,
				month: 5,
				extent: "uk",
				codeKey: "LAD23CD",
				nameKey: "LAD23NM",
				asset: asset("local-authority", "2023-05-uk-bgc-v2"),
			},
			{
				id: "2022-12-uk-bgc-v2",
				year: 2022,
				month: 12,
				extent: "uk",
				codeKey: "LAD22CD",
				nameKey: "LAD22NM",
				asset: asset("local-authority", "2022-12-uk-bgc-v2"),
			},
			{
				id: "2021-12-uk-bgc",
				year: 2021,
				month: 12,
				extent: "uk",
				codeKey: "LAD21CD",
				nameKey: "LAD21NM",
				asset: asset("local-authority", "2021-12-uk-bgc"),
			},
			{
				id: "2016-12-gb-bgc",
				year: 2016,
				month: 12,
				extent: "gb",
				codeKey: "LAD16CD",
				nameKey: "LAD16NM",
				asset: asset("local-authority", "2016-12-gb-bgc"),
			},
		],
	},
	lsoa: {
		releases: [
			{
				id: "2011-12-ew-bgc-v3",
				year: 2011,
				month: 12,
				extent: "ew",
				codeKey: "LSOA11CD",
				nameKey: "LSOA11NM",
				asset: asset("lsoa", "2011-12-ew-bgc-v3"),
			},
			{
				id: "2011-12-w-bgc",
				year: 2011,
				month: 12,
				extent: "w",
				codeKey: "LSOA11CD",
				nameKey: "LSOA11NM",
				asset: asset("lsoa", "2011-12-w-bgc"),
			},
		],
		// Both releases are 2011; the England-and-Wales one covers the other.
		aliases: { 2011: "2011-12-ew-bgc-v3" },
		alsoAccepts: { code: ["LSOA21CD"], name: ["LSOA21NM"] },
	},
	dataZone: {
		releases: [
			{
				id: "2011-12-sc-bfc",
				year: 2011,
				month: 12,
				extent: "sc",
				codeKey: "DataZone",
				nameKey: "Name",
				asset: asset("data-zone", "2011-12-sc-bfc"),
			},
			{
				// Held, not served: the same 2011 data zones as the release
				// above, but keyed DZ11CD rather than DataZone, so serving it
				// for 2011 would silently change the codes datasets join on.
				id: "2011-12-sc-nc",
				year: 2011,
				month: 12,
				extent: "sc",
				codeKey: "DZ11CD",
				nameKey: "DZ11NM",
			},
		],
	},
	superOutputArea: {
		releases: [
			{
				id: "2011-ni",
				year: 2011,
				extent: "ni",
				codeKey: "SOA_CODE",
				nameKey: "SOA_LABEL",
				asset: asset("super-output-area", "2011-ni"),
			},
		],
		alsoAccepts: {
			code: ["SOA2011", "SOA"],
			name: ["SOA2011 Name", "SOA Name"],
		},
	},
} as const satisfies Record<string, BoundaryFamily>;

export type BoundaryType = keyof typeof CATALOG;

/** A year a geography can be asked for: a release's own, or an aliased one. */
export type BoundaryYear<T extends BoundaryType> =
	| (typeof CATALOG)[T]["releases"][number]["year"]
	| ((typeof CATALOG)[T] extends { aliases: infer A }
			? Extract<keyof A, number>
			: never);

/** Every geography in catalogue order, for callers that handle all of them. */
export const BOUNDARY_TYPES = Object.keys(CATALOG) as BoundaryType[];

/**
 * A geography's code keys and name keys, newest release first and paired by
 * construction — the two lists are read out of the same releases, so they
 * cannot drift apart the way two hand-written arrays can.
 */
const familyProperties = (family: BoundaryFamily): BoundaryProperties => {
	const byCodeKey = new Map<PropertyKeys, string>();
	for (const release of family.releases) {
		if (!byCodeKey.has(release.codeKey)) {
			byCodeKey.set(release.codeKey, release.nameKey);
		}
	}
	const extra = family.alsoAccepts;
	extra?.code.forEach((key, index) => {
		if (!byCodeKey.has(key)) byCodeKey.set(key, extra.name[index] ?? key);
	});
	const parentCode = [
		...new Set(family.releases.flatMap((r) => r.parentCodeKey ?? [])),
	];
	return {
		code: [...byCodeKey.keys()],
		name: [...byCodeKey.values()],
		...(parentCode.length > 0 ? { parentCode } : {}),
	};
};

/**
 * The asset to serve for each year, newest release in the year winning, plus
 * the years aliased onto another release. A release with no compiled asset is
 * skipped rather than served as a broken URL.
 */
const familyVintages = (family: BoundaryFamily): Record<number, string> => {
	const vintages: Record<number, string> = {};
	for (const release of [...family.releases].reverse()) {
		if (release.asset) vintages[release.year] = release.asset;
	}
	for (const [year, id] of Object.entries(family.aliases ?? {})) {
		const target = family.releases.find((r) => r.id === id);
		if (target?.asset) vintages[Number(year)] = target.asset;
	}
	return vintages;
};

export const BOUNDARY_CATALOG = Object.fromEntries(
	BOUNDARY_TYPES.map((type) => {
		const family: BoundaryFamily = CATALOG[type];
		return [
			type,
			{
				releases: family.releases,
				properties: familyProperties(family),
				vintages: familyVintages(family),
			},
		];
	}),
) as Record<
	BoundaryType,
	{
		releases: readonly BoundaryRelease[];
		properties: BoundaryProperties;
		vintages: Record<number, string>;
	}
>;

/** Every release of a geography, newest first. */
export const boundaryReleases = (
	type: BoundaryType,
): readonly BoundaryRelease[] => BOUNDARY_CATALOG[type].releases;

/** One release by its id, e.g. `boundaryRelease("ward", "2023-05-uk-bgc")`. */
export const boundaryRelease = (
	type: BoundaryType,
	id: string,
): BoundaryRelease | undefined =>
	BOUNDARY_CATALOG[type].releases.find((release) => release.id === id);

/** The vintages a geography has boundary files for, newest first. */
export const boundaryYears = (type: BoundaryType): number[] =>
	Object.keys(BOUNDARY_CATALOG[type].vintages)
		.map(Number)
		.sort((a, b) => b - a);

// Each release names its own code and name key, so a file's code property
// identifies both its geography and the matching name key in the same file.
const CODE_KEY_INDEX = new Map<string, { type: BoundaryType; nameKey: string }>(
	BOUNDARY_TYPES.flatMap((type) => {
		const { code, name } = BOUNDARY_CATALOG[type].properties;
		return code.map(
			(key, index) =>
				[key, { type, nameKey: name[index] ?? name[0] }] as const,
		);
	}),
);

/** The geography a boundary file belongs to, from the code property it carries. */
export const boundaryTypeForCodeKey = (
	codeKey: string,
): BoundaryType | undefined => CODE_KEY_INDEX.get(codeKey)?.type;

/** The name property paired with a code property in the same boundary file. */
export const nameKeyForCodeKey = (codeKey: string): string | undefined =>
	CODE_KEY_INDEX.get(codeKey)?.nameKey;
