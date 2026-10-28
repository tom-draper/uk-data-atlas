import { areaNotFound } from "@uk-data-atlas/atlas-runtime/areas";
import type { BoundaryRelease } from "@uk-data-atlas/catalogue";
import type {
	GeographyResolver,
	ResolvedContainingArea,
} from "@uk-data-atlas/atlas-runtime/areas";
import {
	parseSelectionDate,
	type ReleaseReference,
} from "@uk-data-atlas/atlas-runtime/areas";
import { type GeometryProvenance } from "@uk-data-atlas/geography/coordinates";
import {
	invalidQuery,
	problem,
	type ApiResponse,
} from "@uk-data-atlas/atlas-runtime/api";
import type { RouteContext } from "@uk-data-atlas/atlas-runtime/areas";
import { readChoice } from "@uk-data-atlas/atlas-runtime/api";
import { QUERY_RULES } from "./queryRules";

/** A lookup reads one release per geography, and each is held in memory. */
export const MAX_LOOKUP_GEOGRAPHIES = 4;

import {
	roundM,
	parseLookupPoint,
	parseLookupCoordinate,
	isProjectedLookupPointInBounds,
	formatBritishGridReference,
	MAX_STATED_ACCURACY_M,
	type LookupPoint,
	type LookupInputCrs,
} from "@uk-data-atlas/geography/coordinates";
export * from "@uk-data-atlas/geography/coordinates";

// Every point endpoint states the same `crs`, which a test holds them to.
const CRS = QUERY_RULES["GET /areas:contains"].crs;

/** The deliberately small CRS vocabulary the public point endpoints accept. */
export const parseLookupCrs = (
	text: string | null,
): LookupInputCrs | undefined => readChoice(text, CRS) ?? undefined;

/** A stated accuracy in metres; undefined when absent, null when malformed. */
export const parseStatedAccuracy = (
	text: string | null | undefined,
): number | null | undefined => {
	if (text === null || text === undefined) return undefined;
	const trimmed = text.trim();
	const value = Number(trimmed);
	return /^\d+(\.\d+)?$/.test(trimmed) &&
		value > 0 &&
		value <= MAX_STATED_ACCURACY_M
		? value
		: null;
};

/** The accepted WGS 84 longitude spellings, preferring the canonical `lng`. */
export const lookupLongitude = (searchParams: URLSearchParams) =>
	searchParams.get("lng") ??
	searchParams.get("lon") ??
	searchParams.get("longitude") ??
	undefined;

export type BoundaryResolution =
	| {
			generalisation: string;
			extent: "clipped-to-coastline" | "full-extent-of-realm";
			/** How far a generalised boundary may stray from the surveyed one. */
			toleranceM: number;
			basis: "ons-release-name";
	  }
	| { generalisation: "undeclared" };

// ONS names each boundary product by resolution and extent. Nothing else in a
// release records how much its lines were generalised.
const ONS_RESOLUTIONS: Record<
	string,
	Omit<Extract<BoundaryResolution, { basis: string }>, "basis">
> = {
	bfc: {
		generalisation: "full-resolution",
		extent: "clipped-to-coastline",
		toleranceM: 0,
	},
	bfe: {
		generalisation: "full-resolution",
		extent: "full-extent-of-realm",
		toleranceM: 0,
	},
	bgc: {
		generalisation: "generalised-20m",
		extent: "clipped-to-coastline",
		toleranceM: 20,
	},
	bge: {
		generalisation: "generalised-20m",
		extent: "full-extent-of-realm",
		toleranceM: 20,
	},
	bsc: {
		generalisation: "super-generalised-200m",
		extent: "clipped-to-coastline",
		toleranceM: 200,
	},
	buc: {
		generalisation: "ultra-generalised-500m",
		extent: "clipped-to-coastline",
		toleranceM: 500,
	},
};

export const boundaryResolution = (releaseId: string): BoundaryResolution => {
	const token = releaseId.split("-").find((part) => part in ONS_RESOLUTIONS);
	return token
		? { ...ONS_RESOLUTIONS[token]!, basis: "ons-release-name" }
		: { generalisation: "undeclared" };
};

