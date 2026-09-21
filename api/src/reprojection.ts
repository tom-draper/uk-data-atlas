import proj4 from "proj4";

type Position = [number, number];

export type GeometryTransformation = {
	name: string;
	epsg: string;
	/** EPSG's stated accuracy for the transformation within its area of use. */
	accuracyM: number;
	areaOfUse: string;
};

export type GeometryProvenance = {
	/** The source file, with its hash, when the registry records one. */
	input?: string;
	inputHash?: string;
	sourceCrs: string;
	transformation?: GeometryTransformation;
	/** Declared grid corrections that moved this area before reprojection. */
	corrections?: Array<{ id: string; description: string }>;
};

type Reprojection = {
	transformation: GeometryTransformation;
	toWgs84: (position: Position) => Position;
	fromWgs84: (position: Position) => Position;
};

export const isWgs84 = (crs: string) =>
	crs === "EPSG:4326" || crs === "CRS84" || crs.endsWith(":CRS84");

// British National Grid on OSGB36 to WGS 84 through EPSG's seven-parameter
// Helmert transformation (position vector convention), the one the website
// build already uses. OSTN15 would be more accurate but needs a grid file.
const britishNationalGrid = proj4(
	"+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 " +
		"+ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 " +
		"+units=m +no_defs",
	"+proj=longlat +datum=WGS84 +no_defs",
);

// Irish Grid on TM65, the grid the Northern Ireland super output areas are
// published on, to WGS 84 through EPSG's seven-parameter transformation.
const irishGrid = proj4(
	"+proj=tmerc +lat_0=53.5 +lon_0=-8 +k=1.000035 +x_0=200000 +y_0=250000 " +
		"+a=6377340.189 +rf=299.3249646 " +
		"+towgs84=482.5,-130.6,564.6,-1.042,-0.214,-0.631,8.15 " +
		"+units=m +no_defs",
	"+proj=longlat +datum=WGS84 +no_defs",
);

// Seven decimal places of a degree is about a centimetre here, far finer
// than the transformation's accuracy, and keeps responses free of float noise.
const round = (value: number) => Math.round(value * 1e7) / 1e7;
// Grid coordinates are conventionally expressed in metres. Keeping two
// fractional places avoids projection-library float noise without suggesting
// sub-centimetre transformation accuracy.
const roundGrid = (value: number) => Math.round(value * 100) / 100;

const REPROJECTIONS: Record<string, Reprojection> = {
	"EPSG:27700": {
		transformation: {
			name: "OSGB36 to WGS 84 (6)",
			epsg: "EPSG:1314",
			accuracyM: 2,
			areaOfUse: "Great Britain onshore and the Isle of Man.",
		},
		toWgs84: (position) => {
			const [lon, lat] = britishNationalGrid.forward(position);
			return [round(lon), round(lat)];
		},
		fromWgs84: (position) => {
			const [easting, northing] = britishNationalGrid.inverse(position);
			return [roundGrid(easting), roundGrid(northing)];
		},
	},
	"EPSG:29902": {
		transformation: {
			name: "TM65 to WGS 84 (2)",
			epsg: "EPSG:1641",
			accuracyM: 1,
			areaOfUse: "Ireland and Northern Ireland onshore.",
		},
		toWgs84: (position) => {
			const [lon, lat] = irishGrid.forward(position);
			return [round(lon), round(lat)];
		},
		fromWgs84: (position) => {
			const [easting, northing] = irishGrid.inverse(position);
			return [roundGrid(easting), roundGrid(northing)];
		},
	},
};

export const canServeAsWgs84 = (crs: string) =>
	isWgs84(crs) || crs in REPROJECTIONS;

export const geometryProvenance = (crs: string): GeometryProvenance =>
	isWgs84(crs) || !(crs in REPROJECTIONS)
		? { sourceCrs: crs }
		: { sourceCrs: crs, transformation: REPROJECTIONS[crs].transformation };

/**
 * Reproject one horizontal coordinate for a caller-facing point lookup. The
 * returned transformation is part of the answer: a BNG or Irish Grid input is
 * never silently treated as WGS 84, and its stated accuracy can be included
 * in the positional tolerance beside the caller's own coordinate precision.
 */
export const toWgs84Point = (
	position: Position,
	crs: string,
): { position: Position; transformation?: GeometryTransformation } => {
	if (isWgs84(crs)) return { position };
	const reprojection = REPROJECTIONS[crs];
	if (!reprojection)
		throw new Error(`No transformation to WGS84 is available from ${crs}.`);
	return {
		position: reprojection.toWgs84(position),
		transformation: reprojection.transformation,
	};
};

/**
 * Convert a normalised WGS 84 point into one of the supported national grids.
 * The named EPSG transformation describes the inverse operation, so callers
 * can retain its stated accuracy rather than treating the result as exact.
 */
export const fromWgs84Point = (
	position: Position,
	crs: string,
): { position: Position; transformation?: GeometryTransformation } => {
	if (isWgs84(crs)) return { position };
	const reprojection = REPROJECTIONS[crs];
	if (!reprojection)
		throw new Error(`No transformation from WGS84 is available to ${crs}.`);
	return {
		position: reprojection.fromWgs84(position),
		transformation: reprojection.transformation,
	};
};

const reprojectCoordinates = (
	coordinates: unknown,
	toWgs84: Reprojection["toWgs84"],
): unknown => {
	if (!Array.isArray(coordinates)) return coordinates;
	if (typeof coordinates[0] === "number") {
		return toWgs84([coordinates[0], coordinates[1] as number]);
	}
	return coordinates.map((child) => reprojectCoordinates(child, toWgs84));
};

type Geometry = {
	type: string;
	coordinates?: unknown;
	geometries?: Geometry[];
};

/** Returns the geometry in WGS84, or throws for a CRS with no transformation. */
export const toWgs84Geometry = <T extends Geometry>(
	geometry: T,
	crs: string,
): T => {
	if (isWgs84(crs)) return geometry;
	const reprojection = REPROJECTIONS[crs];
	if (!reprojection)
		throw new Error(`No transformation to WGS84 is available from ${crs}.`);
	const reproject = (value: Geometry): Geometry =>
		value.type === "GeometryCollection"
			? { ...value, geometries: (value.geometries ?? []).map(reproject) }
			: {
					...value,
					coordinates: reprojectCoordinates(
						value.coordinates,
						reprojection.toWgs84,
					),
				};
	return reproject(geometry) as T;
};
