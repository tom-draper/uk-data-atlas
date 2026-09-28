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

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isNumberArray = (value: unknown): value is number[] =>
	Array.isArray(value) &&
	value.every(
		(coordinate) =>
			typeof coordinate === "number" && Number.isFinite(coordinate),
	);

const isPosition = (value: unknown): value is Position =>
	isNumberArray(value) && value.length >= 2;

const isPositionArray = (value: unknown): value is Position[] =>
	Array.isArray(value) && value.every(isPosition);

const isGeometry = (value: unknown): value is Geometry => {
	if (!isRecord(value) || typeof value.type !== "string") return false;
	if (value.bbox !== undefined && !isNumberArray(value.bbox)) return false;

	switch (value.type) {
		case "Point":
			return isPosition(value.coordinates);
		case "MultiPoint":
		case "LineString":
			return isPositionArray(value.coordinates);
		case "MultiLineString":
		case "Polygon":
			return (
				Array.isArray(value.coordinates) &&
				value.coordinates.every(isPositionArray)
			);
		case "MultiPolygon":
			return (
				Array.isArray(value.coordinates) &&
				value.coordinates.every(
					(polygon) =>
						Array.isArray(polygon) &&
						polygon.every(isPositionArray),
				)
			);
		case "GeometryCollection":
			return (
				Array.isArray(value.geometries) &&
				value.geometries.every(isGeometry)
			);
		default:
			return false;
	}
};

const isGeoJsonFeature = (
	value: unknown,
): value is GeoJsonFeatureCollection["features"][number] =>
	isRecord(value) &&
	value.type === "Feature" &&
	(value.geometry === null ||
		(isGeometry(value.geometry) &&
			(value.geometry.type === "Polygon" ||
				value.geometry.type === "MultiPolygon"))) &&
	isRecord(value.properties) &&
	(value.id === undefined ||
		typeof value.id === "string" ||
		typeof value.id === "number") &&
	(value.bbox === undefined || isNumberArray(value.bbox));

const isGeoJsonFeatureCollection = (
	value: unknown,
): value is GeoJsonFeatureCollection =>
	isRecord(value) &&
	value.type === "FeatureCollection" &&
	Array.isArray(value.features) &&
	value.features.every(isGeoJsonFeature) &&
	(value.crs === undefined ||
		(isRecord(value.crs) &&
			typeof value.crs.type === "string" &&
			isRecord(value.crs.properties) &&
			typeof value.crs.properties.name === "string"));

const isArc = (value: unknown): value is Topology["arcs"][number] =>
	Array.isArray(value) &&
	value.every((point) => isNumberArray(point) && point.length >= 2);

const isArcIndexes = (value: unknown): value is number[] =>
	Array.isArray(value) && value.every((index) => Number.isSafeInteger(index));

const isTopologyObject = (
	value: unknown,
): value is Topology["objects"][string] => {
	if (
		!isRecord(value) ||
		typeof value.type !== "string" ||
		(value.bbox !== undefined && !isNumberArray(value.bbox)) ||
		(value.properties !== undefined &&
			value.properties !== null &&
			!isRecord(value.properties)) ||
		(value.id !== undefined &&
			typeof value.id !== "string" &&
			typeof value.id !== "number")
	)
		return false;

	switch (value.type) {
		case "Point":
			return isPosition(value.coordinates);
		case "MultiPoint":
			return isPositionArray(value.coordinates);
		case "LineString":
			return isArcIndexes(value.arcs);
		case "MultiLineString":
		case "Polygon":
			return Array.isArray(value.arcs) && value.arcs.every(isArcIndexes);
		case "MultiPolygon":
			return (
				Array.isArray(value.arcs) &&
				value.arcs.every(
					(polygon) =>
						Array.isArray(polygon) && polygon.every(isArcIndexes),
				)
			);
		case "GeometryCollection":
			return (
				Array.isArray(value.geometries) &&
				value.geometries.every(isTopologyObject)
			);
		default:
			return false;
	}
};

const isTopology = (value: unknown): value is Topology =>
	isRecord(value) &&
	value.type === "Topology" &&
	(value.bbox === undefined || isNumberArray(value.bbox)) &&
	isRecord(value.objects) &&
	Object.values(value.objects).every(isTopologyObject) &&
	Array.isArray(value.arcs) &&
	value.arcs.every(isArc) &&
	(value.transform === undefined ||
		(isRecord(value.transform) &&
			isNumberArray(value.transform.scale) &&
			value.transform.scale.length === 2 &&
			isNumberArray(value.transform.translate) &&
			value.transform.translate.length === 2));

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
	// OSGB36 to WGS84 is the inverse of the Ordnance Survey's published
	// WGS84 to OSGB36 Helmert, whose scale is +20.4894 ppm.
	const scaleFactor = -20.4894e-6;
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
 * Numbers any feature that arrives without an id by its position, counting
 * from one. The map keys hover state by feature id, so a feature without one
 * cannot be hovered or highlighted. Whether a publisher file carries ids
 * depends on the format it was downloaded in, not on the release, so they are
 * never relied on. Position from one is the numbering the files that do carry
 * ids already use, and the one properties sidecars are given.
 */
const withFeatureIds = (
	geojson: GeoJsonFeatureCollection,
): GeoJsonFeatureCollection =>
	geojson.features.every((feature) => typeof feature.id === "number")
		? geojson
		: {
				...geojson,
				features: geojson.features.map((feature, index) =>
					typeof feature.id !== "number"
						? { ...feature, id: index + 1 }
						: feature,
				),
			};

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
		const collection =
			result.type === "Feature"
				? { type: "FeatureCollection", features: [result] }
				: result;
		if (!isGeoJsonFeatureCollection(collection))
			throw new Error(
				"TopoJSON did not decode to a valid feature collection",
			);
		geojson = collection;
	} else if (isGeoJsonFeatureCollection(json)) {
		geojson = json;
	} else {
		throw new Error("Boundary data is not valid GeoJSON or TopoJSON");
	}

	geojson = withFeatureIds(geojson);

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
