import { normalisePlaceName } from "./nameNormalisation";
import { findSorted, lowerBound } from "./sortedIndex";
import {
	AREA_CODE,
	placeReference,
	type CompiledPlaceLabel,
	type PlaceIndexArtifact,
} from "./placeIndex";

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
	/** The geography of a named location's curated member codes. */
	memberGeography?: string;
	/** Definition provenance for a named location. */
	definitionRevision?: number;
	validity?: { from: string | null; to: string | null };
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
	"outputArea",
	"intermediateZone",
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
	index: PlaceIndexArtifact,
	position: number,
	match: PlaceMatch,
	matchedLabel?: string,
): PlaceCandidate => {
	const place = index.places[position]!;
	return {
		place: place.place,
		kind: place.kind,
		name: place.name,
		geography: place.geography,
		code: place.code,
		match,
		matchedLabel: matchedLabel ?? place.name,
		boundaryReleases: place.boundaryReleases.map(
			(release) => index.releases[release]!,
		),
		...(place.memberCodes ? { memberCodes: place.memberCodes } : {}),
		...(place.memberGeography
			? { memberGeography: place.memberGeography }
			: {}),
		...(place.definitionRevision
			? { definitionRevision: place.definitionRevision }
			: {}),
		...(place.validity ? { validity: place.validity } : {}),
	};
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
	index: PlaceIndexArtifact,
	query: string,
	limit = 10,
): PlaceCandidate[] => {
	const trimmed = query.trim();
	if (!trimmed) return [];

	const reference = parsePlaceReference(trimmed);
	if (reference) {
		const position = findSorted(
			index.places,
			placeReference(reference.kind, reference.geography, reference.code),
			(place) => place.place,
		);
		if (position !== -1)
			return [toCandidate(index, position, "exact", trimmed)];
	}

	const found = new Map<number, PlaceCandidate>();
	const consider = (
		position: number,
		match: PlaceMatch,
		matchedLabel?: string,
	) => {
		const existing = found.get(position);
		if (existing && MATCH_RANK[existing.match] <= MATCH_RANK[match]) return;
		found.set(position, toCandidate(index, position, match, matchedLabel));
	};
	const considerLabels = (
		labels: CompiledPlaceLabel[],
		match: (viaTitle: 0 | 1) => PlaceMatch,
	) => {
		for (const [position, viaTitle, label] of labels) {
			consider(position, match(viaTitle), label);
		}
	};

	// A bare code is a place too: E08000003 is Manchester in every geography
	// that carries the code.
	const code = trimmed.toUpperCase();
	if (AREA_CODE.test(code)) {
		const at = findSorted(index.codes, code);
		for (const position of at === -1 ? [] : index.codePlaces[at]!) {
			consider(position, "exact", code);
		}
	}

	const normalised = normalisePlaceName(trimmed);
	const exact = findSorted(index.names, normalised);
	if (exact !== -1) {
		considerLabels(index.labels[exact]!, (viaTitle) =>
			viaTitle ? "exact-without-title" : "exact",
		);
	}

	if (found.size < limit && normalised.length >= 3) {
		for (
			let position = lowerBound(index.names, normalised);
			position < index.names.length &&
			index.names[position]!.startsWith(normalised);
			position += 1
		) {
			if (position === exact) continue;
			considerLabels(index.labels[position]!, () => "prefix");
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