export type ReleaseSelectionPolicy =
	| { policy: "pinned" }
	| {
			/** No date was supplied, so the newest unambiguous published release was used. */
			policy: "latest-published";
	  }
	| {
			policy: "latest-release-dated-on-or-before";
			date: string;
			sameMonth?: boolean;
			next?: ReleaseReference | null;
	  };

export type LookupRelease =
	| {
			status: "selected";
			geography: string;
			boundaryRelease: string;
			release: BoundaryRelease;
			selection: ReleaseSelectionPolicy;
	  }
	| {
			status: "ambiguous-release" | "no-release-for-date";
			geography: string;
			selection: ReleaseSelectionPolicy;
			detail: string;
			choices?: ReleaseReference[];
			earliest?: ReleaseReference;
	  };

export type LookupRequest = {
	releases: LookupRelease[];
	date?: { date: string; month: string };
};

/** The newest unambiguous compiled release for a geography, for routes with one release input. */
export const latestPublishedBoundaryRelease = (
	context: RouteContext,
	geography: string,
): { id: string; selection: "latest-published" } | ApiResponse => {
	const selected = context.geographyResolver.selectReleaseForDate(
		geography,
		"9999-12",
	);
	if (!selected) {
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the geography resolver and boundary registry before selecting the current release.",
		);
	}
	if (selected.status === "none") return areaNotFound(context, geography);
	if (selected.status === "ambiguous")
		return problem(
			409,
			"Ambiguous Release",
			`Several ${geography} boundary releases are equally current. Name one explicitly; each is listed in choices.`,
			{ code: "ambiguous_release", choices: selected.choices },
		);
	if (
		!context.geographyResolver.hasAreaRelease(
			geography,
			selected.selected.id,
		)
	)
		return areaNotFound(context, geography, selected.selected.id);
	return { id: selected.selected.id, selection: "latest-published" };
};

/**
 * The boundary release each requested geography is read from. A release is
 * either pinned as `release={geography}/{release}`, chosen for `date` as the
 * latest one dated on or before it, or defaults to its newest published
 * release. The release selection is always returned beside the result.
 */
export const parseLookupRequest = (
	context: RouteContext,
	searchParams: URLSearchParams,
): LookupRequest | ApiResponse => {
	const geographies = [
		...new Set(
			searchParams
				.getAll("geography")
				.flatMap((value) => value.split(","))
				.map((value) => value.trim())
				.filter(Boolean),
		),
	];
	const pinned = new Map<string, string>();
	for (const value of searchParams.getAll("release")) {
		const slash = value.indexOf("/");
		const geography =
			slash === -1
				? geographies.length === 1
					? geographies[0]
					: undefined
				: value.slice(0, slash);
		const boundaryRelease = slash === -1 ? value : value.slice(slash + 1);
		if (!geography || !boundaryRelease)
			return invalidQuery(
				"Name each release with its geography, as release={geography}/{release}. A bare release id is accepted only when a single geography is requested.",
			);
		if (pinned.has(geography) && pinned.get(geography) !== boundaryRelease)
			return invalidQuery(
				`More than one release is pinned for ${geography}; a lookup reads one release per geography.`,
			);
		pinned.set(geography, boundaryRelease);
		if (!geographies.includes(geography)) geographies.push(geography);
	}
	if (geographies.length === 0)
		return invalidQuery(
			"Name at least one geography, as geography= or release={geography}/{release}.",
		);
	if (geographies.length > MAX_LOOKUP_GEOGRAPHIES)
		return invalidQuery(
			`At most ${MAX_LOOKUP_GEOGRAPHIES} geographies can be looked up in one request; this one names ${geographies.length}.`,
		);
	const dateText = searchParams.get("date");
	const date = dateText === null ? undefined : parseSelectionDate(dateText);
	if (dateText !== null && !date)
		return invalidQuery(
			"date must be a calendar date as YYYY-MM-DD, or a month as YYYY-MM.",
		);
	const { geographyResolver } = context;
	const releases: LookupRelease[] = [];
	for (const geography of geographies) {
		const pinnedRelease = pinned.get(geography);
		if (pinnedRelease === "latest") {
			const current = latestPublishedBoundaryRelease(context, geography);
			if ("status" in current) return current;
			const release = geographyResolver.boundaryRelease(
				geography,
				current.id,
			);
			if (!release) return areaNotFound(context, geography, current.id);
			releases.push({
				status: "selected",
				geography,
				boundaryRelease: release.id,
				release,
				selection: { policy: current.selection },
			});
			continue;
		}
		if (pinnedRelease !== undefined) {
			const release = geographyResolver.boundaryRelease(
				geography,
				pinnedRelease!,
			);
			if (
				!release ||
				!geographyResolver?.hasAreaRelease(geography, release.id)
			)
				return areaNotFound(context, geography, pinnedRelease);
			releases.push({
				status: "selected",
				geography,
				boundaryRelease: release.id,
				release,
				selection: { policy: "pinned" },
			});
			continue;
		}
		const selected = geographyResolver?.selectReleaseForDate(
			geography,
			date?.month ?? "9999-12",
		);
		if (!selected)
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the geography resolver and boundary registry before selecting a release by date.",
			);
		const selection: ReleaseSelectionPolicy = date
			? {
					policy: "latest-release-dated-on-or-before" as const,
					date: date.date,
				}
			: { policy: "latest-published" as const };
		if (selected.status === "none") {
			if (selected.absence === "unknown-geography")
				return areaNotFound(context, geography);
			releases.push({
				status: "no-release-for-date",
				geography,
				selection,
				detail: selected.detail,
				...(selected.earliest ? { earliest: selected.earliest } : {}),
			});
		} else if (selected.status === "ambiguous") {
			releases.push({
				status: "ambiguous-release",
				geography,
				selection,
				detail: `${selected.choices.length} ${geography} boundary releases are dated ${selected.month} and differ in more than coverage. Pin one as release={geography}/{release}.`,
				choices: selected.choices,
			});
		} else {
			const release = geographyResolver.boundaryRelease(
				geography,
				selected.selected.id,
			);
			if (
				!release ||
				!geographyResolver?.hasAreaRelease(geography, release.id)
			)
				return areaNotFound(context, geography, selected.selected.id);
			releases.push({
				status: "selected",
				geography,
				boundaryRelease: release.id,
				release,
				selection: date
					? {
							policy: "latest-release-dated-on-or-before",
							date: date.date,
							sameMonth: selected.sameMonth,
							next: selected.next,
						}
					: selection,
			});
		}
	}
	return { releases, ...(date ? { date } : {}) };
};

