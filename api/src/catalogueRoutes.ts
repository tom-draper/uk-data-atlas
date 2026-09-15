import { envelope, problem, type ApiResponse } from "./routeResponse";
import type { RouteRequest } from "./routing";

/** Dataset and measure metadata discovery, separate from analytical operations. */
export const handleCatalogueRoutes = ({
	context,
	releaseId,
	segments,
}: RouteRequest): ApiResponse | undefined => {
	const { dataCatalog } = context;
	if (segments[0] !== "v1") return undefined;
	if (segments[1] === "datasets" && segments.length === 2)
		return dataCatalog
			? { status: 200, body: envelope(releaseId, dataCatalog.datasets) }
			: problem(
					503,
					"Catalogue Unavailable",
					"Build the data catalogue before listing datasets.",
				);
	if (segments[1] === "datasets" && segments.length === 3) {
		if (!dataCatalog)
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the data catalogue before retrieving datasets.",
			);
		const dataset = dataCatalog.datasets.find(
			(candidate) => candidate.id === segments[2],
		);
		return dataset
			? { status: 200, body: envelope(releaseId, dataset) }
			: problem(
					404,
					"Not Found",
					"No published dataset matches that id.",
				);
	}
	if (segments[1] === "measures" && segments.length === 2)
		return dataCatalog
			? { status: 200, body: envelope(releaseId, dataCatalog.measures) }
			: problem(
					503,
					"Catalogue Unavailable",
					"Build the data catalogue before listing measures.",
				);
	if (segments[1] === "measures" && segments.length === 3) {
		if (!dataCatalog)
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the data catalogue before retrieving measures.",
			);
		const measure = dataCatalog.measures.find(
			(candidate) => candidate.id === segments[2],
		);
		return measure
			? { status: 200, body: envelope(releaseId, measure) }
			: problem(
					404,
					"Not Found",
					"No published measure matches that id.",
				);
	}
	return undefined;
};
