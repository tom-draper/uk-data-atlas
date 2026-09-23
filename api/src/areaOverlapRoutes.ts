import { measurePairOverlap, PAIR_OVERLAP_RULES } from "./areaOverlap";
import { areaNotFound } from "./areaResources";
import { geographyResolverFor, type RouteRequest } from "./routing";
import { envelope, problem, type ApiResponse } from "./routeResponse";

/** Travels with an overlap, so the relation reported can be read against the rule that decided it. */
const PAIR_OVERLAP_METHOD = {
	...PAIR_OVERLAP_RULES,
	rule: "The two geometries are intersected and the intersection judged by its widest piece, as the published area-overlap crosswalks are compiled. Under sliverWidthM it is where two independently generalised borders disagree, and the relation is boundary-only; within a factor of two of it the relation is indeterminate, because a crosswalk compile would refuse to decide. Otherwise an area is within the other once minimumCoverage of it is covered.",
	area: "Ellipsoidal, through EPSG:6933, an equal-area projection on the WGS 84 ellipsoid, so no correction is applied. A piece's width is twice its area over its perimeter.",
	limits: "Computed from the generalised boundaries as published, which trace coastlines and borders approximately. This measures those shapes and is not an official statement of how the two areas relate; publishedRelationships lists any crosswalk that is.",
} as const;

/** How one area's published boundary overlaps another's, measured rather than asserted. */
export const handleAreaOverlapRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 6 ||
		segments[0] !== "v1" ||
		segments[1] !== "areas" ||
		segments[5] !== "overlap"
	)
		return undefined;
	const geographyResolver = geographyResolverFor(context);
	const [geography, boundaryRelease, code] = segments.slice(2, 5) as [
		string,
		string,
		string,
	];
	const other = (parsedUrl.searchParams.get("with") ?? "").split("/");
	if (other.length !== 3 || other.some((part) => part.length === 0)) {
		return problem(
			400,
			"Invalid Query",
			"with must name the other area as {geography}/{release}/{code}, such as localAuthority/2024-05-uk-bgc/E07000092.",
		);
	}
	const [otherGeography, otherRelease, otherCode] = other as [
		string,
		string,
		string,
	];
	const identity = { geography, boundaryRelease, code };
	const area = geographyResolver.area(identity);
	if (!area) return areaNotFound(context, geography, boundaryRelease, code);
	const otherIdentity = {
		geography: otherGeography,
		boundaryRelease: otherRelease,
		code: otherCode,
	};
	const otherArea = geographyResolver.area(otherIdentity);
	if (!otherArea)
		return areaNotFound(context, otherGeography, otherRelease, otherCode);
	const unavailable = geographyResolver.requires("geometry");
	if (unavailable) return unavailable;
	try {
		const resolved = geographyResolver.areaGeometry(identity);
		const otherResolved = geographyResolver.areaGeometry(otherIdentity);
		if (!resolved || !otherResolved)
			return problem(
				404,
				"Not Found",
				`No raw geometry matches ${!resolved ? `${geography}/${boundaryRelease}/${code}` : `${otherGeography}/${otherRelease}/${otherCode}`}.`,
			);
		const measured = measurePairOverlap(
			resolved.geometry,
			otherResolved.geometry,
			PAIR_OVERLAP_RULES,
		);
		const otherId = otherResolved.id;
		const round = (value: number) => Math.round(value * 1e6) / 1e6;
		return {
			status: 200,
			body: envelope(releaseId, {
				first: {
					id: resolved.id,
					geography,
					boundaryRelease,
					...area,
					areaM2: Math.round(measured.firstAreaM2),
					geometry: resolved.geometrySource,
				},
				second: {
					id: otherId,
					geography: otherGeography,
					boundaryRelease: otherRelease,
					...otherArea,
					areaM2: Math.round(measured.secondAreaM2),
					geometry: otherResolved.geometrySource,
				},
				relation: measured.relation,
				overlap: {
					areaM2: Math.round(measured.overlapAreaM2),
					shareOfFirst: round(measured.shareOfFirst),
					shareOfSecond: round(measured.shareOfSecond),
					pieceCount: measured.pieceCount,
					widestPieceWidthM:
						measured.widestPieceWidthM === null
							? null
							: Math.round(measured.widestPieceWidthM * 10) / 10,
				},
				publishedRelationships: geographyResolver
					.relationships({ geography, boundaryRelease, code })
					.filter(
						(relationship) =>
							relationship.counterpart.id === otherId,
					)
					.map((relationship) => ({
						relation: relationship.relation,
						crosswalk: {
							...relationship.crosswalk,
							href: `/v1/crosswalks/${relationship.crosswalk.id}`,
						},
						...(relationship.overlap
							? { overlap: relationship.overlap }
							: {}),
					})),
				method: PAIR_OVERLAP_METHOD,
			}),
		};
	} catch (error) {
		return problem(
			503,
			"Geometry Unavailable",
			error instanceof Error
				? error.message
				: "Geometry could not be loaded to measure an overlap.",
		);
	}
};