/** What a caller needs to know about a release before reading any match. */
export const describeLookupRelease = (
	geographyResolver: GeographyResolver,
	lookupRelease: LookupRelease,
) => {
	if (lookupRelease.status !== "selected") {
		const { status, geography, selection, detail, choices, earliest } =
			lookupRelease;
		return {
			geography,
			selection,
			status,
			detail,
			...(choices ? { choices } : {}),
			...(earliest ? { earliest } : {}),
		};
	}
	const { geography, boundaryRelease, release, selection } = lookupRelease;
	let geometrySource: GeometryProvenance | undefined;
	let unavailable: string | undefined;
	try {
		geometrySource = geographyResolver.releaseGeometrySource(
			geography,
			boundaryRelease,
		);
	} catch (error) {
		unavailable =
			error instanceof Error
				? error.message
				: "Geometry could not be loaded for this release.";
	}
	return {
		geography,
		boundaryRelease,
		href: `/v1/boundary-releases/${geography}/${boundaryRelease}`,
		selection,
		coverage: release.coverage,
		boundaryResolution: boundaryResolution(boundaryRelease),
		...(geometrySource ? { geometrySource } : {}),
		source: {
			publisher: release.source.publisher,
			licence: release.source.licence,
		},
		...(unavailable
			? { status: "geometry-unavailable" as const, detail: unavailable }
			: {}),
	};
};

export type LookupStatus =
	| "matched"
	| "no-match"
	| "outside-coverage"
	| "ambiguous-release"
	| "no-release-for-date"
	| "geometry-unavailable";

export type PointMatch = Omit<ResolvedContainingArea, "distanceToBoundaryM"> & {
	distanceToBoundaryM: number;
	/**
	 * The point lies within the positional tolerance of this area's edge, so
	 * the coordinate or the boundary's generalisation could put it on the
	 * other side.
	 */
	nearBoundary: boolean;
};

