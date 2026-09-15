import { attributionFor, attributionText } from "./attribution";
import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routes";

/** Governance and evidence endpoints, separate from the data they describe. */
export const handleGovernanceRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	const {
		boundaryRegistry,
		crosswalkInventory,
		dataCatalog,
		relationshipCandidateInventory,
	} = context;

	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "attribution"
	) {
		if (!dataCatalog || !crosswalkInventory) {
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the data catalogue and crosswalk inventory before generating attribution.",
			);
		}
		const request = {
			datasets: parsedUrl.searchParams.getAll("dataset"),
			measures: parsedUrl.searchParams.getAll("measure"),
			boundaryReleases: parsedUrl.searchParams.getAll("boundaryRelease"),
			crosswalks: parsedUrl.searchParams.getAll("crosswalk"),
		};
		if (Object.values(request).every((values) => values.length === 0)) {
			return problem(
				400,
				"Invalid Query",
				"Name at least one resource to attribute, as dataset, measure, boundaryRelease or crosswalk. Each may be repeated.",
			);
		}
		const attribution = attributionFor(
			request,
			dataCatalog,
			boundaryRegistry,
			crosswalkInventory,
		);
		if (attribution.status === "unknown") {
			return problem(
				404,
				"Not Found",
				`No published resource matches ${attribution.unknownResources.join(", ")}.`,
			);
		}
		return {
			status: 200,
			body: envelope(releaseId, {
				atlasRelease: { id: releaseId, href: "/v1/atlas-release" },
				resources: attribution.resources,
				licences: attribution.licences,
				text: attributionText(
					attribution.resources,
					attribution.licences,
					releaseId,
				),
				note: "Licence names are reproduced as the publisher states them and are not interpreted here. Where several apply, check each before reusing the combined work.",
			}),
		};
	}

	if (
		segments.length === 2 &&
		segments[0] === "v1" &&
		segments[1] === "relationship-candidates"
	) {
		return relationshipCandidateInventory
			? {
					status: 200,
					body: envelope(
						releaseId,
						relationshipCandidateInventory.candidates,
					),
				}
			: problem(
					503,
					"Catalogue Unavailable",
					"Build the relationship candidate inventory before starting the API.",
				);
	}

	return undefined;
};
