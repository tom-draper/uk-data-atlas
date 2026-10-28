import { GeometryBudget, geometryBudgetProblem } from "./geometryBudget";
import {
	GENERALISATION_METHOD,
	GEOMETRY_TIERS,
	simplifyGeometry,
} from "@uk-data-atlas/map-tiles/simplifyGeometry";
import { cursorFor, nextPageHref, readCursor } from "./pagination";
import { latestPublishedBoundaryRelease } from "./pointLookup";
import type { RouteRequest } from "@uk-data-atlas/atlas-runtime/areas";
import {
	envelope,
	invalidQuery,
	problem,
	type ApiResponse,
} from "@uk-data-atlas/atlas-runtime/api";
import { readChoice, readWholeNumber } from "@uk-data-atlas/atlas-runtime/api";
import { QUERY_RULES } from "./queryRules";

/**
 * A box query answers with identities by default, so the cost of a wide box is
 * bounded whether or not the caller asks for coordinates too. The cap is on
 * results rather than on the box: a national box is a reasonable analysis
 * question, and it is the geometry that is expensive, not the extent.
 */
const INTERSECTS = QUERY_RULES["GET /areas:intersects"];

/** Areas of one boundary release that intersect a box, with geometry only when a tier is asked for. */
export const handleAreaIntersectsRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 2 ||
		segments[0] !== "v1" ||
		segments[1] !== "areas:intersects"
	)
		return undefined;
	const geographyResolver = context.geographyResolver;
	const raw = parsedUrl.searchParams.get("bbox");
	const parts = (raw ?? "").split(",").map((part) => Number(part.trim()));
	const [west, south, east, north] = parts;
	const geography = parsedUrl.searchParams.get("geography");
	const requestedRelease = parsedUrl.searchParams.get("release") ?? "latest";
	if (
		raw === null ||
		parts.length !== 4 ||
		!parts.every((part) => Number.isFinite(part)) ||
		west! < -180 ||
		east! > 180 ||
		south! < -90 ||
		north! > 90 ||
		west! >= east! ||
		south! >= north! ||
		!geography
	) {
		return invalidQuery(
			"bbox (west,south,east,north in WGS 84, west < east and south < north) and geography are required.",
		);
	}
	const requestedTier = readChoice(
		parsedUrl.searchParams.get("tier"),
		INTERSECTS.tier,
	);
	if (requestedTier === null) {
		return problem(
			400,
			"Unknown Tier",
			`No such generalisation tier: ${parsedUrl.searchParams.get("tier")}. Choose one of ${INTERSECTS.tier.values.join(", ")}.`,
		);
	}
	const limit = readWholeNumber(
		parsedUrl.searchParams.get("limit"),
		INTERSECTS.limit,
	);
	if (limit === null) {
		return invalidQuery(
			`limit must be a whole number from ${INTERSECTS.limit.minimum} to ${INTERSECTS.limit.maximum}.`,
		);
	}
	const cursor = readCursor(parsedUrl);
	if ("problem" in cursor) return cursor.problem;
	const after = cursor.key;
	const current =
		requestedRelease === "latest"
			? latestPublishedBoundaryRelease(context, geography)
			: undefined;
	if (current && "status" in current) return current;
	const boundaryRelease = current?.id ?? requestedRelease;
	if (!geographyResolver.hasAreaRelease(geography, boundaryRelease)) {
		return problem(
			404,
			"Not Found",
			"No compiled area release matches the requested geography and release.",
		);
	}
	try {
		const found = geographyResolver.intersectingAreas(
			geography,
			boundaryRelease,
			[west!, south!, east!, north!],
			limit,
			false,
			after,
		);
		if (!found)
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the geometry source registry before box lookup.",
			);
		const budget = new GeometryBudget();
		const matches = [];
		for (const area of found.matches) {
			if (requestedTier === undefined) {
				matches.push(area);
				continue;
			}
			const resolved = geographyResolver.geometryFor({
				geography,
				boundaryRelease,
				code: area.code,
			});
			if (!resolved) continue;
			if (!budget.add(resolved.geometry))
				return geometryBudgetProblem(geography, boundaryRelease);
			const simplified = simplifyGeometry(
				resolved.geometry,
				requestedTier,
			);
			matches.push(
				!simplified
					? area
					: {
							...area,
							generalisation: {
								vertices: simplified.verticesAfter,
								verticesAtFullResolution:
									simplified.verticesBefore,
								parts: simplified.partsAfter,
								partsAtFullResolution: simplified.partsBefore,
							},
							geometry: simplified.geometry,
						},
			);
		}
		const last = found.matches.at(-1);
		const nextCursor = found.more && last ? cursorFor(last.code) : null;
		return {
			status: 200,
			...(nextCursor
				? {
						headers: {
							link: `<${nextPageHref(parsedUrl, nextCursor)}>; rel="next"`,
						},
					}
				: {}),
			body: envelope(
				releaseId,
				{
					bbox: [west!, south!, east!, north!],
					geography,
					boundaryRelease,
					...(current ? { releaseSelection: current.selection } : {}),
					matched: found.matched,
					returned: matches.length,
					limit,
					truncated: found.more,
					relationRule:
						"within when the area lies entirely inside the box, overlaps when it meets the box without being contained by it. Both are exact: an area is tested against the box itself, not against its bounding box.",
					...(requestedTier === undefined
						? {
								geometry:
									"Not included. Pass tier to receive it, at the cost of the coordinates.",
							}
						: {
								tier: requestedTier,
								toleranceM: GEOMETRY_TIERS[requestedTier],
								minEffectiveAreaM2:
									GEOMETRY_TIERS[requestedTier] ** 2,
								...(requestedTier === "full"
									? {}
									: {
											generalisationMethod:
												GENERALISATION_METHOD,
										}),
							}),
					matches,
				},
				nextCursor,
			),
		};
	} catch (error) {
		return problem(
			503,
			"Geometry Unavailable",
			error instanceof Error
				? error.message
				: "Geometry could not be loaded for box lookup.",
		);
	}
};
