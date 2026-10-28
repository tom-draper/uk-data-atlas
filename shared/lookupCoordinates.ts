import { metresPerDegree } from "@uk-data-atlas/geography/area-distance";
import { toWgs84Point, type GeometryTransformation } from "./reprojection";

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

export const roundM = (metres: number) => Math.round(metres * 100) / 100;

/**
 * A transformed WGS 84 degree to six decimal places, about 0.1 m on the
 * ground: finer than any grid input or transformation can support.
 */
const roundDegrees = (degrees: number) => Math.round(degrees * 1e6) / 1e6;

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
	while (digits > 0 && (10 ** (5 - digits) * Math.SQRT2) / 2 < uncertaintyM)
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
		lng: roundDegrees(position[0]!),
		lat: roundDegrees(position[1]!),
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
