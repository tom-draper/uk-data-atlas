import type { RelationshipPurpose } from "./relationshipPaths";
import { parseExactReleaseReference } from "./releaseForDate";
import type { RouteRequest } from "./routing";
import {
	envelope,
	invalidQuery,
	problem,
	type ApiResponse,
} from "./routeResponse";

const PURPOSES: RelationshipPurpose[] = ["identity", "membership", "apportion"];

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
	const from = parseExactReleaseReference(parsedUrl.searchParams.get("from"));
	const to = parseExactReleaseReference(parsedUrl.searchParams.get("to"));
	const code = parsedUrl.searchParams.get("code");
	const purpose = parsedUrl.searchParams.get("purpose") ?? "membership";
	if (
		!from ||
		!code ||
		!to ||
		!PURPOSES.includes(purpose as RelationshipPurpose)
	) {
		return invalidQuery(
			"from, code and to are required. from and to are exact geography/release references; purpose must be identity, membership or apportion.",
		);
	}
	const source = { ...from, code };
	const target = to;
	const resolvedSource = source;
	const resolvedTarget = target;
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
						const crosswalk = geographyResolver.crosswalk(
							step.crosswalkId,
						);
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
