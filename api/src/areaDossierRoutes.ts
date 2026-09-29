import { areaNotFound } from "./areaResources";
import { geometryBounds } from "./areaContainment";
import { notBuilt, unsupported } from "./capability";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";
import { areaKey } from "./geographyKeys";

type AreaIdentity = {
	geography: string;
	boundaryRelease: string;
	code: string;
};

type AreaDossierResult =
	{ dossier: Record<string, unknown> } | { response: ApiResponse };

const requirementDetail = (response: ApiResponse | undefined) =>
	response && "detail" in response.body
		? response.body.detail
		: "Catalogue data is unavailable.";

/** The selective evidence expansion shared by the exact-area and legacy routes. */
export const areaDossier = (
	context: RouteRequest["context"],
	{ geography, boundaryRelease, code }: AreaIdentity,
	dossierHref: (boundaryRelease: string) => string,
): AreaDossierResult => {
	const geographyResolver = context.geographyResolver;
	const identity = { geography, boundaryRelease, code };
	const area = geographyResolver.area(identity);
	if (!area)
		return {
			response: areaNotFound(context, geography, boundaryRelease, code),
		};
	const boundary = geographyResolver.boundaryRelease(
		geography,
		boundaryRelease,
	);
	if (!boundary)
		return {
			response: problem(
				503,
				"Catalogue Unavailable",
				"The boundary registry does not describe this resolved area release.",
			),
		};
	const baseHref = `/v1/areas/${geography}/${boundaryRelease}/${code}`;
	const codeReleases = geographyResolver.codeReleases(identity);
	const relationshipSummary =
		geographyResolver.areaRelationshipSummary(identity);
	const geometry = (() => {
		const unavailable = geographyResolver.requires("geometry");
		if (unavailable) return notBuilt(requirementDetail(unavailable));
		try {
			const resolved = geographyResolver.areaGeometry(identity);
			return resolved
				? {
						status: "available" as const,
						provenance: resolved.geometrySource,
						boundingBox: geometryBounds(resolved.geometry),
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
	const extent =
		geometry.status === "available"
			? geometry.boundingBox
				? {
						status: "available" as const,
						boundingBox: geometry.boundingBox,
						crs: "OGC:CRS84",
						href: `${baseHref}/geometry/metadata`,
					}
				: unsupported(
						"The release's geometry has no coordinates from which to state an extent.",
					)
			: { ...geometry, href: `${baseHref}/geometry/metadata` };
	const relationshipUnavailable = geographyResolver.requires("relationships");
	const relationships = relationshipUnavailable
		? notBuilt(requirementDetail(relationshipUnavailable))
		: relationshipSummary.relationships.length > 0
			? { status: "available" as const }
			: unsupported("No published crosswalk names this area.");
	const trustLevel =
		geometry.status === "available" && relationships.status === "available"
			? relationshipSummary.crosswalks.some(
					(crosswalk) => crosswalk.quality === "derived",
				)
				? "derived"
				: "verified"
			: geometry.status === "available" ||
				  relationships.status === "available"
				? "partial"
				: "limited";
	return {
		dossier: {
			validity: {
				releases: codeReleases.map((candidate) => ({
					boundaryRelease: candidate.boundaryRelease,
					name: candidate.name,
					href: dossierHref(candidate.boundaryRelease),
				})),
				note: "These are the compiled boundary releases that hold this code. They show its published code span, not a legal validity date or unchanged extent.",
			},
			extent,
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
				relationships: relationshipUnavailable
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
				note: "Identity is compiled from the named boundary release; this summary reports whether independent geometry and relationship evidence are also available. Derived crosswalk evidence is never presented as publisher-supplied verification.",
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
		},
	};
};

/**
 * A legacy adapter for callers that still dereference the dossier as a route.
 * The exact-area resource owns the canonical `include=dossier` interface.
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
	const result = areaDossier(
		context,
		{ geography, boundaryRelease, code },
		(candidateRelease) =>
			`/v1/areas/${geography}/${candidateRelease}/${code}/dossier`,
	);
	if ("response" in result) return result.response;
	const area = context.geographyResolver.area({
		geography,
		boundaryRelease,
		code,
	});
	if (!area) return areaNotFound(context, geography, boundaryRelease, code);
	return {
		status: 200,
		body: envelope(releaseId, {
			id: areaKey(geography, boundaryRelease, code),
			geography,
			boundaryRelease,
			...area,
			...result.dossier,
		}),
	};
};
