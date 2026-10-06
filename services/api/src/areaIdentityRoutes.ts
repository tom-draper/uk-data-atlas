import { areaNotFound } from "./areaResources";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";
import { areaKey } from "./geographyKeys";
import { areaDossier } from "./areaDossierRoutes";
import { areaCapabilities } from "./areaCapabilityRoutes";
import { areaCitation } from "./areaCitationRoutes";
import { areaGeometryMetrics } from "./areaGeometryMetadataRoutes";

/** What the area resource expands to on request. */
const AREA_INCLUDES = ["dossier", "capabilities", "citation", "metrics"];

/** One compiled area identity in one explicit geography release. */
export const handleAreaIdentityRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	if (
		segments.length !== 5 ||
		segments[0] !== "v1" ||
		segments[1] !== "areas"
	)
		return undefined;
	const [geography, boundaryRelease, code] = segments.slice(2);
	if (!geography || !boundaryRelease || !code)
		return problem(400, "Invalid Path", "An area identity is incomplete.");
	const geographyResolver = context.geographyResolver;
	const includes = new Set(
		parsedUrl.searchParams
			.getAll("include")
			.flatMap((value) => value.split(","))
			.map((value) => value.trim())
			.filter(Boolean),
	);
	const unsupportedIncludes = [...includes].filter(
		(include) => !AREA_INCLUDES.includes(include),
	);
	if (unsupportedIncludes.length > 0)
		return problem(
			400,
			"Invalid Include",
			`The area resource supports ${AREA_INCLUDES.map((include) => `\`include=${include}\``).join(", ")}.`,
		);
	// Naming what to cite only means something to a citation.
	if (
		!includes.has("citation") &&
		(parsedUrl.searchParams.has("measure") ||
			parsedUrl.searchParams.has("crosswalk"))
	)
		return problem(
			400,
			"Invalid Parameter",
			"`measure` and `crosswalk` name what to cite, so they need `include=citation`.",
		);
	const area = geographyResolver.area({
		geography,
		boundaryRelease,
		code,
	});
	if (area) {
		const dossier = includes.has("dossier")
			? areaDossier(
					context,
					{ geography, boundaryRelease, code },
					(candidateRelease) =>
						`/v1/areas/${geography}/${candidateRelease}/${code}?include=dossier`,
				)
			: undefined;
		if (dossier && "response" in dossier) return dossier.response;
		const identity = { geography, boundaryRelease, code };
		const citation = includes.has("citation")
			? areaCitation(context, releaseId, identity, parsedUrl.searchParams)
			: undefined;
		if (citation && "response" in citation) return citation.response;
		const metrics = includes.has("metrics")
			? areaGeometryMetrics(context, identity)
			: undefined;
		if (metrics && "response" in metrics) return metrics.response;
		const postcodes = geographyResolver.postcodeCounts({
			geography,
			boundaryRelease,
			code: area.code,
		});
		return {
			status: 200,
			body: envelope(releaseId, {
				id: areaKey(geography, boundaryRelease, area.code),
				geography,
				boundaryRelease,
				...area,
				...(postcodes ? { postcodes } : {}),
				...(dossier ? { dossier: dossier.dossier } : {}),
				...(includes.has("capabilities")
					? { capabilities: areaCapabilities(context, identity) }
					: {}),
				...(citation ? { citation: citation.citation } : {}),
				...(metrics ? { metrics: metrics.metrics } : {}),
			}),
		};
	}
	return areaNotFound(context, geography, boundaryRelease, code);
};
