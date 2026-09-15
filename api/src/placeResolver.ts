import type { AreaLookup } from "./areaInventory";
import type { NamedLocationInventory } from "./namedLocations";

/**
 * Turning a name someone typed into the places it could mean.
 *
 * A place name is rarely one area. "Manchester" is a local authority, a county
 * and unitary authority, a travel to work area, a major town, an ITL3 region
 * and a community safety partnership, and a curated named location besides;
 * "Newport" is thirteen different codes across Wales, the Isle of Wight and
 * Shropshire. So this returns candidates, each saying what kind of place it is,
 * and never picks one. Choosing is the caller's, or the job of something that
 * knows what the caller wants the place for.
 */

export type PlaceMatch =
	/** The name, or an alias, equals the query. */
	| "exact"
	/** Equal once a title such as "City of" is set aside: "Bristol, City of". */
	| "exact-without-title"
	/** The name begins with the query: "Richmond upon Thames" for "Richmond". */
	| "prefix";

export type PlaceCandidate = {
	/**
	 * A reference that does not depend on a release: `localAuthority/E08000003`
	 * for an area, `location/north-west` for a curated location.
	 */
	place: string;
	kind: "area" | "named-location";
	name: string;
	geography: string;
	code: string;
	match: PlaceMatch;
	/** The label that matched, which may be an alias rather than the name. */
	matchedLabel: string;
	/** Releases carrying this code, newest first. Empty for a named location. */
	boundaryReleases: string[];
	/** For a named location, its curated member codes. */
	memberCodes?: string[];
};

/**
 * The order candidates of equal match are listed in. It is a presentation
 * choice, made so the headline geographies people usually mean come before
 * wards and parishes that happen to share a name, and it asserts nothing about
 * which is correct.
 */
const GEOGRAPHY_ORDER = [
	"country",
	"region",
	"named-location",
	"combinedAuthority",
	"countyAndUnitaryAuthority",
	"localAuthority",
	"majorTownAndCity",
	"constituency",
	"seneddConstituency",
	"scottishParliamentaryConstituency",
	"seneddElectoralRegion",
	"scottishParliamentaryRegion",
	"policeForceArea",
	"fireAndRescueAuthority",
	"integratedCareBoard",
	"subIntegratedCareBoardLocation",
	"nhsEnglandRegion",
	"localHealthBoard",
	"nationalPark",
	"localPlanningAuthority",
	"communitySafetyPartnership",
	"travelToWorkArea",
	"itl1",
	"itl2",
	"itl3",
	"ward",
	"countyElectoralDivision",
	"parish",
	"msoa",
	"lsoa",
	"dataZone",
	"superOutputArea",
];

const geographyRank = (geography: string) => {
	const index = GEOGRAPHY_ORDER.indexOf(geography);
	return index === -1 ? GEOGRAPHY_ORDER.length : index;
};

const MATCH_RANK: Record<PlaceMatch, number> = {
	exact: 0,
	"exact-without-title": 0,
	prefix: 1,
};

/**
 * A name reduced to what distinguishes it: case, accents, punctuation and the
 * ampersand all set aside, so "Brighton & Hove", "brighton and hove" and
 * "Ynys Môn" match what was published.
 */
