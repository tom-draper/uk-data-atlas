import { compareAtlasReleases } from "./atlasReleaseComparison";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routes";

/**
 * Endpoints that let a caller synchronise an immutable Atlas release or
 * inspect the validation gate that admitted it. Keeping them together means
 * new map and data capabilities do not need to touch this independent API
 * surface.
 */
export const handleSyncRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	const { atlasRelease, atlasReleaseHistory, validationReport } = context;

	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "atlas-releases"
	) {
		return atlasReleaseHistory
			? {
					status: 200,
					body: envelope(
						releaseId,
						[...atlasReleaseHistory.values()]
							.map((release) => ({
								releaseId: release.releaseId,
								href: `/v1/atlas-releases/${release.releaseId}`,
								artifactCount: release.artifacts.length,
								current: release.releaseId === releaseId,
							}))
							.sort((left, right) =>
								left.releaseId.localeCompare(right.releaseId),
							),
					),
				}
			: problem(
					503,
					"Catalogue Unavailable",
					"Build the atlas release history before listing releases.",
				);
	}

	if (
		segments.length === 3 &&
		segments[0] === "v1" &&
		segments[1] === "atlas-releases" &&
		segments[2] === "compare"
	) {
		if (!atlasReleaseHistory) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the atlas release history before comparing releases.",
			);
		}
		const fromId = parsedUrl.searchParams.get("from");
		const toId = parsedUrl.searchParams.get("to") ?? releaseId;
		if (!fromId) {
			return problem(
				400,
				"Invalid Query",
				"from is required; to defaults to the current Atlas release.",
			);
		}
		const from = atlasReleaseHistory.get(fromId);
		const to = atlasReleaseHistory.get(toId);
		if (!from || !to) {
			return problem(
				404,
				"Not Found",
				"One or both requested Atlas releases are not archived by this API instance.",
			);
		}
		return {
			status: 200,
			body: envelope(releaseId, compareAtlasReleases(from, to)),
		};
	}

	if (
		segments.length === 3 &&
		segments[0] === "v1" &&
		segments[1] === "atlas-releases"
	) {
		const requested = atlasReleaseHistory?.get(segments[2] as string);
		return requested
			? { status: 200, body: envelope(releaseId, requested) }
			: problem(
					404,
					"Not Found",
					"No archived Atlas release matches that identity.",
				);
	}

	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "atlas-release"
	) {
		return atlasRelease
			? { status: 200, body: envelope(releaseId, atlasRelease) }
			: problem(
					503,
					"Catalogue Unavailable",
					"Build the atlas release manifest before starting the API.",
				);
	}

	const isValidationResource =
		segments[0] === "v1" &&
		segments[1] === "validation" &&
		((segments[2] === "boundary-releases" && segments.length === 5) ||
			(segments.length === 4 &&
				["crosswalks", "measures", "exports"].includes(
					segments[2] ?? "",
				)));
	if (
		(segments.length === 2 &&
			segments[0] === "v1" &&
			segments[1] === "validation") ||
		isValidationResource
	) {
		if (!validationReport) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the validation report before starting the API.",
			);
		}
		if (isValidationResource) {
			const id = segments.slice(2).join("/");
			const resource = validationReport.resources.find(
				(candidate) => candidate.id === id,
			);
			return resource
				? { status: 200, body: envelope(releaseId, resource) }
				: problem(
						404,
						"Not Found",
						"No validated resource matches that identity.",
					);
		}
		const status = parsedUrl.searchParams.get("status");
		if (status !== null && status !== "passed" && status !== "waived") {
			return problem(
				400,
				"Invalid Query",
				"status must be passed or waived.",
			);
		}
		const { resources, ...report } = validationReport;
		return {
			status: 200,
			body: envelope(releaseId, {
				...report,
				resources:
					status === null
						? resources
						: resources.filter(
								(resource) => resource.status === status,
							),
			}),
		};
	}

	return undefined;
};
