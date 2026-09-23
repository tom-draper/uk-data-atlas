import { metresPerDegree } from "./areaDistance";
import { areaNotFound } from "./areaResources";
import type { BoundaryRelease } from "./boundaryRegistry";
import type {
	GeographyResolver,
	ResolvedContainingArea,
} from "./geographyResolver";
import {
	parseSelectionDate,
	releaseMonth,
	type ReleaseReference,
} from "./releaseForDate";
import {
	toWgs84Point,
	type GeometryProvenance,
	type GeometryTransformation,
} from "./reprojection";
import { problem, type ApiResponse } from "./routeResponse";
import { geographyResolverFor, type RouteContext } from "./routing";

/** A lookup reads one release per geography, and each is held in memory. */
export const MAX_LOOKUP_GEOGRAPHIES = 4;

export type LookupPoint = {
	lng: number;
	lat: number;
	crs: "EPSG:4326";
	/** The coordinate as supplied, when it was transformed into WGS 84. */
	input?: {
		crs: "EPSG:27700" | "EPSG:29902";
		easting: number;
		northing: number;
		/** Present when an Ordnance Survey National Grid reference was supplied. */
		gridReference?: {
			value: string;
			cellSizeM: number;
			position: "cell-centre";
		};
		transformation: GeometryTransformation;
	};
	precision: {
		decimalPlaces:
			| { lng: number; lat: number }
			| { easting: number; northing: number }
			| { gridReference: { easting: number; northing: number } };
		/**
		 * How far the true position may lie from the coordinate, in metres on
		 * the ground: the caller's stated accuracy, or else half the last
		 * written decimal place.
		 */
		uncertaintyM: number;
		basis:
			| "stated-accuracy"
			| "decimal-places"
			| "stated-accuracy-and-transformation"
			| "decimal-places-and-transformation"
			| "grid-reference-and-transformation"
			| "stated-accuracy-and-grid-reference-and-transformation";
	};
};

export type LookupInputCrs = "EPSG:4326" | "EPSG:27700" | "EPSG:29902";

/** The largest accuracy a caller may state, in metres. */
export const MAX_STATED_ACCURACY_M = 100000;

const coordinatePart = (
	text: string | undefined,
	minimum: number,
	maximum: number,
) => {
	const trimmed = text?.trim() ?? "";
	// Plain decimals only: an exponent hides the precision the caller wrote.
	if (!/^[+-]?\d+(\.\d+)?$/.test(trimmed)) return undefined;
	const value = Number(trimmed);
	return value >= minimum && value <= maximum
		? { value, decimalPlaces: trimmed.split(".")[1]?.length ?? 0 }
		: undefined;
};

const roundM = (metres: number) => Math.round(metres * 100) / 100;

/** The deliberately small CRS vocabulary the public point endpoints accept. */
export const parseLookupCrs = (
	text: string | null,
): LookupInputCrs | undefined => {
	if (text === null) return "EPSG:4326";
	return text === "EPSG:4326" ||
		text === "EPSG:27700" ||
		text === "EPSG:29902"
		? text
		: undefined;
};

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

/**
 * A WGS84 coordinate as written, with its uncertainty. Written decimals only
 * bound precision from below, since a client may drop trailing zeros, so a
 * caller that knows its accuracy, such as a GPS fix, can state it instead.
 */
export const parseLookupPoint = (
	lngText: string | undefined,
	latText: string | undefined,
	statedAccuracyM?: number,
): LookupPoint | undefined => {
	const lng = coordinatePart(lngText, -180, 180);
	const lat = coordinatePart(latText, -90, 90);
	if (!lng || !lat) return undefined;
	const scale = metresPerDegree(lat.value);
	return {
		lng: lng.value,
		lat: lat.value,
		crs: "EPSG:4326",
		precision: {
			decimalPlaces: { lng: lng.decimalPlaces, lat: lat.decimalPlaces },
			...(statedAccuracyM === undefined
				? {
						uncertaintyM: roundM(
							Math.max(
								0.5 *
									10 ** -lng.decimalPlaces *
									scale.longitude,
								0.5 * 10 ** -lat.decimalPlaces * scale.latitude,
							),
						),
						basis: "decimal-places" as const,
					}
				: {
						uncertaintyM: statedAccuracyM,
						basis: "stated-accuracy" as const,
					}),
		},
	};
};

const projectedBounds: Record<
	Exclude<LookupInputCrs, "EPSG:4326">,
	{ easting: [number, number]; northing: [number, number] }
