import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { MultiPolygon, Polygon } from "polygon-clipping";
import {
	boundsOf,
	indexPieces,
	toPolygons,
	type AreaGeometry,
} from "./areaGeometryPieces";
import type { GeometrySourceLookup } from "./areaGeometry";
import { multiPolygonAreaM2 } from "@uk-data-atlas/map-tiles/equalAreaProjection";
import type { GeographyKind } from "./geography";
import { releaseKey } from "./geographyKeys";
import { appliesTo, offsetGeometry, readGridOffset } from "./gridOffset";
import {
	applyReversedOffsets,
	loadSubstitutions,
	reversedOffsetProvenance,
	substitutionProvenance,
} from "./geometrySubstitution";
import {
	canServeAsWgs84,
	geometryProvenance,
	toWgs84Geometry,
} from "./reprojection";
import { readShapefileFeatures } from "./shapefile";
import {
	parseGeoJsonFeatures,
	parseGeoJsonProperties,
	type GeoJsonFeatures,
} from "./geoJsonProperties";
import { sha256 } from "./contentHash";

/** Each feature's properties, without decoding GeoJSON geometry. */
const featureProperties = (
	shapefile: Array<{ properties?: unknown }> | undefined,
	content: Buffer,
): unknown[] => {
	if (shapefile) return shapefile.map((feature) => feature.properties);
	const parsed = parseGeoJsonProperties(content);
	return parsed.type === "FeatureCollection" ? parsed.properties : [];
};

export const readGeometries = (
	repositoryRoot: string,
	crosswalkId: string,
	endpoint: { geography: GeographyKind; boundaryRelease: string },
	geometrySources: GeometrySourceLookup,
	codePattern?: RegExp,
) => {
	const identity = releaseKey(endpoint.geography, endpoint.boundaryRelease);
	const source = geometrySources.get(identity);
	if (!source) {
		throw new Error(
			`${crosswalkId}: no raw geometry source is available for ${identity}.`,
		);
	}
	if (!canServeAsWgs84(source.crs)) {
		throw new Error(
			`${crosswalkId}: ${identity} geometry is ${source.crs} and has no transformation to WGS84.`,
		);
	}
	const offsets = (source.corrections ?? []).map((id) =>
		readGridOffset(repositoryRoot, id),
	);
	if (offsets.some((offset) => offset.crs !== source.crs)) {
		throw new Error(
			`${crosswalkId}: ${identity} has a correction for a different CRS.`,
		);
	}
	const inputPath = join(repositoryRoot, "data/source", source.input);
	const content = readFileSync(inputPath);
	// Shapefiles are read as the geometry cache reads them; the hash is of the
	// input file's bytes either way, as the geometry source registry records.
	// GeoJSON is decoded a feature at a time: the 2001 output areas are larger
	// than the longest string V8 can hold.
	const shapefile = inputPath.toLowerCase().endsWith(".shp")
		? readShapefileFeatures(inputPath)
		: undefined;
	const collection: GeoJsonFeatures = shapefile
		? { type: "FeatureCollection", features: shapefile }
		: parseGeoJsonFeatures(content);
	if (collection.type !== "FeatureCollection") {
		throw new Error(
			`${crosswalkId}: ${source.input} is not a FeatureCollection.`,
		);
	}
	const substitutions = source.substitutions?.length
		? loadSubstitutions(
				repositoryRoot,
				geometrySources,
				identity,
				source.substitutions,
				featureProperties(shapefile, content).flatMap((properties) => {
					const code = (
						properties as Record<string, unknown> | null | undefined
					)?.[source.codeProperty];
					return typeof code === "string" ? [code.trim()] : [];
				}),
			)
		: [];
	const substituted = (code: string) =>
		substitutions.find(({ geometries }) => geometries.has(code));
	const polygonsByCode = new Map<string, Polygon[]>();
	for (const { geometries } of substitutions)
		for (const [code, geometry] of geometries)
			if (!codePattern || codePattern.test(code))
				polygonsByCode.set(
					code,
					toPolygons(geometry, `${code} substituted geometry`),
				);
	let index = -1;
	for (const item of collection.features) {
		index += 1;
		const feature = item as
			{ properties?: unknown; geometry?: unknown } | null | undefined;
		const code = (
			feature?.properties as Record<string, unknown> | null | undefined
		)?.[source.codeProperty];
		if (typeof code !== "string" || code.trim().length === 0) {
			throw new Error(
				`${crosswalkId}: ${source.input} feature ${index} has no ${source.codeProperty}.`,
			);
		}
		if (codePattern && !codePattern.test(code)) continue;
		if (substituted(code.trim())) continue;
		if (
			typeof feature?.geometry !== "object" ||
			feature.geometry === null
		) {
			throw new Error(
				`${crosswalkId}: ${source.input} feature ${index} (${code}) has no geometry.`,
			);
		}
		const corrected = offsets
			.filter((offset) => appliesTo(offset, code))
			.reduce(
				(geometry, offset) => offsetGeometry(offset, geometry),
				feature.geometry as { type: string; coordinates?: unknown },
			);
		const polygons = polygonsByCode.get(code.trim()) ?? [];
		polygons.push(
			...toPolygons(
				applyReversedOffsets(
					repositoryRoot,
					source.reversedOffsets ?? [],
					code.trim(),
					toWgs84Geometry(corrected, source.crs),
				),
				`${source.input} feature ${index} geometry`,
			),
		);
		polygonsByCode.set(code.trim(), polygons);
	}
	const geometries = new Map<string, AreaGeometry>();
	for (const code of [...polygonsByCode.keys()].sort()) {
		const geometry = polygonsByCode.get(code) as MultiPolygon;
		const pieces = geometry.map((polygon) => ({
			geometry: polygon,
			bounds: boundsOf([polygon]),
		}));
		geometries.set(code, {
			pieces,
			bounds: boundsOf(geometry),
			areaM2: multiPolygonAreaM2(geometry),
			pieceBuckets: indexPieces(pieces),
		});
	}
	return {
		geometries,
		provenance: {
			input: source.input,
			inputHash: sha256(content),
			...geometryProvenance(source.crs),
			...(offsets.length > 0 ||
			substitutions.length > 0 ||
			(source.reversedOffsets?.length ?? 0) > 0
				? {
						corrections: [
							...offsets.map(({ id, description }) => ({
								id,
								description,
							})),
							...substitutionProvenance(
								geometrySources,
								source.substitutions ?? [],
							),
							...reversedOffsetProvenance(
								source.reversedOffsets ?? [],
							),
						],
					}
				: {}),
		},
	};
};
