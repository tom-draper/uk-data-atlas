export type Position = [number, number];

export type Geometry = {
	type: string;
	coordinates?: unknown;
	geometries?: Geometry[];
};

const mapCoordinates = (
	coordinates: unknown,
	move: (position: Position) => Position,
): unknown =>
	Array.isArray(coordinates) && typeof coordinates[0] === "number"
		? move([coordinates[0], coordinates[1] as number])
		: Array.isArray(coordinates)
			? coordinates.map((child) => mapCoordinates(child, move))
			: coordinates;

/**
 * The geometry with every horizontal position moved, through any nesting of
 * collections. Positions keep only their first two numbers.
 */
export const mapGeometryPositions = <T extends Geometry>(
	geometry: T,
	move: (position: Position) => Position,
): T =>
	(geometry.type === "GeometryCollection"
		? {
				...geometry,
				geometries: (geometry.geometries ?? []).map((child) =>
					mapGeometryPositions(child, move),
				),
			}
		: {
				...geometry,
				coordinates: mapCoordinates(geometry.coordinates, move),
			}) as T;
