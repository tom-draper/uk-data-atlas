import { requireGeography } from "@uk-data-atlas/atlas-runtime/api";
import {
	CAPABILITY_STATUSES,
	notBuilt,
	unsupported,
	type CapabilityStatus,
} from "@uk-data-atlas/atlas-runtime/areas";
import { measureCapability } from "@uk-data-atlas/atlas-runtime/catalogue";
import type { AreaIdentity } from "@uk-data-atlas/atlas-runtime/areas";
import type { RouteRequest } from "@uk-data-atlas/atlas-runtime/areas";
import { releaseMonth } from "@uk-data-atlas/atlas-runtime/areas";
import { requirementDetail } from "@uk-data-atlas/atlas-runtime/api";

/**
 * What the API can answer for one area, as `include=capabilities` expands it:
 * its geometry, relationships, named locations and measure coverage.
 */
export const areaCapabilities = (
	context: RouteRequest["context"],
	identity: AreaIdentity,
) => {
	const { dataCatalog, measureCompatibilityInventory } = context;
	const geographyResolver = context.geographyResolver;
	const { geography, boundaryRelease, code } = identity;
	const geometryHref = `/v1/areas/${geography}/${boundaryRelease}/${code}/geometry`;
	const geometry = (() => {
		const unavailable = requireGeography(geographyResolver, "geometry");
		if (unavailable)
			return {
				...notBuilt(requirementDetail(unavailable)),
				href: geometryHref,
			};
		try {
			const resolved = geographyResolver.areaGeometry(identity);
			return resolved
				? {
						status: "available" as const,
						href: geometryHref,
						provenance: resolved.geometrySource,
					}
				: {
						...unsupported(
							"The release's geometry source has no feature for this area's code.",
						),
						href: geometryHref,
					};
		} catch (error) {
			return {
				...unsupported(
					error instanceof Error
						? error.message
						: "Geometry could not be loaded.",
				),
				href: geometryHref,
			};
		}
	})();
	const relationshipSummary =
		geographyResolver.areaRelationshipSummary(identity);
	const crosswalks = relationshipSummary.crosswalks.map((crosswalk) => ({
		...crosswalk,
		href: `/v1/crosswalks/${crosswalk.id}`,
	}));
	const locations = geographyResolver.namedLocationsForArea(
		identity,
		releaseMonth(boundaryRelease),
	);
	const data = (() => {
		if (!dataCatalog || !measureCompatibilityInventory)
			return notBuilt(
				"Build the data catalogue and measure compatibility before describing data.",
			);
		const assessed = dataCatalog.measures.map((measure) => ({
			measure,
			capability: measureCapability(context, measure, identity),
		}));
		const counts = Object.fromEntries(
			CAPABILITY_STATUSES.map((status) => [
				status,
				assessed.filter(
					({ capability }) => capability.status === status,
				).length,
			]),
		) as Record<CapabilityStatus, number>;
		const status: CapabilityStatus =
			counts.available > 0
				? "available"
				: counts.partial > 0
					? "partial"
					: counts["requires-conversion"] > 0
						? "requires-conversion"
						: "unsupported";
		return {
			status,
			...(status === "available"
				? {}
				: {
						reason:
							status === "unsupported"
								? "No published measure has a value for this area, directly or through a conversion."
								: status === "partial"
									? "Measures have values for this area in only some periods or only partly joined sources."
									: "No measure is published on this release; some convert onto it through a published crosswalk.",
					}),
			counts,
			measures: assessed
				.filter(({ capability }) => capability.status !== "unsupported")
				.map(({ measure, capability }) => ({
					id: measure.id,
					valueKind: measure.valueKind,
					unit: measure.unit,
					availability: measure.availability,
					href: `/v1/measures/${measure.id}`,
					...capability,
				})),
			note: "Measures are listed when they are available, partial or require a conversion; counts include the unsupported ones. Compatibility compares area-code membership only and does not assert equal geometry between a source and this boundary release. A conversion is offered only after the conversion it names has been tried and accepted on the source's latest period.",
		};
	})();
	return {
		geometry,
		relationships: requireGeography(geographyResolver, "relationships")
			? notBuilt(
					requirementDetail(
						requireGeography(geographyResolver, "relationships"),
					),
				)
			: {
					...(relationshipSummary.relationships.length > 0
						? { status: "available" as const }
						: unsupported(
								"No published crosswalk names this area.",
							)),
					href: `/v1/areas/${geography}/${boundaryRelease}/${code}/relationships`,
					count: relationshipSummary.relationships.length,
					byRelation: relationshipSummary.byRelation,
					parents: {
						count: relationshipSummary.parentCount,
						href: `/v1/areas/${geography}/${boundaryRelease}/${code}/parents`,
					},
					children: {
						count: relationshipSummary.childCount,
						href: `/v1/areas/${geography}/${boundaryRelease}/${code}/children`,
					},
					crosswalks,
				},
		namedLocations: requireGeography(geographyResolver, "named-locations")
			? notBuilt(
					requirementDetail(
						requireGeography(geographyResolver, "named-locations"),
					),
				)
			: {
					...(locations.length > 0
						? { status: "available" as const }
						: unsupported(
								"No curated named location lists this area's code.",
							)),
					membership: "direct-code-match" as const,
					locations: locations.map((location) => ({
						id: location.id,
						label: location.label,
						href: `/v1/locations/${location.id}/members?geography=${geography}&release=${boundaryRelease}`,
					})),
					note: "Membership is a direct code match against each named location's members active in this boundary release's snapshot month. A location's kind says whether it is an official area sourced from an ONS lookup or an editorial grouping; neither asserts equal geometry.",
				},
		data,
	};
};
