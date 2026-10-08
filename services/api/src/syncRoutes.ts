import {
	envelope,
	invalidQuery,
	problem,
	type ApiResponse,
} from "./routeResponse";
import type { RouteRequest } from "./routing";

/**
 * Current-release provenance and validation routes. The release manifest
 * identifies the artifacts served by this build; the API does not retain
 * historical releases or their artifacts.
 */
export const handleSyncRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	const { atlasRelease, validationReport } = context;

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
			return invalidQuery("status must be passed or waived.");
		}
		const scope = parsedUrl.searchParams.get("scope");
		if (scope !== null && scope !== "data") {
			return invalidQuery("scope must be data when supplied.");
		}
		const { resources, ...report } = validationReport;
		const filtered = resources.filter(
			(resource) =>
				(status === null || resource.status === status) &&
				(scope !== "data" || resource.kind === "measure-source"),
		);
		if (scope === "data") {
			const checks = filtered.flatMap((resource) => resource.checks);
			return {
				status: 200,
				body: envelope(releaseId, {
					schemaVersion: report.schemaVersion,
					contentHash: report.contentHash,
					inputs: report.inputs,
					scope: "data",
					summary: {
						resourceCount: filtered.length,
						checkCount: checks.length,
						passedCount: checks.filter(
							(entry) => entry.status === "passed",
						).length,
						waivedCount: checks.filter(
							(entry) => entry.status === "waived",
						).length,
					},
					resources: filtered,
					note: "This is the source-observation quality audit. It checks artifact integrity, duplicate area-period records, area-code resolution, declared country coverage, value semantics and published intervals. An unwaived failure prevents publication; any waiver remains visible here.",
				}),
			};
		}
		return {
			status: 200,
			body: envelope(releaseId, {
				...report,
				resources: filtered,
			}),
		};
	}

	return undefined;
};
