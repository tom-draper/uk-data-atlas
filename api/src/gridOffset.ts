import { readFileSync } from "node:fs";
import { join } from "node:path";

type Position = [number, number];

type Geometry = {
	type: string;
	coordinates?: unknown;
	geometries?: Geometry[];
};

/**
 * A correction to a publisher's grid coordinates, applied before they are
 * reprojected. Releases opt in from their meta.json `corrections`, and the
 * definition, shared with the website's boundary compiler, lives in
 * data/boundaries/ beside them with the evidence it was fitted from.
 */
export type GridOffset = {
	id: string;
	description: string;
	crs: "EPSG:27700";
	/** Only areas whose code starts with this are moved. */
	codePrefix: string;
	origin: { easting: number; northing: number };
	unitMetres: number;
	east: [number, number, number];
	north: [number, number, number];
};

const isTriple = (value: unknown): value is [number, number, number] =>
	Array.isArray(value) &&
	value.length === 3 &&
	value.every((item) => typeof item === "number" && Number.isFinite(item));

export const readGridOffset = (
	repositoryRoot: string,
	id: string,
): GridOffset => {
	const path = join(repositoryRoot, "data", "boundaries", `${id}.json`);
	const record = JSON.parse(readFileSync(path, "utf8")) as Record<
		string,
		unknown
	>;
	const origin = (record.origin ?? {}) as Record<string, unknown>;
	if (
		record.id !== id ||
		typeof record.description !== "string" ||
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
		throw new Error(`${path}: not a valid grid offset definition`);
	}
	return {
		id,
		description: record.description,
		crs: record.crs,
		codePrefix: record.codePrefix,
		origin: { easting: origin.easting, northing: origin.northing },
		unitMetres: record.unitMetres,
		east: record.east,
		north: record.north,
	};
};

export const appliesTo = (offset: GridOffset, code: string) =>
	code.startsWith(offset.codePrefix);

export const offsetPosition = (
	offset: GridOffset,
	[easting, northing]: Position,
): Position => {
	const x = (easting - offset.origin.easting) / offset.unitMetres;
	const y = (northing - offset.origin.northing) / offset.unitMetres;
	const [e0, e1, e2] = offset.east;
	const [n0, n1, n2] = offset.north;
	return [easting + e0 + e1 * x + e2 * y, northing + n0 + n1 * x + n2 * y];
};

const offsetCoordinates = (
	offset: GridOffset,
	coordinates: unknown,
): unknown =>
	Array.isArray(coordinates) && typeof coordinates[0] === "number"
		? offsetPosition(offset, [coordinates[0], coordinates[1] as number])
		: Array.isArray(coordinates)
			? coordinates.map((child) => offsetCoordinates(offset, child))
			: coordinates;

/** Moves every position of a grid geometry by the offset. */
export const offsetGeometry = <T extends Geometry>(
	offset: GridOffset,
	geometry: T,
): T =>
	(geometry.type === "GeometryCollection"
		? {
				...geometry,
				geometries: (geometry.geometries ?? []).map((child) =>
					offsetGeometry(offset, child),
				),
			}
		: {
				...geometry,
				coordinates: offsetCoordinates(offset, geometry.coordinates),
			}) as T;
