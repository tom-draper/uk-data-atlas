import { geometryBounds } from "@uk-data-atlas/geography/geometry-point-containment";
import type {
	GeoJsonGeometry,
	NamedLocationGeometry,
} from "@uk-data-atlas/geography/geometry-types";
import { packText, unpackText } from "./storedPayload.ts";

/**
 * Decimal places kept in stored geometry. Coordinates are WGS84 degrees, so
 * five places is 1.1 m of latitude and under 1 m of longitude in the UK.
 */
export const GEOMETRY_DECIMALS = 5;

/**
 * Brotli quality for geometry. Coordinates compress to 63% of what quality 9
 * gives, which is worth about twelve seconds across the 249 stored shapes.
 * Quality 11 saves only 5% more for three times as long.
 */
const GEOMETRY_QUALITY = 10;

const scale = 10 ** GEOMETRY_DECIMALS;
const round = (value: number) => Math.round(value * scale) / scale;

type Position = number[];

const roundPositions = (coordinates: unknown): unknown =>
	Array.isArray(coordinates)
		? typeof coordinates[0] === "number"
			? (coordinates as Position).map(round)
			: coordinates.map(roundPositions)
		: coordinates;

/**
 * A ring rounded to the stored precision. Neighbouring points that round to
 * the same place are merged. A ring left with fewer than the four positions
 * a closed ring needs has collapsed, and gives undefined.
 */
const roundRing = (ring: Position[]): Position[] | undefined => {
	const kept: Position[] = [];
	for (const position of ring) {
		const rounded = position.map(round);
		const previous = kept.at(-1);
		if (
			!previous ||
			previous.length !== rounded.length ||
			previous.some((value, axis) => value !== rounded[axis])
		)
			kept.push(rounded);
	}
	return kept.length >= 4 ? kept : undefined;
};

/** A polygon's rings, or undefined when its outer ring has collapsed. */
const roundPolygon = (rings: Position[][]): Position[][] | undefined => {
	const [outer, ...holes] = rings.map(roundRing);
	return outer
		? [outer, ...holes.filter((ring): ring is Position[] => !!ring)]
		: undefined;
};

/**
 * A geometry with coordinates rounded to {@link GEOMETRY_DECIMALS} places.
 * Polygons that collapse to nothing at that precision are dropped, so every
 * ring stays a valid closed ring.
 */
export function roundGeometry(geometry: GeoJsonGeometry): GeoJsonGeometry {
	if (geometry.type === "GeometryCollection")
		return {
			...geometry,
			geometries: (geometry.geometries ?? []).map(roundGeometry),
		};
	if (geometry.type === "Polygon") {
		const rings = roundPolygon(geometry.coordinates as Position[][]);
		return { ...geometry, coordinates: rings ?? [] };
	}
	if (geometry.type === "MultiPolygon")
		return {
			...geometry,
			coordinates: (geometry.coordinates as Position[][][]).flatMap(
				(polygon) => {
					const rings = roundPolygon(polygon);
					return rings ? [rings] : [];
				},
			),
		};
	return { ...geometry, coordinates: roundPositions(geometry.coordinates) };
}

/**
 * A named location's geometry as stored: rounded, with its bounds measured
 * from the rounded shape, and compressed. The bounds are returned beside the
 * blob for the table's bounding box columns.
 */
export function packGeometry(geometry: GeoJsonGeometry): {
	geometry: Buffer;
	bbox: NamedLocationGeometry["bbox"];
} {
	const rounded = roundGeometry(geometry);
	const bbox = geometryBounds(rounded);
	if (!bbox) throw new Error("Geometry has no coordinates once rounded");
	return {
		geometry: packText(JSON.stringify(rounded), GEOMETRY_QUALITY),
		bbox,
	};
}

/** The GeoJSON geometry of a stored column value. */
export function unpackGeometry(value: unknown): GeoJsonGeometry {
	const text = unpackText(value);
	if (text === undefined) throw new Error("Invalid stored geometry");
	return JSON.parse(text);
}