export const normalisePlaceName = (value: string) =>
	value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.replace(/&/g, " and ")
		.replace(/['\u2019]/g, "")
		.replace(/[^a-z0-9]+/g, " ")
		.trim();

/**
 * The same name with an administrative title removed, or undefined when it
 * carries none. Publishers write "Bristol, City of" and "Kingston upon Hull,
 * City of"; nobody searches for either.
 */
export const withoutTitle = (normalised: string) => {
	const stripped = normalised
		.replace(/\b(city|county|borough|royal borough) of\b/g, " ")
		.replace(/\s+/g, " ")
		.trim();
	return stripped && stripped !== normalised ? stripped : undefined;
};

type IndexEntry = {
	kind: "area" | "named-location";
	geography: string;
	code: string;
	label: string;
	viaTitle: boolean;
};

type Grouped = {
	kind: "area" | "named-location";
	geography: string;
	code: string;
	/** Release to name, so the newest release's name wins. */
	names: Map<string, string>;
	boundaryReleases: Set<string>;
	memberCodes?: string[];
};

export type PlaceIndex = {
	byName: Map<string, IndexEntry[]>;
	/** Every indexed name, sorted, for prefix search. */
	names: string[];
	places: Map<string, Grouped>;
};

const placeKey = (
	kind: "area" | "named-location",
	geography: string,
	code: string,
) => (kind === "named-location" ? `location/${code}` : `${geography}/${code}`);

export const createPlaceIndex = (
	areaLookup: AreaLookup,
	namedLocations?: NamedLocationInventory,
): PlaceIndex => {
	const byName = new Map<string, IndexEntry[]>();
	const places = new Map<string, Grouped>();
	const add = (name: string, entry: IndexEntry) => {
		const list = byName.get(name);
		if (!list) {
			byName.set(name, [entry]);
			return;
		}
		// The same code carries the same name in release after release; one
		// entry per place and label is enough.
		if (
			!list.some(
				(existing) =>
					existing.kind === entry.kind &&
					existing.geography === entry.geography &&
					existing.code === entry.code &&
					existing.label === entry.label,
			)
		) {
			list.push(entry);
		}
	};
	const indexLabel = (
		label: string,
		kind: "area" | "named-location",
		geography: string,
		code: string,
	) => {
		const normalised = normalisePlaceName(label);
		if (!normalised) return;
		add(normalised, { kind, geography, code, label, viaTitle: false });
		const stripped = withoutTitle(normalised);
		if (stripped) {
			add(stripped, { kind, geography, code, label, viaTitle: true });
		}
	};

	for (const [key, areas] of areaLookup) {
		const [geography, boundaryRelease] = key.split("/") as [string, string];
		for (const area of areas.values()) {
			const id = placeKey("area", geography, area.code);
			const grouped = places.get(id) ?? {
				kind: "area" as const,
				geography,
				code: area.code,
				names: new Map<string, string>(),
				boundaryReleases: new Set<string>(),
			};
			grouped.names.set(boundaryRelease, area.name);
			grouped.boundaryReleases.add(boundaryRelease);
			places.set(id, grouped);
			for (const label of [area.name, ...(area.aliases ?? [])]) {
				indexLabel(label, "area", geography, area.code);
			}
		}
	}
	for (const location of namedLocations?.locations ?? []) {
		places.set(placeKey("named-location", "named-location", location.id), {
			kind: "named-location",
			geography: "named-location",
			code: location.id,
			names: new Map([["", location.label]]),
			boundaryReleases: new Set(),
			memberCodes: location.memberCodes,
		});
		indexLabel(
			location.label,
			"named-location",
			"named-location",
			location.id,
		);
	}
	return {
		byName,
		names: [...byName.keys()].sort(),
		places,
	};
};

/** A release-independent place reference, split, or undefined if malformed. */
export const parsePlaceReference = (
	reference: string,
):
	| { kind: "area" | "named-location"; geography: string; code: string }
	| undefined => {
	const match = /^([A-Za-z0-9]+)\/([A-Za-z0-9-]+)$/.exec(reference);
	if (!match) return undefined;
	const [, head, code] = match as unknown as [string, string, string];
	return head === "location"
		? { kind: "named-location", geography: "named-location", code }
		: { kind: "area", geography: head, code };
};

const toCandidate = (
	index: PlaceIndex,
	entry: IndexEntry,
	match: PlaceMatch,
): PlaceCandidate | undefined => {
	const grouped = index.places.get(
		placeKey(entry.kind, entry.geography, entry.code),
	);
	if (!grouped) return undefined;
	const boundaryReleases = [...grouped.boundaryReleases].sort().reverse();
	const newest = boundaryReleases[0] ?? "";
	return {
		place: placeKey(grouped.kind, grouped.geography, grouped.code),
		kind: grouped.kind,
		name: grouped.names.get(newest) ?? [...grouped.names.values()][0] ?? "",
		geography: grouped.geography,
		code: grouped.code,
		match,
		matchedLabel: entry.label,
		boundaryReleases,
		...(grouped.memberCodes ? { memberCodes: grouped.memberCodes } : {}),
	};
};

/** The first index at which a sorted list could hold a string beginning with `prefix`. */
const lowerBound = (sorted: string[], prefix: string) => {
	let low = 0;
	let high = sorted.length;
	while (low < high) {
		const middle = (low + high) >> 1;
		if (sorted[middle]! < prefix) low = middle + 1;
		else high = middle;
	}
	return low;
};

/**
 * Every place the query could mean, best first.
 *
 * A release-independent reference or a bare area code is looked up directly.
 * Otherwise names are matched exactly, then with an administrative title set
 * aside, and only when those leave room, by prefix. Candidates that are the
 * same place reached through several labels are returned once, keeping the
 * best match.
 */
export const resolvePlaces = (
	index: PlaceIndex,
	query: string,
	limit = 10,
): PlaceCandidate[] => {
	const trimmed = query.trim();
	if (!trimmed) return [];

	const reference = parsePlaceReference(trimmed);
	if (reference) {
		const candidate = toCandidate(
			index,
			{ ...reference, label: trimmed, viaTitle: false },
			"exact",
		);
		if (candidate) return [candidate];
	}

	const found = new Map<string, PlaceCandidate>();
	const consider = (entry: IndexEntry, match: PlaceMatch) => {
		const key = placeKey(entry.kind, entry.geography, entry.code);
		const existing = found.get(key);
		if (existing && MATCH_RANK[existing.match] <= MATCH_RANK[match]) return;
		const candidate = toCandidate(index, entry, match);
		if (candidate) found.set(key, candidate);
	};

	// A bare code is a place too: E08000003 is Manchester in every geography
	// that carries the code.
	if (/^[A-Z]\d{8}$/.test(trimmed.toUpperCase())) {
		const code = trimmed.toUpperCase();
		for (const grouped of index.places.values()) {
			if (grouped.code !== code) continue;
			consider(
				{
					kind: grouped.kind,
					geography: grouped.geography,
					code,
					label: code,
					viaTitle: false,
				},
				"exact",
			);
		}
	}

	const normalised = normalisePlaceName(trimmed);
	for (const entry of index.byName.get(normalised) ?? []) {
		consider(entry, entry.viaTitle ? "exact-without-title" : "exact");
	}

	if (found.size < limit && normalised.length >= 3) {
		for (
			let position = lowerBound(index.names, normalised);
			position < index.names.length &&
			index.names[position]!.startsWith(normalised);
			position += 1
		) {
			const name = index.names[position]!;
			if (name === normalised) continue;
			for (const entry of index.byName.get(name) ?? []) {
				consider(entry, "prefix");
			}
		}
	}

	return [...found.values()]
		.sort(
			(left, right) =>
				MATCH_RANK[left.match] - MATCH_RANK[right.match] ||
				geographyRank(left.geography) -
					geographyRank(right.geography) ||
				left.name.localeCompare(right.name) ||
				left.code.localeCompare(right.code),
		)
		.slice(0, limit);
};
