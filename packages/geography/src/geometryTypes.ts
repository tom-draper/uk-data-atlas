export type GeoJsonGeometry = {
	type: string;
	coordinates?: unknown;
	geometries?: GeoJsonGeometry[];
};

export type GeometryBounds = [
	minLongitude: number,
	minLatitude: number,
	maxLongitude: number,
	maxLatitude: number,
];

export type NamedLocationGeometry = {
	boundaryRelease: string;
	bbox: GeometryBounds;
	geometry: GeoJsonGeometry;
};
