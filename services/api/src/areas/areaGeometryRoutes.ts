import { requireGeography } from "@uk-data-atlas/atlas-runtime/api";
import {
	GENERALISATION_METHOD,
	simplifyGeometry,
} from "@uk-data-atlas/map-tiles/simplifyGeometry";
import { areaNotFound } from "@uk-data-atlas/atlas-runtime/api";
import type { RouteRequestFor } from "@uk-data-atlas/atlas-runtime/api";
import {
	envelope,
	problem,
	type ApiResponse,
} from "@uk-data-atlas/atlas-runtime/api";
import { readChoice } from "@uk-data-atlas/atlas-runtime/api";
import { QUERY_RULES } from "../queryRules";

const TIER =
	QUERY_RULES["GET /areas/{geography}/{release}/{code}/geometry"].tier;

/** One area's published boundary as a GeoJSON feature, generalised to a tier on request. */
export const handleAreaGeometryRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequestFor<
	"area" | "areaGeometry" | "explainAreaAbsence" | "missingRequirement"
>): ApiResponse | undefined => {
	if (
		segments.length !== 6 ||
		segments[0] !== "v1" ||
		segments[1] !== "areas" ||
		segments[5] !== "geometry"
	)
		return undefined;
	const geographyResolver = context.geographyResolver;
	const [geography, boundaryRelease, code] = segments.slice(2, 5);
	const identity = {
		geography: geography as string,
		boundaryRelease: boundaryRelease as string,
		code: code as string,
	};
	const area = geographyResolver.area(identity);
	if (!area) return areaNotFound(context, geography, boundaryRelease, code);
	const unavailable = requireGeography(geographyResolver, "geometry");
	if (unavailable) return unavailable;
	try {
		const resolved = geographyResolver.areaGeometry(identity);
		if (!resolved)
			return problem(
				404,
				"Not Found",
				"No raw geometry matches that area identity.",
			);
		const requestedTier = readChoice(
			parsedUrl.searchParams.get("tier"),
			TIER,
		);
		if (!requestedTier)
			return problem(
				400,
				"Unknown Tier",
				`No such generalisation tier: ${parsedUrl.searchParams.get("tier")}. Choose one of ${TIER.values.join(", ")}.`,
			);
		const simplified = simplifyGeometry(resolved.geometry, requestedTier);
		if (!simplified)
			return problem(
				404,
				"Not Found",
				`Every part of that area is smaller than the ${requestedTier} tier keeps. Ask for a finer tier.`,
			);
		return {
			status: 200,
			body: envelope(releaseId, {
				type: "Feature",
				id: resolved.id,
				properties: {
					id: resolved.id,
					geography,
					boundaryRelease,
					...area,
					generalisation: {
						tier: simplified.tier,
						toleranceM: simplified.toleranceM,
						minEffectiveAreaM2: simplified.minEffectiveAreaM2,
						vertices: simplified.verticesAfter,
						verticesAtFullResolution: simplified.verticesBefore,
						parts: simplified.partsAfter,
						partsAtFullResolution: simplified.partsBefore,
						...(requestedTier === "full"
							? {}
							: { method: GENERALISATION_METHOD }),
					},
					geometrySource: resolved.geometrySource,
				},
				geometry: simplified.geometry,
			}),
		};
	} catch (error) {
		return problem(
			503,
			"Geometry Unavailable",
			error instanceof Error
				? error.message
				: "Geometry could not be loaded.",
		);
	}
};
