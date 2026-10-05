import {
	boundsIntersect,
	containPoint,
	geometryBounds,
	pointInBounds,
	type Coordinate,
	type GeometryBounds,
} from "./areaContainment";
import type { GeoJsonGeometry } from "./areaGeometry";
import { idFor, type NamedLocation } from "./namedLocations";

/**
 * Ceremonial counties as places: the counties of England and the preserved
 * counties of Wales that lord-lieutenants are appointed to, which is what
 * most people mean by "Lancashire" or "Kent".
 *
 * No ONS lookup defines them and they carry no GSS code, so their members are
 * worked out from Ordnance Survey's Boundary-Line polygons: each local
 * authority of every compiled release is assigned to the county holding most
 * of its area, sampled on a grid. Every release is read, so a county's
 * members change as its councils were reorganised, bounded by the releases
 * each council appears in rather than by the legal date of the change.
 *
 * Scotland's lieutenancy areas are in the same file but do not follow council
 * boundaries (Inverness, Nairn, Ross and Cromarty, Sutherland and Caithness
 * all lie in Highland), so they cannot be described by council members and are
 * left out.
 */

export type CountyShape = {
	name: string;
	/** In WGS84. */
	geometry: GeoJsonGeometry;
	bounds: GeometryBounds;
};

export type AuthorityRelease = {
	/** YYYY-MM, the release's month. */
	month: string;
	authorities: Array<{ code: string; geometry: GeoJsonGeometry }>;
};

export type CountyAssignment = {
	county: string;
	/** Share of the authority's sampled area in that county. */
	share: number;
	/** Other counties holding a noticeable share, when it is split. */
	elsewhere: Array<{ county: string; share: number }>;
};

/** Points sampled across an authority's bounding box, per side. */
const GRID = 24;
/** The least of an authority that must lie in some county for it to be assigned. */
const MIN_PLACED = 0.5;
/** A share elsewhere below this is generalisation, not a split. */
export const SPLIT_SHARE = 0.03;

/** Lieutenancy areas in Scotland, which are not unions of council areas. */
export const SCOTTISH_LIEUTENANCY_AREAS = new Set([
	"Aberdeenshire",
	"Angus",
	"Argyll and Bute",
	"Ayrshire and Arran",
	"Banffshire",
	"Berwickshire",
	"Caithness",
	"City of Aberdeen",
	"City of Dundee",
	"City of Edinburgh",
	"City of Glasgow",
	"Clackmannan",
	"Dumfries",
	"Dunbartonshire",
	"East Lothian",
	"Fife",
	"Inverness",
	"Kincardineshire",
	"Lanarkshire",
	"Midlothian",
	"Moray",
	"Nairn",
	"Orkney",
	"Perth and Kinross",
	"Renfrewshire",
	"Ross and Cromarty",
	"Roxburgh, Ettrick and Lauderdale",
	"Shetland",
	"Stirling and Falkirk",
	"Sutherland",
	"The Stewartry of Kirkcudbright",
	"Tweeddale",
	"West Lothian",
	"Western Isles",
	"Wigtown",
]);

const samplePoints = (geometry: GeoJsonGeometry): Coordinate[] => {
	const bounds = geometryBounds(geometry);
	if (!bounds) return [];
	const [west, south, east, north] = bounds;
	const points: Coordinate[] = [];
	for (let x = 0; x < GRID; x += 1)
		for (let y = 0; y < GRID; y += 1) {
			const point: Coordinate = [
				west + ((x + 0.5) / GRID) * (east - west),
				south + ((y + 0.5) / GRID) * (north - south),
			];
			if (containPoint(point, geometry) !== "outside") points.push(point);
		}
	return points;
};

/**
 * The county holding most of an authority, or undefined when none holds any
 * of it, as for an authority outside England and Wales.
 */