export type PointResult = {
	geography: string;
	boundaryRelease?: string;
	status: LookupStatus;
	reason?: "country-not-covered" | "outside-uk-boundaries";
	detail?: string;
	/**
	 * Coordinate uncertainty, boundary generalisation and transformation
	 * accuracy together: an edge nearer than this cannot be trusted.
	 */
	positionalToleranceM?: number;
	matches: PointMatch[];
};

export type PointCountry =
	| {
			code: string;
			determinedBy: "area-code";
			area: string;
	  }
	| {
			code: string;
			determinedBy: "country-boundary";
			boundaryRelease: string;
	  }
	| {
			code: null;
			determinedBy: "country-boundary";
			boundaryRelease: string;
	  }
	| { code: null; determinedBy: "undetermined"; detail: string };

const COUNTRY_BY_PREFIX: Record<string, string> = {
	E: "GB-ENG",
	N: "GB-NIR",
	S: "GB-SCT",
	W: "GB-WLS",
};

/** The UK country a GSS code belongs to; undefined for cross-border codes. */
export const countryOfCode = (code: string) =>
	/^[ENSW]\d{8}$/.test(code) ? COUNTRY_BY_PREFIX[code[0]!] : undefined;

export { countryRelease } from "@uk-data-atlas/atlas-runtime/areas";
import { countryRelease } from "@uk-data-atlas/atlas-runtime/areas";

const tolerance = (
	point: LookupPoint,
	boundaryReleaseId: string,
	geometrySource: GeometryProvenance | undefined,
) => {
	const resolution = boundaryResolution(boundaryReleaseId);
	return roundM(
		point.precision.uncertaintyM +
			("toleranceM" in resolution ? resolution.toleranceM : 0) +
			(geometrySource?.transformation?.accuracyM ?? 0),
	);
};

/**
 * Every requested release's containing areas for each point, and the country
 * each point lies in.
 *
 * The work runs one release at a time across all points, so a batch reads
 * each release's geometry once rather than once per point. A point matching
 * nothing is only called outside a release's coverage when its country is
 * known: from a code it matched elsewhere, or else from the country
 * boundaries, which are read last and only for points that need them.
 *
 * A point that is a postcode's centroid may name the postcode, and a release
 * the postcode area index holds is then answered from it without reading
 * geometry; its answer is the one the geometry would give.
 */