> = {
	// Bounds are deliberately wider than the transformation's stated area of
	// use. A coordinate outside it still receives the transformation metadata;
	// the subsequent country/area result says whether an Atlas geometry covers
	// the point, rather than silently clipping a valid edge case.
	"EPSG:27700": { easting: [-100000, 900000], northing: [-100000, 1400000] },
	"EPSG:29902": { easting: [-100000, 500000], northing: [0, 600000] },
};

/** Whether a projected coordinate is in the public lookup range for its CRS. */
export const isProjectedLookupPointInBounds = (
	crs: Exclude<LookupInputCrs, "EPSG:4326">,
	[easting, northing]: [number, number],
) => {
	const bounds = projectedBounds[crs];
	return (
		easting >= bounds.easting[0] &&
		easting <= bounds.easting[1] &&
		northing >= bounds.northing[0] &&
		northing <= bounds.northing[1]
	);
};

const projectedLookupPoint = (
	crs: Exclude<LookupInputCrs, "EPSG:4326">,
	eastingText: string | undefined,
	northingText: string | undefined,
	statedAccuracyM?: number,
): LookupPoint | undefined => {
	const bounds = projectedBounds[crs];
	const easting = coordinatePart(
		eastingText,
		bounds.easting[0],
		bounds.easting[1],
	);
	const northing = coordinatePart(
		northingText,
		bounds.northing[0],
		bounds.northing[1],
	);
	if (!easting || !northing) return undefined;
	return projectedLookupPointFromParts(
		crs,
		easting,
		northing,
		statedAccuracyM,
	);
};

type ProjectedCoordinate = { value: number; decimalPlaces: number };

type BritishGridReference = {
	value: string;
	easting: number;
	northing: number;
	cellSizeM: number;
	digits: number;
};

export type FormattedBritishGridReference = {
	value: string;
	digits: number;
	cellSizeM: number;
	position: "containing-cell";
};

const britishGridLetters = "ABCDEFGHJKLMNOPQRSTUVWXYZ";

/**
 * Format a British National Grid coordinate as the square containing it. The
 * returned reference is never finer than its positional uncertainty permits:
 * an output cell's half-diagonal must cover that uncertainty. This avoids
 * making a grid reference look more exact than its source coordinate.
 */
export const formatBritishGridReference = (
	[easting, northing]: [number, number],
	uncertaintyM: number,
	maximumDigits = 5,
): FormattedBritishGridReference | undefined => {
	if (!Number.isFinite(uncertaintyM) || uncertaintyM < 0) return undefined;
	const easting100km = Math.floor(easting / 100000);
	const northing100km = Math.floor(northing / 100000);
	if (
		easting100km < 0 ||
		easting100km > 6 ||
		northing100km < 0 ||
		northing100km > 12
	)
		return undefined;
	let digits = Math.min(5, Math.max(1, maximumDigits));
	while (
		digits > 0 &&
		(10 ** (5 - digits) * Math.SQRT2) / 2 < uncertaintyM
	)
		digits -= 1;
	if (digits === 0) return undefined;
	const firstRow = Math.floor((19 - northing100km) / 5);
	const firstColumn = (Math.floor(easting100km / 5) + 2) % 5;
	const secondRow = 19 - firstRow * 5 - northing100km;
	const secondColumn = easting100km % 5;
	const first = britishGridLetters[firstRow * 5 + firstColumn];
	const second = britishGridLetters[secondRow * 5 + secondColumn];
	if (!first || !second) return undefined;
	const cellSizeM = 10 ** (5 - digits);
	const eastingDigits = String(
		Math.floor((easting - easting100km * 100000) / cellSizeM),
	).padStart(digits, "0");
	const northingDigits = String(
		Math.floor((northing - northing100km * 100000) / cellSizeM),
	).padStart(digits, "0");
	return {
		value: `${first}${second} ${eastingDigits} ${northingDigits}`,
		digits,
		cellSizeM,
		position: "containing-cell",
	};
};

/**
 * Decode the standard two-letter Ordnance Survey National Grid notation.
 * A grid reference denotes a square, so its returned coordinate is the cell
 * centre and the precision reports the whole half-diagonal, never a false
 * point-level accuracy.
 */