export const assignAuthority = (
	geometry: GeoJsonGeometry,
	counties: CountyShape[],
): CountyAssignment | undefined => {
	const bounds = geometryBounds(geometry);
	if (!bounds) return undefined;
	const candidates = counties.filter((county) =>
		boundsIntersect(county.bounds, bounds),
	);
	const points = samplePoints(geometry);
	const counts = new Map<string, number>();
	for (const point of points) {
		const county = candidates.find(
			(candidate) =>
				pointInBounds(point, candidate.bounds) &&
				containPoint(point, candidate.geometry) !== "outside",
		);
		if (county) counts.set(county.name, (counts.get(county.name) ?? 0) + 1);
	}
	// Points outside every county lie in sea the authority's generalised
	// coastline covers and the county's does not, so shares are of the points
	// placed. An authority mostly outside every county, as a Scottish one
	// along the border is, belongs to none.
	const placed = [...counts.values()].reduce((sum, count) => sum + count, 0);
	if (placed === 0 || placed < points.length * MIN_PLACED) return undefined;
	const [first, ...rest] = [...counts]
		.map(([county, count]) => ({ county, share: count / placed }))
		.sort((left, right) => right.share - left.share);
	return {
		county: first!.county,
		share: first!.share,
		elsewhere: rest.filter((entry) => entry.share >= SPLIT_SHARE),
	};
};

export type CountyMembership = {
	county: string;
	members: Array<{
		code: string;
		validity: { from: string | null; to: string | null };
	}>;
	/** Authorities assigned here that another county also holds part of. */
	split: Array<{ code: string } & CountyAssignment>;
};

/**
 * Each county's members across every release. A code is a member from the
 * first release it appears in, or without a start when that is the earliest
 * release, to the first release that no longer holds it, or without an end
 * while the latest does.
 */
export const countyMemberships = (
	releases: AuthorityRelease[],
	counties: CountyShape[],
): CountyMembership[] => {
	const ordered = [...releases].sort((left, right) =>
		left.month.localeCompare(right.month),
	);
	const seen = new Map<
		string,
		{
			county: string;
			first: number;
			last: number;
			assignment: CountyAssignment;
		}
	>();
	ordered.forEach((release, index) => {
		for (const { code, geometry } of release.authorities) {
			const known = seen.get(code);
			if (known) {
				known.last = index;
				continue;
			}
			const assignment = assignAuthority(geometry, counties);
			if (assignment)
				seen.set(code, {
					county: assignment.county,
					first: index,
					last: index,
					assignment,
				});
		}
	});
	const monthStart = (index: number) => `${ordered[index]!.month}-01`;
	return counties
		.map(({ name }) => {
			const entries = [...seen].filter(
				([, entry]) => entry.county === name,
			);
			return {
				county: name,
				members: entries
					.map(([code, { first, last }]) => ({
						code,
						validity: {
							from: first === 0 ? null : monthStart(first),
							to:
								last === ordered.length - 1
									? null
									: monthStart(last + 1),
						},
					}))
					.sort((left, right) => left.code.localeCompare(right.code)),
				split: entries
					.filter(
						([, { assignment }]) => assignment.elsewhere.length > 0,
					)
					.map(([code, { assignment }]) => ({ code, ...assignment })),
			};
		})
		.filter((membership) => membership.members.length > 0);
};

/** The names people use, where Boundary-Line's differ. */
const LABELS: Record<string, string> = {
	"City and County of the City of London": "City of London",
	Durham: "County Durham",
	"Tyne & Wear": "Tyne and Wear",
};

export const CEREMONIAL_COUNTY_SOURCE = {
	publisher: "Ordnance Survey" as const,
	dataset: "Boundary-Line ceremonial counties",
	edition: "2015",
	method: "Each local authority of every compiled release is a member of the county holding most of its area, sampled on a grid. A member is dated by the releases it appears in, not by the legal date of a reorganisation.",
};

/**
 * The named locations with ceremonial counties among them. A curated grouping
 * of the same name already means the county, and becomes it, keeping its id
 * so a caller's reference still resolves; a county sharing its name with an
 * official area, as the West Midlands shares the region's, is added beside it
 * as `{id}-ceremonial-county`.
 */
