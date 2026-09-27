/**
 * What each named location is, and where its members come from.
 *
 * Most named locations are editorial groupings ("Central Belt", "The
 * Highlands") and stay exactly as curated in `lib/data/locations.ts`. The ones
 * that are official areas take their current members from the ONS lookup that
 * defines them, so they cannot drift as councils are created and merged: the
 * hand-kept regions had lost seven councils (Worthing, Swindon, North
 * Lincolnshire among them) before this.
 *
 * Only current members come from the lookup. A curated list can also hold
 * superseded council codes, kept on purpose so older ward releases, which
 * name the councils of their day, still filter (docs/gazetteer-design.md 4.1);
 * those are carried over unchanged.
 */

export type PlaceKind =
	"country" | "region" | "combined-authority" | "county" | "editorial";

/**
 * The definition revision of a place sourced from an ONS lookup. Editorial
 * places keep the gazetteer version as their revision (1); moving a place from
 * a curated list to a lookup is a new definition, so the API reports it.
 */
export const SOURCED_DEFINITION_REVISION = 2;

export type PlaceSource = {
	/** Directory under data/lookups holding the ONS lookup. */
	lookup: string;
	/** The place's ONS code in that lookup. */
	code: string;
};

type OfficialPlace =
	| { kind: "country" }
	| ({ kind: Exclude<PlaceKind, "country" | "editorial"> } & PlaceSource);

type Bounds = [number, number, number, number];

type CuratedLocation = { lad_codes: string[]; bounds: Bounds };

export type ResolvedPlace = CuratedLocation & {
	kind: PlaceKind;
	source?: PlaceSource;
};

/** An ONS lookup from local authority to a grouping, and its columns. */
export type PlaceLookup = {
	lookup: string;
	file: string;
	localAuthorityKey: string;
	placeKey: string;
};

export const PLACE_LOOKUPS: PlaceLookup[] = [
	{
		lookup: "local-authority-to-region/2025-04-en",
		file: "LAD25_RGN25_EN_LU_v2.geojson",
		localAuthorityKey: "LAD25CD",
		placeKey: "RGN25CD",
	},
	{
		lookup: "local-authority-to-combined-authority/2025-05-en",
		file: "LAD25_CAUTH25_EN_LU.geojson",
		localAuthorityKey: "LAD25CD",
		placeKey: "CAUTH25CD",
	},
	{
		lookup: "local-authority-to-county-and-unitary-authority/2025-04-uk",
		file: "LAD25_CTYUA25_UK_LU_v2.geojson",
		localAuthorityKey: "LAD25CD",
		placeKey: "CTYUA25CD",
	},
];

const [REGIONS, COMBINED_AUTHORITIES, COUNTIES] = PLACE_LOOKUPS.map(
	({ lookup }) => lookup,
) as [string, string, string];

const region = (code: string): OfficialPlace => ({
	kind: "region",
	lookup: REGIONS,
	code,
});
const county = (code: string): OfficialPlace => ({
	kind: "county",
	lookup: COUNTIES,
	code,
});

/**
 * Named locations that are official areas. A county is listed only where the
 * name means the ONS county; most county names here mean the ceremonial
 * county (Kent with Medway), which no ONS lookup defines, so they stay
 * editorial.
 */
export const OFFICIAL_PLACES: Record<string, OfficialPlace> = {
	England: { kind: "country" },
	Scotland: { kind: "country" },
	Wales: { kind: "country" },
	"Northern Ireland": { kind: "country" },
	"United Kingdom": { kind: "country" },
	"North East": region("E12000001"),
	"North West": region("E12000002"),
	Yorkshire: region("E12000003"),
	"East Midlands": region("E12000004"),
	"West Midlands": region("E12000005"),
	"East of England": region("E12000006"),
	London: region("E12000007"),
	"South East": region("E12000008"),
	"South West": region("E12000009"),
	"Greater Manchester": {
		kind: "combined-authority",
		lookup: COMBINED_AUTHORITIES,
		code: "E47000001",
	},
	Gloucestershire: county("E10000013"),
	Hertfordshire: county("E10000015"),
	Norfolk: county("E10000020"),
	Oxfordshire: county("E10000025"),
	Suffolk: county("E10000029"),
};

/**
 * @param lookupMembers Each ONS place code's current local authorities.
 * @param currentCodes Every local authority code the lookups list. A curated
 * member outside it is a superseded code, kept for older boundary releases;
 * judge this by the lookups, not by boundary files, which can still carry an
 * old code for a year after it is replaced (Barnsley, Sheffield).
 */
export function resolvePlaces(
	locations: Record<string, CuratedLocation>,
	official: Record<string, OfficialPlace>,
	lookupMembers: Record<string, readonly string[]>,
	currentCodes: ReadonlySet<string>,
): Record<string, ResolvedPlace> {
	return Object.fromEntries(
		Object.entries(locations).map(([name, location]) => {
			const place = official[name];
			if (!place) return [name, { ...location, kind: "editorial" }];
			if (place.kind === "country")
				return [name, { ...location, kind: "country" }];

			const members = lookupMembers[place.code];
			if (!members?.length)
				throw new Error(
					`${name}: ${place.lookup} has no members for ${place.code}`,
				);
			const superseded = location.lad_codes.filter(
				(code) => !currentCodes.has(code),
			);
			return [
				name,
				{
					lad_codes: [...new Set([...members].sort()), ...superseded],
					bounds: location.bounds,
					kind: place.kind,
					source: { lookup: place.lookup, code: place.code },
				},
			];
		}),
	);
}
