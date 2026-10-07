import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	offsetPosition as offsetGridPosition,
	reverseOffsetPosition,
} from "@uk-data-atlas/geography";
import {
	mapGeometryPositions,
	type Geometry,
	type Position,
} from "./geometryPositions";

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
): Position => offsetGridPosition(offset, [easting, northing]) as Position;

/** Moves every position of a grid geometry by the offset. */
export const offsetGeometry = <T extends Geometry>(
	offset: GridOffset,
	geometry: T,
): T =>
	mapGeometryPositions(geometry, (position) =>
		offsetPosition(offset, position),
	);

/** Moves every position of a grid geometry back by the offset, exactly. */
export const reverseOffsetGeometry = <T extends Geometry>(
	offset: GridOffset,
	geometry: T,
): T =>
	mapGeometryPositions(
		geometry,
		(position) => reverseOffsetPosition(offset, position) as Position,
	);