export const withCeremonialCounties = (
	locations: NamedLocation[],
	memberships: CountyMembership[],
	counties: CountyShape[],
): NamedLocation[] => {
	const byId = new Map(locations.map((location) => [location.id, location]));
	const partial = new Map<
		string,
		NonNullable<NamedLocation["partialMembers"]>
	>();
	const idOf = new Map<string, string>();
	const current = (
		codes: Array<{ code: string; validity: { to: string | null } }>,
	) =>
		codes
			.filter(({ validity }) => validity.to === null)
			.map(({ code }) => code)
			.sort()
			.join(",");
	// A county that is already an official area with the same councils, as
	// Hertfordshire is the ONS county, is that area; a second entry for it
	// would only be another answer to the same name.
	// Official lists keep superseded codes undated, for older releases, so
	// they are compared on the codes current anywhere.
	const currentAnywhere = new Set(
		memberships.flatMap(({ members }) => current(members).split(",")),
	);
	const counted = memberships.filter((membership) => {
		const existing = byId.get(
			idFor(LABELS[membership.county] ?? membership.county),
		);
		return !(
			existing &&
			existing.kind !== "editorial-grouping" &&
			existing.memberCodes
				.filter((code) => currentAnywhere.has(code))
				.sort()
				.join(",") === current(membership.members)
		);
	});
	for (const membership of counted) {
		const label = LABELS[membership.county] ?? membership.county;
		const existing = byId.get(idFor(label));
		idOf.set(
			membership.county,
			!existing || existing.kind === "editorial-grouping"
				? idFor(label)
				: idFor(`${label} ceremonial county`),
		);
	}
	for (const membership of counted)
		for (const split of membership.split)
			for (const other of split.elsewhere) {
				const entries = partial.get(other.county) ?? [];
				if (!entries.some((entry) => entry.code === split.code))
					entries.push({
						code: split.code,
						share: Math.round(other.share * 100) / 100,
						memberOf: idOf.get(membership.county)!,
					});
				partial.set(other.county, entries);
			}
	const shapes = new Map(counties.map((county) => [county.name, county]));
	for (const membership of counted) {
		const label = LABELS[membership.county] ?? membership.county;
		const id = idOf.get(membership.county)!;
		const replacing = byId.get(id);
		const bounds = shapes.get(membership.county)!.bounds;
		byId.set(id, {
			id,
			label: id === idFor(label) ? label : `${label} (ceremonial county)`,
			kind: "ceremonial-county",
			source: { ...CEREMONIAL_COUNTY_SOURCE, name: membership.county },
			// Taking over a curated grouping is a new definition of it.
			definitionRevision: (replacing?.definitionRevision ?? 0) + 1,
			memberGeography: "localAuthority",
			memberAssertions: membership.members,
			memberCodes: membership.members.map(({ code }) => code),
			validity: { from: null, to: null },
			// Rounded outwards, so the box still holds the whole county.
			bbox: [
				Math.floor(bounds[0] * 1e4) / 1e4,
				Math.floor(bounds[1] * 1e4) / 1e4,
				Math.ceil(bounds[2] * 1e4) / 1e4,
				Math.ceil(bounds[3] * 1e4) / 1e4,
			],
			...(partial.get(membership.county)
				? { partialMembers: partial.get(membership.county) }
				: {}),
		});
	}
	return [...byId.values()].sort((left, right) =>
		left.label.localeCompare(right.label),
	);
};

export const HISTORIC_COUNTY_SOURCE = {
	publisher: "Ordnance Survey" as const,
	dataset: "Boundary-Line historic counties",
	edition: "circa 1888",
	method: "Each local authority of every compiled release is assigned to the historic county holding most of its area, sampled on a grid.",
};

/** Add c.1888 historic counties without replacing contemporary definitions. */
export const withHistoricCounties = (
	locations: NamedLocation[],
	memberships: CountyMembership[],
	counties: CountyShape[],
): NamedLocation[] => {
	const shapes = new Map(counties.map((county) => [county.name, county]));
	return [
		...locations,
		...memberships.map((membership) => {
			const label = LABELS[membership.county] ?? membership.county;
			const bounds = shapes.get(membership.county)!.bounds;
			return {
				id: idFor(`${label} historic county`),
				label: `${label} (historic county)`,
				kind: "historic-county" as const,
				source: { ...HISTORIC_COUNTY_SOURCE, name: membership.county },
				definitionRevision: 1,
				memberGeography: "localAuthority",
				memberAssertions: membership.members,
				memberCodes: membership.members.map(({ code }) => code),
				validity: { from: null, to: null },
				bbox: [bounds[0], bounds[1], bounds[2], bounds[3]],
			};
		}),
	].sort((left, right) => left.label.localeCompare(right.label));
};