const parseBritishGridReference = (
	text: string | undefined,
): BritishGridReference | undefined => {
	const compact = text?.trim().toUpperCase().replace(/[\s-]/g, "") ?? "";
	const match = /^([A-HJ-Z]{2})(\d{2,10})$/.exec(compact);
	if (!match || match[2].length % 2 !== 0) return undefined;
	const first = britishGridLetters.indexOf(match[1][0]!);
	const second = britishGridLetters.indexOf(match[1][1]!);
	if (first < 0 || second < 0) return undefined;
	const digits = match[2];
	const digitsPerCoordinate = digits.length / 2;
	const cellSizeM = 10 ** (5 - digitsPerCoordinate);
	const easting100km = ((first - 2 + 5) % 5) * 5 + (second % 5);
	const northing100km =
		19 - Math.floor(first / 5) * 5 - Math.floor(second / 5);
	const eastingDigits = digits.slice(0, digitsPerCoordinate);
	const northingDigits = digits.slice(digitsPerCoordinate);
	const southWestEasting =
		easting100km * 100000 + Number(eastingDigits) * cellSizeM;
	const southWestNorthing =
		northing100km * 100000 + Number(northingDigits) * cellSizeM;
	const bounds = projectedBounds["EPSG:27700"];
	const easting = southWestEasting + cellSizeM / 2;
	const northing = southWestNorthing + cellSizeM / 2;
	if (
		easting < bounds.easting[0] ||
		easting > bounds.easting[1] ||
		northing < bounds.northing[0] ||
		northing > bounds.northing[1]
	)
		return undefined;
	return {
		value: `${match[1]} ${eastingDigits} ${northingDigits}`,
		easting,
		northing,
		cellSizeM,
		digits: digitsPerCoordinate,
	};
};

const projectedLookupPointFromParts = (
	crs: Exclude<LookupInputCrs, "EPSG:4326">,
	easting: ProjectedCoordinate,
	northing: ProjectedCoordinate,
	statedAccuracyM?: number,
	gridReference?: BritishGridReference,
): LookupPoint => {
	const { position, transformation } = toWgs84Point(
		[easting.value, northing.value],
		crs,
	);
	const coordinateUncertainty =
		gridReference === undefined
			? (statedAccuracyM ??
				0.5 *
					Math.max(
						10 ** -easting.decimalPlaces,
						10 ** -northing.decimalPlaces,
					))
			: Math.max(
					statedAccuracyM ?? 0,
					(gridReference.cellSizeM * Math.SQRT2) / 2,
				);
	return {
		lng: position[0],
		lat: position[1],
		crs: "EPSG:4326",
		input: {
			crs,
			easting: easting.value,
			northing: northing.value,
			...(gridReference
				? {
						gridReference: {
							value: gridReference.value,
							cellSizeM: gridReference.cellSizeM,
							position: "cell-centre" as const,
						},
					}
				: {}),
			transformation: transformation!,
		},
		precision: {
			decimalPlaces: gridReference
				? {
						gridReference: {
							easting: gridReference.digits,
							northing: gridReference.digits,
						},
					}
				: {
						easting: easting.decimalPlaces,
						northing: northing.decimalPlaces,
					},
			// This is conservative: it does not present two independent accuracy
			// declarations as though they can cancel one another out.
			uncertaintyM: roundM(
				coordinateUncertainty + transformation!.accuracyM,
			),
			basis: gridReference
				? statedAccuracyM !== undefined &&
					statedAccuracyM > (gridReference.cellSizeM * Math.SQRT2) / 2
					? "stated-accuracy-and-grid-reference-and-transformation"
					: "grid-reference-and-transformation"
				: statedAccuracyM === undefined
					? "decimal-places-and-transformation"
					: "stated-accuracy-and-transformation",
		},
	};
};

/** Parse a WGS 84, British National Grid or Irish Grid lookup coordinate. */
export const parseLookupCoordinate = (
	crs: LookupInputCrs,
	values: {
		lng?: string;
		lat?: string;
		easting?: string;
		northing?: string;
		gridReference?: string;
	},
	statedAccuracyM?: number,
): LookupPoint | undefined => {
	if (crs === "EPSG:4326")
		return values.easting === undefined &&
			values.northing === undefined &&
			values.gridReference === undefined
			? parseLookupPoint(values.lng, values.lat, statedAccuracyM)
			: undefined;
	if (values.lng !== undefined || values.lat !== undefined) return undefined;
	if (crs !== "EPSG:27700" || values.gridReference === undefined)
		return values.gridReference === undefined
			? projectedLookupPoint(
					crs,
					values.easting,
					values.northing,
					statedAccuracyM,
				)
			: undefined;
	if (values.easting !== undefined || values.northing !== undefined)
		return undefined;
	const gridReference = parseBritishGridReference(values.gridReference);
	return gridReference
		? projectedLookupPointFromParts(
				crs,
				{ value: gridReference.easting, decimalPlaces: 0 },
				{ value: gridReference.northing, decimalPlaces: 0 },
				statedAccuracyM,
				gridReference,
			)
		: undefined;
};

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

