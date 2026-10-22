/** A position as [longitude, latitude]. */
export type Coordinate = [longitude: number, latitude: number];

/** A GeoJSON geometry, as read from a boundary source. */
export type GeoJsonGeometry = {
	type: string;
	coordinates?: unknown;
	geometries?: GeoJsonGeometry[];
};
