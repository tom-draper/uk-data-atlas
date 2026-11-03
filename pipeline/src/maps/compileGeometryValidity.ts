import GeometryFactory from "jsts/org/locationtech/jts/geom/GeometryFactory.js";
import GeoJSONReader from "jsts/org/locationtech/jts/io/GeoJSONReader.js";
import IsValidOp from "jsts/org/locationtech/jts/operation/valid/IsValidOp.js";
import {
	GEOMETRY_VALIDITY_METHOD,
	type GeometryValidityIssue,
	type GeometryValidityReport,
} from "@uk-data-atlas/geography";
import {
	roundPacked,
	unpackGeometry,
	type PackedGeometry,
} from "@uk-data-atlas/geography/packed-geometry";

const reader = new GeoJSONReader(new GeometryFactory());

const ISSUE_CODES = [
	"topology-error",
	"repeated-point",
	"hole-outside-shell",
	"nested-holes",
	"disconnected-interior",
	"self-intersection",
	"ring-self-intersection",
	"nested-shells",
	"duplicate-rings",
	"too-few-points",
	"invalid-coordinate",
	"ring-not-closed",
];

const invalid = (issue: GeometryValidityIssue): GeometryValidityReport => ({
	method: GEOMETRY_VALIDITY_METHOD,
	status: "invalid",
	issue,
});

const unchecked = (
	reason: Extract<
		GeometryValidityReport,
		{ status: "not-checked" }
	>["reason"],
): GeometryValidityReport => ({
	method: GEOMETRY_VALIDITY_METHOD,
	status: "not-checked",
	reason,
});

/** Reports by geometry, so an area checked while rounding isn't checked again. */
const reports = new WeakMap<PackedGeometry, GeometryValidityReport>();

export const compileGeometryValidity = (
	packed: PackedGeometry,
): GeometryValidityReport => {
	let report = reports.get(packed);
	if (!report) {
		report = checkGeometry(packed);
		reports.set(packed, report);
	}
	return report;
};

/**
 * Rounded to seven decimal places, unless that makes a valid area invalid:
 * vertices of two parts less than a centimetre apart can cross, or a ring
 * that narrow can collapse. Those areas keep their source coordinates.
 */
export const roundKeepingValidity = (
	packed: PackedGeometry,
): PackedGeometry => {
	const rounded = roundPacked(packed);
	return compileGeometryValidity(rounded).status === "invalid" &&
		compileGeometryValidity(packed).status === "valid"
		? packed
		: rounded;
};

const checkGeometry = (packed: PackedGeometry): GeometryValidityReport => {
	if (packed.kind === "collection") return unchecked("unsupported-geometry");
	const type = packed.kind === "packed" ? packed.type : packed.geometry.type;
	if (type !== "Polygon" && type !== "MultiPolygon")
		return unchecked("unsupported-geometry");
	if (
		packed.kind === "packed" &&
		(packed.positions.length / packed.stride >
			GEOMETRY_VALIDITY_METHOD.positionLimit ||
			packed.counts.some(
				(counts) =>
					counts.length > GEOMETRY_VALIDITY_METHOD.positionLimit,
			))
	)
		return unchecked("position-limit");
	const geometry = unpackGeometry(packed);
	const coordinates = geometry.coordinates;
	if (!Array.isArray(coordinates))
		return invalid({
			code: "invalid-structure",
			message: "Expected polygons.",
		});
	const polygons = geometry.type === "Polygon" ? [coordinates] : coordinates;
	const normalized: number[][][][] = [];
	let positions = 0;
	let components = polygons.length;
	if (components > GEOMETRY_VALIDITY_METHOD.positionLimit)
		return unchecked("position-limit");
	for (const polygon of polygons) {
		if (!Array.isArray(polygon))
			return invalid({
				code: "invalid-structure",
				message: "Expected rings.",
			});
		components += polygon.length;
		if (components > GEOMETRY_VALIDITY_METHOD.positionLimit)
			return unchecked("position-limit");
		const rings: number[][][] = [];
		for (const ring of polygon) {
			if (!Array.isArray(ring))
				return invalid({
					code: "invalid-structure",
					message: "Expected a ring.",
				});
			positions += ring.length;
			if (positions > GEOMETRY_VALIDITY_METHOD.positionLimit)
				return unchecked("position-limit");
			if (ring.length < 4)
				return invalid({
					code: "too-few-points",
					message:
						"A ring needs at least four positions including closure.",
				});
			const xy: number[][] = [];
			for (const position of ring) {
				if (
					!Array.isArray(position) ||
					typeof position[0] !== "number" ||
					typeof position[1] !== "number" ||
					!Number.isFinite(position[0]) ||
					!Number.isFinite(position[1])
				)
					return invalid({
						code: "invalid-coordinate",
						message:
							"Positions must have finite X and Y ordinates.",
					});
				xy.push([position[0], position[1]]);
			}
			const first = xy[0]!;
			const last = xy[xy.length - 1]!;
			if (first[0] !== last[0] || first[1] !== last[1])
				return invalid({
					code: "ring-not-closed",
					message:
						"Ring endpoints must have equal X and Y ordinates.",
				});
			rings.push(xy);
		}
		normalized.push(rings);
	}
	try {
		const operation = new IsValidOp(
			reader.read({ type: "MultiPolygon", coordinates: normalized }),
		);
		const error = operation.getValidationError();
		if (!error)
			return { method: GEOMETRY_VALIDITY_METHOD, status: "valid" };
		const coordinate: unknown = error.getCoordinate();
		return invalid({
			code: ISSUE_CODES[error.getErrorType()] ?? "topology-error",
			message: error.getMessage(),
			...(typeof coordinate === "object" &&
			coordinate !== null &&
			"x" in coordinate &&
			"y" in coordinate &&
			typeof coordinate.x === "number" &&
			typeof coordinate.y === "number" &&
			Number.isFinite(coordinate.x) &&
			Number.isFinite(coordinate.y)
				? {
						coordinate: [coordinate.x, coordinate.y] satisfies [
							number,
							number,
						],
					}
				: {}),
		});
	} catch {
		return unchecked("validator-error");
	}
};
