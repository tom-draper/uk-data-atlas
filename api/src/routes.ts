import { measureCoverage } from "./measureCoverage";
import {
	areaMeasureSources,
	areaNotFound,
	findArea,
	relationshipsFor,
} from "./areaResources";
import { handleRoute } from "./routeHandlers";
import type { RouteContext } from "./routing";
import { envelope, problem, type ApiResponse } from "./routeResponse";

export { type ApiResponse } from "./routeResponse";

const decodePathSegment = (segment: string) => {
	try {
		return decodeURIComponent(segment);
	} catch {
		return undefined;
	}
};

/**
 * Route a request against named, independently-built catalogues. Keeping the
 * dependencies in one object prevents a newly added artifact from silently
 * shifting a long positional argument list at every call site.
 */
export const route = (
	method: string | undefined,
	url: string | undefined,
	context: RouteContext,
): ApiResponse => {
	const {
		boundaryRegistry: registry,
		areaLookup,
		crosswalkLookup,
		atlasRelease,
		areaRelationshipIndex,
		areaGeometryCache,
		namedLocationInventory,
		dataCatalog,
		populationObservations,
		populationLocalAuthorityObservations,
		measureObservations,
		measureCompatibilityInventory,
	} = context;
	const releaseId = atlasRelease?.releaseId ?? registry.contentHash;
	if (method !== "GET") {
		return problem(405, "Method Not Allowed", "This API is read-only.");
	}

	const parsedUrl = new URL(url ?? "/", "http://localhost");
	const pathname = parsedUrl.pathname;
	const segments = pathname.split("/").filter(Boolean).map(decodePathSegment);
	if (segments.some((segment) => segment === undefined)) {
		return problem(
			400,
			"Invalid Path",
			"The request path contains invalid encoding.",
		);
	}
	const handledResponse = handleRoute({
		context,
		releaseId,
		parsedUrl,
		segments: segments as string[],
	});
	if (handledResponse) return handledResponse;

	if (segments.length === 1 && segments[0] === "v1") {
		return {
			status: 200,
			body: envelope(releaseId, {
				name: "UK Data Atlas API",
				links: [
					"/v1/geographies",
					"/v1/boundary-releases",
					"/v1/boundary-releases:resolve",
					"/v1/boundary-releases/{type}/{release}",
					"/v1/geography-inventory",
					"/v1/datasets",
					"/v1/datasets/{dataset-id}",
					"/v1/measures",
					"/v1/measures/{measure-id}",
					"/v1/measures/{measure-id}/compatibility",
					"/v1/measures/{measure-id}/coverage",
					"/v1/measures/{measure-id}/quality",
					"/v1/data/{measure-id}",
					"/v1/data/{measure-id}/series",
					"/v1/data/{measure-id}/rankings",
					"/v1/data/{measure-id}/change",
					"/v1/data/{measure-id}/value",
					"/v1/places",
					"/v1/data/{measure-id}/compare",
					"/v1/data/{measure-id}/aggregate",
					"/v1/data/{measure-id}/convert",
					"/v1/areas",
					"/v1/areas:contains",
					"/v1/areas:intersects",
					"/v1/areas:validate",
					"/v1/areas/{type}/{release}/{code}",
					"/v1/areas/{type}/{release}/{code}/history",
					"/v1/areas/{type}/{release}/{code}/parents",
					"/v1/areas/{type}/{release}/{code}/children",
					"/v1/areas/{type}/{release}/{code}/children/geometry",
					"/v1/areas/{type}/{release}/{code}/relationships",
					"/v1/areas/{type}/{release}/{code}/neighbours",
					"/v1/areas/{type}/{release}/{code}/overlap",
					"/v1/areas/{type}/{release}/{code}/capabilities",
					"/v1/areas/{type}/{release}/{code}/citation",
					"/v1/areas/{type}/{release}/{code}/geometry",
					"/v1/areas/{type}/{release}/{code}/geometry/metadata",
					"/v1/translations",
					"/v1/attribution",
					"/v1/locations",
					"/v1/locations/{location-id}",
					"/v1/locations/{location-id}/members",
					"/v1/crosswalks",
					"/v1/crosswalks/{crosswalk-id}",
					"/v1/crosswalks/{crosswalk-id}/records",
					"/v1/relationship-candidates",
					"/v1/validation",
					"/v1/validation/boundary-releases/{type}/{release}",
					"/v1/validation/crosswalks/{crosswalk-id}",
					"/v1/validation/measures/{measure-id}",
					"/v1/validation/exports/{export-id}",
					"/v1/exports",
					"/v1/exports/{export-id}",
					"/v1/lookups",
					"/v1/lookups/{lookup-id}",
					"/v1/atlas-release",
					"/v1/atlas-releases",
					"/v1/atlas-releases/{release-id}",
					"/v1/atlas-releases/compare",
				],
			}),
		};
	}

	if (
		segments.length === 6 &&
		segments[0] === "v1" &&
		segments[1] === "areas" &&
		segments[5] === "capabilities"
	) {
		const [geography, boundaryRelease, code] = segments.slice(2, 5) as [
			string,
			string,
			string,
		];
		const area = findArea(areaLookup, geography, boundaryRelease, code);
		if (!area)
			return areaNotFound(context, geography, boundaryRelease, code);
		const geometryHref = `/v1/areas/${geography}/${boundaryRelease}/${code}/geometry`;
		const geometry = (() => {
			if (!areaGeometryCache)
				return { status: "not-published" as const, href: geometryHref };
			try {
				return areaGeometryCache.get(geography, boundaryRelease, code)
					? {
							status: "available" as const,
							href: geometryHref,
							provenance: areaGeometryCache.provenance(
								geography,
								boundaryRelease,
								code,
							),
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
			? relationshipsFor(
					areaRelationshipIndex,
					crosswalkLookup,
					geography,
					boundaryRelease,
					code,
				)
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
	}

	return problem(404, "Not Found", "No API resource matches that path.");
};
