import { createHash } from "node:crypto";
import type { Country } from "./dataCatalog";

export type TerrainProduct = {
	id: string;
	label: string;
	kind: "raster" | "vector";
	measurement: string;
	unit: string;
	availability: {
		status: "not-published";
		reason: string;
	};
	/** The intended service scope, never a claim that the data exists today. */
	intendedCoverage: { countries: Country[] };
	dependsOn?: string[];
	notes?: string[];
};

/**
 * The metadata that makes a terrain value reproducible instead of merely
 * plausible. A published product must provide every applicable field before
 * its availability can become `available`.
 */
export const terrainPublicationRequirements = [
	"product version and immutable content hash",
	"coverage extent and any gaps",
	"source publisher, licence and source/capture date",
	"horizontal CRS and coordinate epoch where applicable",
	"vertical CRS or datum, including the geoid model where applicable",
	"value units and no-data convention",
	"cell resolution or contour interval",
	"terrain model (bare earth or surface) and processing method",
	"interpolation or derivation method and parameters",
	"uncertainty or stated accuracy",
] as const;

export type TerrainCatalogue = {
	schemaVersion: 1;
	contentHash: string;
	publicationRequirements: readonly string[];
	products: TerrainProduct[];
};

const sha256 = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

const ukCoverage = {
	countries: ["GB-ENG", "GB-NIR", "GB-SCT", "GB-WLS"] as Country[],
};

const unpublished = {
	status: "not-published" as const,
	reason: "No versioned terrain source has been ingested and validated for this product yet.",
};

/**
 * The product families the Atlas will expose. They deliberately start
 * unavailable: clients can discover the boundary and required metadata now,
 * without being given an implied or fabricated elevation answer.
 */
export const createTerrainCatalogue = (): TerrainCatalogue => {
	const products: TerrainProduct[] = [
		{
			id: "terrain-elevation",
			label: "Bare-earth elevation",
			kind: "raster",
			measurement:
				"Elevation of the terrain surface after buildings and vegetation are removed.",
			unit: "metres",
			availability: unpublished,
			intendedCoverage: ukCoverage,
			notes: [
				"This is a digital terrain model (DTM), not surface elevation.",
				"Point values will declare their interpolation method.",
			],
		},
		{
			id: "surface-elevation",
			label: "Surface elevation",
			kind: "raster",
			measurement:
				"Elevation of the first-return surface, including buildings and vegetation where the source represents them.",
			unit: "metres",
			availability: unpublished,
			intendedCoverage: ukCoverage,
			notes: [
				"This is a digital surface model (DSM) and must never be substituted for bare-earth elevation.",
			],
		},
		{
			id: "terrain-slope",
			label: "Terrain slope",
			kind: "raster",
			measurement: "Maximum local rate of terrain elevation change.",
			unit: "degrees",
			availability: unpublished,
			intendedCoverage: ukCoverage,
			dependsOn: ["terrain-elevation"],
			notes: [
				"The derivative algorithm and neighbourhood must be published.",
			],
		},
		{
			id: "terrain-aspect",
			label: "Terrain aspect",
			kind: "raster",
			measurement:
				"Direction of steepest terrain descent, clockwise from true north.",
			unit: "degrees",
			availability: unpublished,
			intendedCoverage: ukCoverage,
			dependsOn: ["terrain-elevation"],
			notes: ["The convention for flat cells must be published."],
		},
		{
			id: "terrain-contours",
			label: "Terrain contours",
			kind: "vector",
			measurement: "Lines of equal bare-earth elevation.",
			unit: "metres",
			availability: unpublished,
			intendedCoverage: ukCoverage,
			dependsOn: ["terrain-elevation"],
			notes: [
				"The contour interval, index-contour rule and generalisation must be published.",
			],
		},
		{
			id: "terrain-hillshade",
			label: "Terrain hillshade",
			kind: "raster",
			measurement:
				"A rendered terrain-relief product for visual context, not a measurement layer.",
			unit: "relative intensity",
			availability: unpublished,
			intendedCoverage: ukCoverage,
			dependsOn: ["terrain-elevation"],
			notes: [
				"The illumination azimuth, altitude, z-factor and rendering method must be published.",
			],
		},
	];
	const content = JSON.stringify({
		schemaVersion: 1,
		publicationRequirements: terrainPublicationRequirements,
		products,
	});
	return {
		schemaVersion: 1,
		contentHash: sha256(content),
		publicationRequirements: terrainPublicationRequirements,
		products,
	};
};
