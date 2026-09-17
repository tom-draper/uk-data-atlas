import { measureCoverage } from "./measureCoverage";
import { areaMeasureSources, areaNotFound } from "./areaResources";
import type { RouteRequest } from "./routing";
import { envelope, problem, type ApiResponse } from "./routeResponse";

/** What the API can answer for one area: its geometry, relationships, named locations and measure coverage. */
export const handleAreaCapabilityRoutes = ({
	context,
	releaseId,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 6 ||
		segments[0] !== "v1" ||
		segments[1] !== "areas" ||
		segments[5] !== "capabilities"
	)
		return undefined;
	const {
		crosswalkLookup,
		namedLocationInventory,
		dataCatalog,
		populationObservations,
		populationLocalAuthorityObservations,
		measureObservations,
		measureCompatibilityInventory,
		geographyResolver,
	} = context;
	const [geography, boundaryRelease, code] = segments.slice(2, 5) as [
		string,
		string,
		string,
	];
	if (!geographyResolver)
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the geography resolver before describing an area.",
		);
	const identity = { geography, boundaryRelease, code };
	const area = geographyResolver.area(identity);
	if (!area) return areaNotFound(context, geography, boundaryRelease, code);
	const geometryHref = `/v1/areas/${geography}/${boundaryRelease}/${code}/geometry`;
	const geometry = (() => {
		if (!geographyResolver.hasAreaGeometryCache())
			return { status: "not-published" as const, href: geometryHref };
		try {
			const resolved = geographyResolver.areaGeometry(identity);
			return resolved
				? {
						status: "available" as const,
						href: geometryHref,
						provenance: resolved.geometrySource,
					}
				: { status: "not-found" as const, href: geometryHref };
		} catch (error) {
			return {
				status: "unavailable" as const,
				href: geometryHref,
				reason:
					error instanceof Error
						? error.message
						: "Geometry could not be loaded.",
			};
		}
	})();
	const relationships = crosswalkLookup
		? geographyResolver.relationships({ geography, boundaryRelease, code })
		: [];
	const relationCount = (relation: string) =>
		relationships.filter((candidate) => candidate.relation === relation)
			.length;
	const crosswalks = [
		...new Map(
			relationships.map((relationship) => [
				relationship.crosswalk.id,
				relationship.crosswalk,
			]),
		).values(),
	].map((crosswalk) => ({
		...crosswalk,
		href: `/v1/crosswalks/${crosswalk.id}`,
	}));
	const data =
		dataCatalog && measureCompatibilityInventory
			? {
					status: "available" as const,
					measures: dataCatalog.measures.flatMap((measure) => {
						const coverage = measureCoverage(
							dataCatalog,
							measureCompatibilityInventory,
							measure.id,
						);
						const sources = areaMeasureSources(
							measure,
							coverage,
							boundaryRelease,
							code,
							{
								populationObservations,
								populationLocalAuthorityObservations,
								measureObservations,
							},
						);
						return sources.length > 0
							? [
									{
										id: measure.id,
										valueKind: measure.valueKind,
										unit: measure.unit,
										availability: measure.availability,
										href: `/v1/measures/${measure.id}`,
										sources,
									},
								]
							: [];
					}),
					note: "Compatibility compares area-code membership only. It does not assert equal geometry between a source and this boundary release.",
				}
			: { status: "not-published" as const };
	return {
		status: 200,
		body: envelope(releaseId, {
			id: `${geography}/${boundaryRelease}/${code}`,
			geography,
			boundaryRelease,
			...area,
			capabilities: {
				geometry,
				relationships: crosswalkLookup
					? {
							status: "available" as const,
							href: `/v1/areas/${geography}/${boundaryRelease}/${code}/relationships`,
							count: relationships.length,
							byRelation: Object.fromEntries(
								[
									...new Set(
										relationships.map(
											(relationship) =>
												relationship.relation,
										),
									),
								].map((relation) => [
									relation,
									relationCount(relation),
								]),
							),
							parents: {
								count: relationCount("within"),
								href: `/v1/areas/${geography}/${boundaryRelease}/${code}/parents`,
							},
							children: {
								count: relationCount("contains"),
								href: `/v1/areas/${geography}/${boundaryRelease}/${code}/children`,
							},
							crosswalks,
						}
					: { status: "not-published" as const },
				namedLocations: namedLocationInventory
					? {
							status: "available" as const,
							membership: "direct-code-match" as const,
							locations: namedLocationInventory.locations
								.filter((location) =>
									location.memberCodes.includes(code),
								)
								.map((location) => ({
									id: location.id,
									label: location.label,
									href: `/v1/locations/${location.id}/members?geography=${geography}&release=${boundaryRelease}`,
								})),
							note: "Named locations are editorial groupings. Membership is a direct code match and does not assert an official geography or equal geometry.",
						}
					: { status: "not-published" as const },
				data,
			},
		}),
	};
};
