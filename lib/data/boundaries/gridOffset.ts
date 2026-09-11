import type { FeatureCollection, Geometry, Position } from "geojson";

/**
 * A correction to a publisher's grid coordinates, applied before they are
 * reprojected. A release opts in by naming the offset in its meta.json
 * `corrections`; the definition lives beside the releases in data/boundaries,
 * with the evidence it was fitted from.
 *
 * The offset is linear in the grid: a feature at easting E and northing N
 * moves east by east[0] + east[1]·x + east[2]·y and north likewise, where x
 * and y are its distance from the origin in units of unitMetres.
 */
export interface GridOffset {
	id: string;
	crs: "EPSG:27700";
	/** Only features whose code starts with this are moved. */
	codePrefix: string;
	origin: { easting: number; northing: number };
	unitMetres: number;
	east: [number, number, number];
	north: [number, number, number];
}

const isTriple = (value: unknown): value is [number, number, number] =>
	Array.isArray(value) &&
	value.length === 3 &&
	value.every((item) => typeof item === "number" && Number.isFinite(item));

export const parseGridOffset = (
	value: unknown,
	location: string,
): GridOffset => {
	const record = (value ?? {}) as Record<string, unknown>;
	const origin = (record.origin ?? {}) as Record<string, unknown>;
	if (
		typeof record.id !== "string" ||
		record.crs !== "EPSG:27700" ||
		typeof record.codePrefix !== "string" ||
		record.codePrefix.length === 0 ||
		typeof origin.easting !== "number" ||
		typeof origin.northing !== "number" ||
		typeof record.unitMetres !== "number" ||
		record.unitMetres <= 0 ||
		!isTriple(record.east) ||
		!isTriple(record.north)
	) {
		throw new Error(`${location}: not a valid grid offset definition`);
	}
	return {
		id: record.id,
		crs: record.crs,
		codePrefix: record.codePrefix,
		origin: { easting: origin.easting, northing: origin.northing },
		unitMetres: record.unitMetres,
		east: record.east,
		north: record.north,
	};
};

export const offsetPosition = (
	offset: GridOffset,
	[easting, northing, ...rest]: Position,
): Position => {
	const x = (easting! - offset.origin.easting) / offset.unitMetres;
	const y = (northing! - offset.origin.northing) / offset.unitMetres;
	const [e0, e1, e2] = offset.east;
	const [n0, n1, n2] = offset.north;
	return [
		easting! + e0 + e1 * x + e2 * y,
		northing! + n0 + n1 * x + n2 * y,
		...rest,
	];
};

const offsetCoordinates = (
	offset: GridOffset,
	coordinates: unknown,
): unknown =>
	Array.isArray(coordinates) && typeof coordinates[0] === "number"
		? offsetPosition(offset, coordinates as Position)
		: Array.isArray(coordinates)
			? coordinates.map((child) => offsetCoordinates(offset, child))
			: coordinates;

const offsetGeometry = (offset: GridOffset, geometry: Geometry): Geometry =>
	geometry.type === "GeometryCollection"
		? {
				...geometry,
				geometries: geometry.geometries.map((child) =>
					offsetGeometry(offset, child),
				),
			}
		: {
				...geometry,
				coordinates: offsetCoordinates(
					offset,
					geometry.coordinates,
				) as never,
			};

/**
 * Moves the features the offset covers, identified by their `codeKey`
 * property. Throws rather than guess when the collection is not in the
 * offset's grid, or when a declared offset would move nothing at all.
 */
export const applyGridOffset = <T extends FeatureCollection>(
	collection: T & { crs?: { properties?: { name?: string } } },
	offset: GridOffset,
	codeKey: string,
	label: string,
): T => {
	const crs = collection.crs?.properties?.name ?? "";
	if (!crs.includes(offset.crs.split(":")[1]!)) {
		throw new Error(
			`${label}: ${offset.id} corrects ${offset.crs} coordinates, but the source is ${crs || "undeclared"}.`,
		);
	}
	let moved = 0;
	const features = collection.features.map((feature) => {
		const code = feature.properties?.[codeKey];
		if (
			typeof code !== "string" ||
			!code.startsWith(offset.codePrefix) ||
			!feature.geometry
		) {
			return feature;
		}
		moved += 1;
		return {
			...feature,
			geometry: offsetGeometry(offset, feature.geometry),
		};
	});
	if (moved === 0) {
		throw new Error(
			`${label}: ${offset.id} is declared but no ${codeKey} starts with ${offset.codePrefix}.`,
		);
	}
	return { ...collection, features };
};
