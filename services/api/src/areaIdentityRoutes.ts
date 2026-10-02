import { areaNotFound } from "./areaResources";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";
import { areaKey } from "./geographyKeys";
import { areaDossier } from "./areaDossierRoutes";

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
		(include) => include !== "dossier",
	);
	if (unsupportedIncludes.length > 0)
		return problem(
			400,
			"Invalid Include",
			"The area resource supports `include=dossier`.",
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
			}),
		};
	}
	return areaNotFound(context, geography, boundaryRelease, code);
};
