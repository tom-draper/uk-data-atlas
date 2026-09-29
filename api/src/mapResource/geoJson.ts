import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import type { GeoJsonGeometry } from "../areaGeometry";

/**
 * One tier of a boundary release as a GeoJSON FeatureCollection, the form most
 * tools open without a library: QGIS, geopandas, Mapshaper, a browser.
 *
 * It carries the same features as the GeoParquet download of the tier, with
 * the same ids, so the two are interchangeable. Coordinates are written to six
 * decimal places, about 0.1 m, well inside the generalisation of every
 * release. The file is stored gzipped; the hash and size describe the GeoJSON
 * itself, which is what a client receives once it is decoded.
 */

const DECIMALS = 1e6;

const round = (value: number) => Math.round(value * DECIMALS) / DECIMALS;

const roundCoordinates = (value: unknown): unknown =>
	typeof value === "number"
		? round(value)
		: Array.isArray(value)
			? value.map(roundCoordinates)
			: value;

export const buildGeoJson = (
	features: Array<{
		id: number;
		code: string;
		name: string;
		geometry: GeoJsonGeometry;
	}>,
	metadata: { mapResource: string; tier: string; attribution: string },
): { gzipped: Buffer; bytes: number; contentHash: string } => {
	// Each feature is its own chunk, so the largest release never has to be
	// one JavaScript string.
	const chunks: Buffer[] = [
		Buffer.from(
			`{"type":"FeatureCollection","name":${JSON.stringify(metadata.mapResource)},"tier":${JSON.stringify(metadata.tier)},"attribution":${JSON.stringify(metadata.attribution)},"features":[`,
		),
	];
	features.forEach((feature, index) =>
		chunks.push(
			Buffer.from(
				(index === 0 ? "" : ",") +
					JSON.stringify({
						type: "Feature",
						id: feature.id,
						properties: {
							id: feature.id,
							code: feature.code,
							name: feature.name,
						},
						geometry: {
							type: feature.geometry.type,
							coordinates: roundCoordinates(
								feature.geometry.coordinates,
							),
						},
					}),
			),
		),
	);
	chunks.push(Buffer.from("]}\n"));
	const body = Buffer.concat(chunks);
	return {
		gzipped: gzipSync(body, { level: 9 }),
		bytes: body.length,
		contentHash: `sha256:${createHash("sha256").update(body).digest("hex")}`,
	};
};
