import type { RelationshipPurpose } from "./relationshipPaths";
import type { RouteRequest } from "./routing";
import { envelope, problem, type ApiResponse } from "./routeResponse";

const PURPOSES: RelationshipPurpose[] = [
	"identity",
	"membership",
	"apportion",
];

/**
 * Translate one code through the resolver's published conversion graph. A
 * direct path retains the original crosswalk record shape; composed paths
 * name every step rather than presenting a derived target as a direct lookup.
 */
export const handleTranslationRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 2 ||
		segments[0] !== "v1" ||
		segments[1] !== "translations"
	)
		return undefined;
	const geographyResolver = context.geographyResolver;
	const source = {
		geography: parsedUrl.searchParams.get("sourceGeography"),
		boundaryRelease: parsedUrl.searchParams.get("sourceRelease"),
		code: parsedUrl.searchParams.get("code"),
	};
	const target = {
		geography: parsedUrl.searchParams.get("targetGeography"),
		boundaryRelease: parsedUrl.searchParams.get("targetRelease"),
	};
	const purpose = parsedUrl.searchParams.get("purpose") ?? "membership";
	if (
		!source.geography ||
		!source.boundaryRelease ||
		!source.code ||
		!target.geography ||
		!target.boundaryRelease ||
		!PURPOSES.includes(purpose as RelationshipPurpose)
	) {
		return problem(
			400,
			"Invalid Query",
			"sourceGeography, sourceRelease, code, targetGeography and targetRelease are required; purpose must be identity, membership or apportion.",
		);
	}
	const resolvedSource = source as {
		geography: string;
		boundaryRelease: string;
		code: string;
	};
	const resolvedTarget = target as {
		geography: string;
		boundaryRelease: string;
	};
	const translations = geographyResolver.translateArea(
		resolvedSource,
		resolvedTarget,
		purpose as RelationshipPurpose,
	);
	return translations.length > 0
		? {
				status: 200,
				body: envelope(releaseId, {
					source,
					target,
					purpose,
					paths: translations.map(({ path }) => path),
					matches: translations.map(({ path, ...translation }) => {
						if (path.steps.length !== 1)
							return { path, ...translation };
						const step = path.steps[0]!;
						const crosswalk = geographyResolver.crosswalk(step.crosswalkId);
						if (!crosswalk) return { path, ...translation };
						return {
							crosswalk: {
								id: crosswalk.id,
								method: crosswalk.method,
								quality: crosswalk.quality,
								weighting: crosswalk.weighting,
								provenance: crosswalk.provenance,
								direction: step.direction,
							},
							...translation,
						};
					}),
				}),
			}
		: problem(
				422,
				"Conversion Unavailable",
				"No published conversion path supports this source, target and purpose. Same codes across releases are not treated as proof of geographic identity.",
			);
};
