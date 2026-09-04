import { BoundaryGeojson } from "@lib/types";
import * as topojson from "topojson-client";
import type { Topology } from "topojson-specification";
import {
	FeatureCollection,
	GeoJsonProperties,
	Geometry,
	Position,
} from "geojson";

interface GeoJsonFeatureCollection extends FeatureCollection<
	Geometry,
	GeoJsonProperties
> {
	crs?: {
		type: string;
		properties: {
			name: string;
		};
	};
}

const isTopology = (json: unknown): json is Topology =>
	typeof json === "object" &&
	json !== null &&
	(json as { type?: unknown }).type === "Topology";

const radians = (degrees: number) => (degrees * Math.PI) / 180;
const degrees = (radians: number) => (radians * 180) / Math.PI;

/** Converts an OS National Grid easting/northing pair to WGS84 longitude/latitude. */
const britishNationalGridToWgs84 = ([
	easting,
	northing,
]: Position): Position => {
	const airyA = 6377563.396;
	const airyB = 6356256.909;
	const scale = 0.9996012717;
	const latitudeOrigin = radians(49);
	const longitudeOrigin = radians(-2);
	const northingOrigin = -100000;
	const eastingOrigin = 400000;
	const eccentricitySquared = 1 - (airyB * airyB) / (airyA * airyA);
	const n = (airyA - airyB) / (airyA + airyB);

	let latitude = latitudeOrigin;
	let meridionalArc = 0;
	do {
		latitude =
			(northing - northingOrigin - meridionalArc) / (airyA * scale) +
			latitude;
		const deltaLatitude = latitude - latitudeOrigin;
		const sumLatitude = latitude + latitudeOrigin;
		meridionalArc =
			airyB *
			scale *
			((1 + n + (5 / 4) * n ** 2 + (5 / 4) * n ** 3) * deltaLatitude -
				(3 * n + 3 * n ** 2 + (21 / 8) * n ** 3) *
					Math.sin(deltaLatitude) *
					Math.cos(sumLatitude) +
				((15 / 8) * n ** 2 + (15 / 8) * n ** 3) *
					Math.sin(2 * deltaLatitude) *
					Math.cos(2 * sumLatitude) -
				(35 / 24) *
					n ** 3 *
					Math.sin(3 * deltaLatitude) *
					Math.cos(3 * sumLatitude));
	} while (northing - northingOrigin - meridionalArc >= 0.00001);

	const sinLatitude = Math.sin(latitude);
	const cosLatitude = Math.cos(latitude);
	const tangentLatitude = Math.tan(latitude);
	const nu =
		(airyA * scale) / Math.sqrt(1 - eccentricitySquared * sinLatitude ** 2);
	const rho =
		(airyA * scale * (1 - eccentricitySquared)) /
		(1 - eccentricitySquared * sinLatitude ** 2) ** 1.5;
	const etaSquared = nu / rho - 1;
	const deltaEasting = easting - eastingOrigin;

	const latitudeOsgb =
		latitude -
		(tangentLatitude / (2 * rho * nu)) * deltaEasting ** 2 +
		(tangentLatitude / (24 * rho * nu ** 3)) *
			(5 +
				3 * tangentLatitude ** 2 +
				etaSquared -
				9 * tangentLatitude ** 2 * etaSquared) *
			deltaEasting ** 4 -
		(tangentLatitude / (720 * rho * nu ** 5)) *
			(61 + 90 * tangentLatitude ** 2 + 45 * tangentLatitude ** 4) *
			deltaEasting ** 6;
	const longitudeOsgb =
		longitudeOrigin +
		deltaEasting / (cosLatitude * nu) -
		(deltaEasting ** 3 / (6 * cosLatitude * nu ** 3)) *
			(nu / rho + 2 * tangentLatitude ** 2) +
		(deltaEasting ** 5 / (120 * cosLatitude * nu ** 5)) *
			(5 + 28 * tangentLatitude ** 2 + 24 * tangentLatitude ** 4);

	const nuOsgb =
		airyA /
		Math.sqrt(1 - eccentricitySquared * Math.sin(latitudeOsgb) ** 2);
	const x1 = nuOsgb * Math.cos(latitudeOsgb) * Math.cos(longitudeOsgb);
	const y1 = nuOsgb * Math.cos(latitudeOsgb) * Math.sin(longitudeOsgb);
	const z1 = nuOsgb * (1 - eccentricitySquared) * Math.sin(latitudeOsgb);
	const scaleFactor = 20.4894e-6;
	const rx = radians(0.1502 / 3600);
	const ry = radians(0.247 / 3600);
	const rz = radians(0.8421 / 3600);
	const x2 = 446.448 + (1 + scaleFactor) * x1 - rz * y1 + ry * z1;
	const y2 = -125.157 + rz * x1 + (1 + scaleFactor) * y1 - rx * z1;
	const z2 = 542.06 - ry * x1 + rx * y1 + (1 + scaleFactor) * z1;

	const wgsA = 6378137;
	const wgsB = 6356752.3141;
	const wgsEccentricitySquared = 1 - (wgsB * wgsB) / (wgsA * wgsA);
	const planarDistance = Math.hypot(x2, y2);
	let wgsLatitude = Math.atan2(
		z2,
		planarDistance * (1 - wgsEccentricitySquared),
	);
	let previousLatitude: number;
	do {
		previousLatitude = wgsLatitude;
		const wgsNu =
			wgsA /
			Math.sqrt(1 - wgsEccentricitySquared * Math.sin(wgsLatitude) ** 2);
		wgsLatitude = Math.atan2(
			z2 + wgsEccentricitySquared * wgsNu * Math.sin(wgsLatitude),
			planarDistance,
		);
	} while (Math.abs(wgsLatitude - previousLatitude) > 1e-12);

	return [degrees(Math.atan2(y2, x2)), degrees(wgsLatitude)];
};