export const locatePoints = (
	geographyResolver: GeographyResolver,
	request: LookupRequest,
	points: LookupPoint[],
	postcodes: Array<string | undefined> = [],
): Array<{ country: PointCountry; results: PointResult[] }> => {
	const containing = (
		index: number,
		geography: string,
		boundaryRelease: string,
		point: LookupPoint,
	) => {
		const postcode = postcodes[index];
		return (
			(postcode === undefined
				? undefined
				: geographyResolver.postcodeContainingAreas(
						postcode,
						geography,
						boundaryRelease,
					)) ??
			geographyResolver.containingAreas(geography, boundaryRelease, [
				point.lng,
				point.lat,
			]) ??
			[]
		);
	};
	const located = points.map(() => ({
		country: undefined as PointCountry | undefined,
		results: [] as PointResult[],
	}));
	for (const lookupRelease of request.releases) {
		if (lookupRelease.status !== "selected") {
			for (const entry of located)
				entry.results.push({
					geography: lookupRelease.geography,
					status: lookupRelease.status,
					matches: [],
				});
			continue;
		}
		const { geography, boundaryRelease } = lookupRelease;
		let geometrySource: GeometryProvenance | undefined;
		let unavailable: string | undefined;
		try {
			geometrySource = geographyResolver.releaseGeometrySource(
				geography,
				boundaryRelease,
			);
		} catch (error) {
			unavailable =
				error instanceof Error
					? error.message
					: "Geometry could not be loaded for this release.";
		}
		points.forEach((point, index) => {
			const results = located[index]!.results;
			if (unavailable !== undefined) {
				results.push({
					geography,
					boundaryRelease,
					status: "geometry-unavailable",
					detail: unavailable,
					matches: [],
				});
				return;
			}
			const positionalToleranceM = tolerance(
				point,
				boundaryRelease,
				geometrySource,
			);
			let found: ResolvedContainingArea[];
			try {
				found = containing(index, geography, boundaryRelease, point);
			} catch (error) {
				results.push({
					geography,
					boundaryRelease,
					status: "geometry-unavailable",
					detail:
						error instanceof Error
							? error.message
							: "Geometry could not be loaded for this release.",
					matches: [],
				});
				return;
			}
			results.push({
				geography,
				boundaryRelease,
				// Settled once the point's country is known.
				status: found.length > 0 ? "matched" : "no-match",
				positionalToleranceM,
				matches: found.map((match) => ({
					...match,
					distanceToBoundaryM: roundM(match.distanceToBoundaryM),
					nearBoundary:
						match.distanceToBoundaryM <= positionalToleranceM,
				})),
			});
		});
	}

	for (const entry of located) {
		for (const result of entry.results)
			for (const match of result.matches) {
				const code = countryOfCode(match.code);
				if (code && !entry.country)
					entry.country = {
						code,
						determinedBy: "area-code",
						area: match.id,
					};
			}
	}
	const needCountry = located.flatMap((entry, index) =>
		!entry.country &&
		entry.results.some((result) => result.status === "no-match")
			? [index]
			: [],
	);
	if (needCountry.length > 0) {
		const countryReleaseId = countryRelease(
			geographyResolver,
			request.date?.month,
		);
		for (const index of needCountry) {
			const entry = located[index]!;
			const point = points[index]!;
			if (!countryReleaseId) {
				entry.country = {
					code: null,
					determinedBy: "undetermined",
					detail: "No country boundary release is compiled to place the point in.",
				};
				continue;
			}
			try {
				// Only which country holds the point matters here, so its
				// distance to the coastline is not measured.
				const postcode = postcodes[index];
				const countries =
					(postcode === undefined
						? undefined
						: geographyResolver.postcodeContainingAreas(
								postcode,
								"country",
								countryReleaseId,
							)
					)?.map((country) => country.code) ??
					geographyResolver.containingCodes(
						"country",
						countryReleaseId,
						[point.lng, point.lat],
					) ??
					[];
				const code = countries.map(countryOfCode).find(Boolean);
				entry.country = code
					? {
							code,
							determinedBy: "country-boundary",
							boundaryRelease: countryReleaseId,
						}
					: {
							code: null,
							determinedBy: "country-boundary",
							boundaryRelease: countryReleaseId,
						};
			} catch (error) {
				entry.country = {
					code: null,
					determinedBy: "undetermined",
					detail:
						error instanceof Error
							? error.message
							: "Country geometry could not be loaded.",
				};
			}
		}
	}

	return located.map((entry) => {
		const country: PointCountry = entry.country ?? {
			code: null,
			determinedBy: "undetermined",
			detail: "No area matched the point with a country code, and no lookup needed its country.",
		};
		return {
			country,
			results: entry.results.map((result, releaseIndex) => {
				if (result.status !== "no-match") return result;
				const lookupRelease = request.releases[releaseIndex]!;
				const countries =
					lookupRelease.status === "selected"
						? lookupRelease.release.coverage.countries
						: [];
				if (
					country.code === null &&
					country.determinedBy === "country-boundary"
				)
					return {
						...result,
						status: "outside-coverage",
						reason: "outside-uk-boundaries",
						detail: `No UK country in country/${country.boundaryRelease} contains the point: it lies offshore, outside the UK, or within that release's generalisation of the coast.`,
					};
				if (country.code !== null && !countries.includes(country.code))
					return {
						...result,
						status: "outside-coverage",
						reason: "country-not-covered",
						detail: `${result.geography}/${result.boundaryRelease} covers ${countries.join(", ")}, and the point lies in ${country.code}.`,
					};
				return {
					...result,
					detail:
						country.code === null
							? `No ${result.geography} area in ${result.boundaryRelease} contains the point, and its country could not be determined.`
							: `No ${result.geography} area in ${result.boundaryRelease} contains the point, although the release covers ${country.code}. A geography need not cover all of a country, and generalised boundaries leave gaps along coasts and estuaries.`,
				};
			}),
		};
	});
};

export const CONTAINMENT_NOTE =
	"Containment is tested against each release's published geometry, not against surveyed ground. A point on an edge belongs to every area sharing it and is labelled boundary. nearBoundary marks a match whose edge lies within positionalToleranceM, the sum of the coordinate's written precision, the boundary's generalisation and the accuracy of any transformation to WGS 84; there, a more precise coordinate or boundary could change the answer.";
