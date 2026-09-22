import { areaNotFound } from "./areaResources";
import { notBuilt, unsupported } from "./capability";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

/**
 * A single, evidence-led starting point for an exact area identity. Detailed
 * geometry, relationships, history and data stay in their dedicated resources
 * so this response remains useful without pretending an absent artefact exists.
 */
export const handleAreaDossierRoutes = ({
	context,
	releaseId,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 6 ||
		segments[0] !== "v1" ||
		segments[1] !== "areas" ||
		segments[5] !== "dossier"
	)
		return undefined;
	const [geography, boundaryRelease, code] = segments.slice(2, 5) as [
		string,
		string,
		string,
	];
	const { geographyResolver } = context;
	if (!geographyResolver)
		return problem(
			503,
			"Catalogue Unavailable",
			"Build the geography resolver before compiling an area dossier.",
		);
	const identity = { geography, boundaryRelease, code };
	const area = geographyResolver.area(identity);
	if (!area) return areaNotFound(context, geography, boundaryRelease, code);
	const boundary = geographyResolver.boundaryRelease(
		geography,
		boundaryRelease,
	);
	if (!boundary)
		return problem(
			503,
			"Catalogue Unavailable",
			"The boundary registry does not describe this resolved area release.",
		);
	const baseHref = `/v1/areas/${geography}/${boundaryRelease}/${code}`;
	const relationshipSummary = geographyResolver.areaRelationshipSummary(identity);
	const geometry = (() => {
		if (!geographyResolver.hasAreaGeometryCache())
			return notBuilt(
				"Build the geometry source registry before serving geometry.",
			);
		try {
			const resolved = geographyResolver.areaGeometry(identity);
			return resolved
				? {
						status: "available" as const,
						provenance: resolved.geometrySource,
					}
				: unsupported(
						"The release's geometry source has no feature for this area's code.",
					);
		} catch (error) {
			return unsupported(
				error instanceof Error
					? error.message
					: "Geometry could not be loaded.",
			);
		}
	})();
	const relationships = !geographyResolver.hasAreaRelationships()
		? notBuilt("Build the crosswalk inventory before describing relationships.")
		: relationshipSummary.relationships.length > 0
			? { status: "available" as const }
			: unsupported("No published crosswalk names this area.");
	const trustLevel =
		geometry.status === "available" && relationships.status === "available"
			? "verified"
			: geometry.status === "available" || relationships.status === "available"
				? "partial"
				: "limited";
	return {
		status: 200,
		body: envelope(releaseId, {
			id: `${geography}/${boundaryRelease}/${code}`,
			geography,
			boundaryRelease,
			...area,
			boundary: {
				title: boundary.title,
				...(boundary.description
					? { description: boundary.description }
					: {}),
				...(boundary.temporalCoverage
					? { temporalCoverage: boundary.temporalCoverage }
					: {}),
				coverage: boundary.coverage,
				source: boundary.source,
				metadataHash: boundary.metadataHash,
			},
			availability: {
				geometry: { ...geometry, href: `${baseHref}/geometry` },
				relationships: !geographyResolver.hasAreaRelationships()
					? {
							...relationships,
							href: `${baseHref}/relationships`,
						}
					: {
							...relationships,
							href: `${baseHref}/relationships`,
							count: relationshipSummary.relationships.length,
							byRelation: relationshipSummary.byRelation,
							parents: {
								count: relationshipSummary.parentCount,
								href: `${baseHref}/parents`,
							},
							children: {
								count: relationshipSummary.childCount,
								href: `${baseHref}/children`,
							},
						},
				data: {
					href: `${baseHref}/capabilities`,
					note: "The capability report lists every published measure that is directly available, partial, or convertible for this exact area identity.",
				},
				history: {
					href: `${baseHref}/history`,
					note: "History distinguishes published predecessor and successor links from same-code continuity.",
				},
			},
			trust: {
				level: trustLevel,
				note: "Identity is compiled from the named boundary release; this summary reports whether independent geometry and relationship evidence are also available.",
			},
			links: {
				self: baseHref,
				geometry: `${baseHref}/geometry`,
				geometryMetadata: `${baseHref}/geometry/metadata`,
				relationships: `${baseHref}/relationships`,
				parents: `${baseHref}/parents`,
				children: `${baseHref}/children`,
				history: `${baseHref}/history`,
				capabilities: `${baseHref}/capabilities`,
				citation: `${baseHref}/citation`,
				neighbours: `${baseHref}/neighbours`,
				overlap: `${baseHref}/overlap`,
				boundaryRelease: `/v1/boundary-releases/${geography}/${boundaryRelease}`,
			},
		}),
	};
};
