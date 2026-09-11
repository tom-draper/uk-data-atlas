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
	sourceCrs: string;
	transformation?: GeometryTransformation;
	/** Declared grid corrections that moved this area before reprojection. */
	corrections?: Array<{ id: string; description: string }>;
};

type Reprojection = {
	transformation: GeometryTransformation;
	toWgs84: (position: Position) => Position;
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

// Seven decimal places of a degree is about a centimetre here, far finer
// than the transformation's accuracy, and keeps responses free of float noise.
const round = (value: number) => Math.round(value * 1e7) / 1e7;

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
	},
};

export const canServeAsWgs84 = (crs: string) =>
	isWgs84(crs) || crs in REPROJECTIONS;

export const geometryProvenance = (crs: string): GeometryProvenance =>
	isWgs84(crs) || !(crs in REPROJECTIONS)
		? { sourceCrs: crs }
		: { sourceCrs: crs, transformation: REPROJECTIONS[crs].transformation };

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
	if (!reprojection) {
		throw new Error(`No transformation to WGS84 is available from ${crs}.`);
	}
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
