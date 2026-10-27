import type { GeometryBounds } from "./areaContainment";

/** The fixed grid used to narrow spatial geometry queries. */
export const SPATIAL_CELL_DEGREES = 0.25;
export const MAX_SPATIAL_QUERY_CELLS = 10_000;

export type SpatialCell = readonly [longitude: number, latitude: number];

/** The cells an envelope occupies, or undefined when it deliberately spans too many. */
export const spatialCells = (
	bounds: GeometryBounds,
): SpatialCell[] | undefined => {
	const west = Math.max(-180, bounds[0]);
	const south = Math.max(-90, bounds[1]);
	const east = Math.min(180, bounds[2]);
	const north = Math.min(90, bounds[3]);
	if (west > east || south > north) return [];
	const range = {
		west: Math.floor((west + 180) / SPATIAL_CELL_DEGREES),
		south: Math.floor((south + 90) / SPATIAL_CELL_DEGREES),
		east: Math.floor((east + 180) / SPATIAL_CELL_DEGREES),
		north: Math.floor((north + 90) / SPATIAL_CELL_DEGREES),
	};
	const count =
		(range.east - range.west + 1) * (range.north - range.south + 1);
	if (count > MAX_SPATIAL_QUERY_CELLS) return undefined;
	const cells: SpatialCell[] = [];
	for (let longitude = range.west; longitude <= range.east; longitude++)
		for (let latitude = range.south; latitude <= range.north; latitude++)
			cells.push([longitude, latitude]);
	return cells;
};

export const spatialCellKey = ([longitude, latitude]: SpatialCell) =>
	`${longitude}/${latitude}`;

export const compareSpatialCells = (left: SpatialCell, right: SpatialCell) =>
	left[0] - right[0] || left[1] - right[1];
