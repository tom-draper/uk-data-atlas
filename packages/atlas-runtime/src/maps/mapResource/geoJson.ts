import { gzipSync } from "node:zlib";
import type { GeoJsonGeometry } from "../../geometry/areaGeometry";
import { sha256 } from "@uk-data-atlas/artifacts";

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
	// In id order, as the GeoParquet rows are, so the two list the same
	// features in the same order.
	[...features]
		.sort((left, right) => left.id - right.id)
		.forEach((feature, index) =>
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
		// Level 9 took five times as long as 6 to save under half a percent.
		gzipped: gzipSync(body, { level: 6 }),
		bytes: body.length,
		contentHash: sha256(body),
	};
};
