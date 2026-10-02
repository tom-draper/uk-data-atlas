import { readFileSync } from "node:fs";
import { readDbfRows } from "./dbf";

type Position = [number, number];
type Ring = Position[];

export type ShapefilePolygon =
	| { type: "Polygon"; coordinates: Ring[] }
	| { type: "MultiPolygon"; coordinates: Ring[][] };

export type ShapefileFeature = {
	properties: Record<string, string>;
	geometry: ShapefilePolygon;
};

const NULL_SHAPE = 0;
// Polygon, PolygonZ and PolygonM share the same leading layout; the Z and M
// values that follow the points are not read.
const POLYGON_SHAPES = new Set([5, 15, 25]);

// Twice the signed area: positive for a counter-clockwise ring.
const signedArea = (ring: Ring) => {
	let total = 0;
	for (let index = 0; index < ring.length - 1; index += 1) {
		const [x1, y1] = ring[index];
		const [x2, y2] = ring[index + 1];
		total += x1 * y2 - x2 * y1;
	}
	return total;
};

const ringContains = (ring: Ring, [x, y]: Position) => {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
		const [xi, yi] = ring[i];
		const [xj, yj] = ring[j];
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
			inside = !inside;
	}
	return inside;
};

/**
 * Groups a shape's rings into polygons. A Shapefile draws outer rings
 * clockwise and holes counter-clockwise; GeoJSON (RFC 7946) wants the
 * reverse, so each ring is reversed as it is placed.
 */
const toPolygon = (rings: Ring[]): ShapefilePolygon => {
	const outers: Ring[][] = [];
	const holes: Ring[] = [];
	for (const ring of rings) {
		if (signedArea(ring) <= 0) outers.push([[...ring].reverse()]);
		else holes.push([...ring].reverse());
	}
	for (const hole of holes) {
		const owner =
			outers.find((polygon) => ringContains(polygon[0], hole[0])) ??
			outers[0];
		if (!owner) throw new Error("A shape has holes but no outer ring.");
		owner.push(hole);
	}
	return outers.length === 1
		? { type: "Polygon", coordinates: outers[0] }
		: { type: "MultiPolygon", coordinates: outers };
};

/**
 * Reads a polygon Shapefile and its dBase attribute table into features, in
 * the file's projected coordinates. Null shapes and deleted records are
 * skipped; any other shape type is refused rather than misread.
 */
export const readShapefileFeatures = (shpPath: string): ShapefileFeature[] => {
	const buffer = readFileSync(shpPath);
	if (buffer.length < 100 || buffer.readInt32BE(0) !== 9994) {
		throw new Error(`${shpPath}: not a Shapefile`);
	}
	if (buffer.readInt32BE(24) * 2 !== buffer.length) {
		throw new Error(`${shpPath}: file length does not match its header`);
	}
	const rows = readDbfRows(shpPath.replace(/\.shp$/i, ".dbf"));
	const features: ShapefileFeature[] = [];
	let offset = 100;
	let index = 0;
	while (offset < buffer.length) {
		const contentLength = buffer.readInt32BE(offset + 4) * 2;
		const content = offset + 8;
		const shapeType = buffer.readInt32LE(content);
		const properties = rows[index];
		if (shapeType !== NULL_SHAPE && properties) {
			if (!POLYGON_SHAPES.has(shapeType)) {
				throw new Error(
					`${shpPath}: shape type ${shapeType} is not a polygon`,
				);
			}
			const partCount = buffer.readInt32LE(content + 36);
			const pointCount = buffer.readInt32LE(content + 40);
			const parts = Array.from({ length: partCount }, (_, part) =>
				buffer.readInt32LE(content + 44 + part * 4),
			);
			const points = content + 44 + partCount * 4;
			const rings = parts.map((start, part) => {
				const end = parts[part + 1] ?? pointCount;
				return Array.from(
					{ length: end - start },
					(_, point): Position => [
						buffer.readDoubleLE(points + (start + point) * 16),
						buffer.readDoubleLE(points + (start + point) * 16 + 8),
					],
				);
			});
			features.push({ properties, geometry: toPolygon(rings) });
		}
		offset = content + contentLength;
		index += 1;
	}
	if (index !== rows.length) {
		throw new Error(
			`${shpPath}: ${index} shapes but ${rows.length} attribute records`,
		);
	}
	return features;
};