/**
 * The boundary release each requested geography is read from. A release is
 * either pinned as `release={geography}/{release}`, or chosen for `date` as
 * the latest one dated on or before it. Nothing is chosen silently: a
 * geography with neither is refused, and a date that fits no release, or fits
 * several equally, says so in that geography's result.
 */
export const parseLookupRequest = (
	context: RouteContext,
	searchParams: URLSearchParams,
): LookupRequest | ApiResponse => {
	const geographies = [
		...new Set(searchParams.getAll("geography").filter(Boolean)),
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
			return problem(
				400,
				"Invalid Query",
				"Name each release with its geography, as release={geography}/{release}. A bare release id is accepted only when a single geography is requested.",
			);
		if (pinned.has(geography) && pinned.get(geography) !== boundaryRelease)
			return problem(
				400,
				"Invalid Query",
				`More than one release is pinned for ${geography}; a lookup reads one release per geography.`,
			);
		pinned.set(geography, boundaryRelease);
		if (!geographies.includes(geography)) geographies.push(geography);
	}
	if (geographies.length === 0)
		return problem(
			400,
			"Invalid Query",
			"Name at least one geography, as geography= or release={geography}/{release}.",
		);
	if (geographies.length > MAX_LOOKUP_GEOGRAPHIES)
		return problem(
			400,
			"Invalid Query",
			`At most ${MAX_LOOKUP_GEOGRAPHIES} geographies can be looked up in one request; this one names ${geographies.length}.`,
		);
	const dateText = searchParams.get("date");
	const date = dateText === null ? undefined : parseSelectionDate(dateText);
	if (dateText !== null && !date)
		return problem(
			400,
			"Invalid Query",
			"date must be a calendar date as YYYY-MM-DD, or a month as YYYY-MM.",
		);
	const unselected = geographies.filter(
		(geography) => !pinned.has(geography),
	);
	if (!date && unselected.length > 0)
		return problem(
			400,
			"Invalid Query",
			`No release is selected for ${unselected.join(", ")}. Pin one as release={geography}/{release}, or give a date to use the latest release dated on or before it.`,
		);
	const { boundaryRegistry, geographyResolver } = context;
	const releases: LookupRelease[] = [];
	for (const geography of geographies) {
		const pinnedRelease = pinned.get(geography);
		if (pinnedRelease !== undefined || !date) {
			const release = boundaryRegistry.releases.find(
				(candidate) =>
					candidate.geography === geography &&
					candidate.id === pinnedRelease,
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
			date.month,
		);
		if (!selected)
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the geography resolver and boundary registry before selecting a release by date.",
			);
		const selection = {
			policy: "latest-release-dated-on-or-before" as const,
			date: date.date,
		};
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
			const release = boundaryRegistry.releases.find(
				(candidate) =>
					candidate.geography === geography &&
					candidate.id === selected.selected.id,
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
				selection: {
					...selection,
					sameMonth: selected.sameMonth,
					next: selected.next,
				},
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

/** The country release to place a point with: for the date, else the latest. */
const countryRelease = (
	context: RouteContext,
	month: string | undefined,
): string | undefined => {
	const resolver = geographyResolverFor(context);
	const dated = resolver.boundaryReleasesFor("country")
		.filter(
			(release) =>
				release.geography === "country" &&
				releaseMonth(release.id) !== undefined &&
				resolver.hasAreaRelease(
					"country",
					release.id,
				),
		)
		.sort((left, right) => left.id.localeCompare(right.id));
	if (dated.length === 0) return undefined;
	if (month === undefined) return dated.at(-1)!.id;
	return (
		dated.filter((release) => releaseMonth(release.id)! <= month).at(-1) ??
		dated[0]!
	).id;
};

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
 */
export const locatePoints = (
	context: RouteContext,
	geographyResolver: GeographyResolver,
	request: LookupRequest,
	points: LookupPoint[],
): Array<{ country: PointCountry; results: PointResult[] }> => {
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
				found =
					geographyResolver.containingAreas(
						geography,
						boundaryRelease,
						[point.lng, point.lat],
					) ?? [];
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
		const countryReleaseId = countryRelease(context, request.date?.month);
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
				const countries =
					geographyResolver.containingAreas(
						"country",
						countryReleaseId,
						[point.lng, point.lat],
					) ?? [];
				const code = countries
					.map((country) => countryOfCode(country.code))
					.find(Boolean);
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