const isBritishNationalGrid = (geojson: GeoJsonFeatureCollection) =>
	geojson.crs?.properties.name.toUpperCase().includes("27700") ?? false;

const reprojectCoordinates = (coordinates: unknown): unknown => {
	if (!Array.isArray(coordinates)) return coordinates;
	if (typeof coordinates[0] === "number") {
		return britishNationalGridToWgs84(coordinates as Position);
	}
	return coordinates.map(reprojectCoordinates);
};

const reprojectGeometry = (geometry: Geometry): Geometry => {
	if (geometry.type === "GeometryCollection") {
		return {
			...geometry,
			geometries: geometry.geometries.map(reprojectGeometry),
		};
	}
	return {
		...geometry,
		coordinates: reprojectCoordinates(geometry.coordinates) as never,
	};
};

const reprojectBritishNationalGrid = (
	geojson: GeoJsonFeatureCollection,
): GeoJsonFeatureCollection => ({
	...geojson,
	features: geojson.features.map((feature) => ({
		...feature,
		geometry: reprojectGeometry(feature.geometry),
	})),
});

/**
 * Normalises a fetched boundary file into a GeoJSON FeatureCollection. The
 * files are TopoJSON, but a plain FeatureCollection is accepted too, so the
 * shape is decided at runtime rather than assumed.
 */
export const decodeBoundaryData = (json: unknown): BoundaryGeojson => {
	let geojson: GeoJsonFeatureCollection;
	if (isTopology(json)) {
		const objectKey = Object.keys(json.objects)[0];
		if (!objectKey)
			throw new Error("TopoJSON contains no geometry objects");

		const result = topojson.feature(json, json.objects[objectKey]);
		geojson =
			result.type === "Feature"
				? { type: "FeatureCollection", features: [result] }
				: result;
	} else {
		geojson = json as GeoJsonFeatureCollection;
	}

	if (isBritishNationalGrid(geojson)) {
		geojson = reprojectBritishNationalGrid(geojson);
	}

	if (!geojson.crs || isBritishNationalGrid(geojson)) {
		geojson = {
			...geojson,
			crs: {
				type: "name",
				properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" },
			},
		};
	}

	return geojson as BoundaryGeojson;
};
