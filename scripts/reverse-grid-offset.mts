/**
 * Applies a grid offset backwards to a WGS84 collection, for releases that
 * carry the offset the wrong way round. Each covered area is taken into
 * British National Grid through EPSG:1314, the transformation the rest of the
 * build uses, moved by the offset's exact inverse and brought back.
 */
import type { FeatureCollection, Geometry, Position } from "geojson";
import proj4 from "proj4";
import {
	reverseOffsetPosition,
	type GridOffset,
} from "../lib/data/boundaries/gridOffset";

const BNG =
	"+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 " +
	"+ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 " +
	"+units=m +no_defs";
const WGS84 = "+proj=longlat +datum=WGS84 +no_defs";
const grid = proj4(WGS84, BNG);

const reversePosition = (offset: GridOffset, position: Position): Position => {
	const [longitude, latitude, ...rest] = position;
	const moved = reverseOffsetPosition(
		offset,
		grid.forward([longitude!, latitude!]),
	);
	return [...grid.inverse([moved[0]!, moved[1]!]), ...rest];
};

const reverseCoordinates = (
	offset: GridOffset,
	coordinates: unknown,
): unknown =>
	Array.isArray(coordinates) && typeof coordinates[0] === "number"
		? reversePosition(offset, coordinates as Position)
		: Array.isArray(coordinates)
			? coordinates.map((child) => reverseCoordinates(offset, child))
			: coordinates;

const reverseGeometry = (offset: GridOffset, geometry: Geometry): Geometry =>
	geometry.type === "GeometryCollection"
		? {
				...geometry,
				geometries: geometry.geometries.map((child) =>
					reverseGeometry(offset, child),
				),
			}
		: {
				...geometry,
				coordinates: reverseCoordinates(
					offset,
					geometry.coordinates,
				) as never,
			};

/**
 * Moves the WGS84 features the offset covers back by it. Throws when the
 * offset would move nothing, so a stale declaration cannot pass silently.
 */
export const applyReversedGridOffset = <T extends FeatureCollection>(
	collection: T,
	offset: GridOffset,
	codeKey: string,
	label: string,
): T => {
	let moved = 0;
	const features = collection.features.map((feature) => {
		const code = feature.properties?.[codeKey];
		if (
			typeof code !== "string" ||
			!code.startsWith(offset.codePrefix) ||
			!feature.geometry
		)
			return feature;
		moved += 1;
		return {
			...feature,
			geometry: reverseGeometry(offset, feature.geometry),
		};
	});
	if (moved === 0)
		throw new Error(
			`${label}: ${offset.id} is declared reversed but no ${codeKey} starts with ${offset.codePrefix}.`,
		);
	return { ...collection, features };
};
