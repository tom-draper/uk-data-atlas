import {
	envelope,
	problem,
	type ApiResponse,
} from "@uk-data-atlas/atlas-runtime/api";
import type { RouteRequestFor } from "@uk-data-atlas/atlas-runtime/api";
import { searchMeasures } from "./measureTerms";
import {
	dimensionCatalogue,
	identityDimensions,
} from "@uk-data-atlas/atlas-runtime/catalogue";
import {
	describeMeasure,
	searchDimensionalMeasures,
} from "../dimensions/measureDiscovery";

/** Dataset and measure metadata discovery, separate from analytical operations. */
export const handleCatalogueRoutes = ({
	context,
	releaseId,
	parsedUrl,
	segments,
}: RouteRequestFor<never>): ApiResponse | undefined => {
	const { dataCatalog } = context;
	const withEvidence = <T extends { id: string }>(measure: T) =>
		context.documents?.has(`measure-${measure.id}`)
			? {
					...measure,
					documents: {
						evidence: `/v1/documents/measure-${measure.id}.json`,
					},
				}
			: measure;
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
	// Measures with their dimensions, where the mapping is loaded.
	const dimensional = dataCatalog
		? dimensionCatalogue(
				dataCatalog,
				context.measureDimensions ?? identityDimensions(dataCatalog),
			)
		: undefined;
	if (dimensional && segments[1] === "measures" && segments.length === 2) {
		const query = parsedUrl.searchParams.get("q");
		return {
			status: 200,
			body: envelope(
				releaseId,
				query === null
					? dimensional.measures.map((measure) =>
							describeMeasure(measure, context.documents),
						)
					: searchDimensionalMeasures(
							dataCatalog!,
							dimensional,
							query,
						).map(({ measure, members }) => ({
							...describeMeasure(measure, context.documents),
							...(members.length > 0
								? { matchedMembers: members }
								: {}),
						})),
			),
		};
	}
	if (dimensional && segments[1] === "measures" && segments.length === 3) {
		const term = segments[2]!;
		const named = dimensional.measure(term);
		const aliased = named ? undefined : dimensional.series(term);
		const measure = named ?? aliased?.measure;
		if (!measure)
			return problem(
				404,
				"Not Found",
				"No published measure matches that id.",
			);
		if (aliased && aliased.series.catalogueMeasure.id !== measure.id)
			return problem(
				404,
				"Not Found",
				"No published measure matches that id.",
			);
		return {
			status: 200,
			body: envelope(
				releaseId,
				describeMeasure(measure, context.documents),
			),
		};
	}
	if (segments[1] === "measures" && segments.length === 2) {
		// A search never picks one: it lists every match, best first, and an
		// empty list is an answer, not a refusal.
		const query = parsedUrl.searchParams.get("q");
		return dataCatalog
			? {
					status: 200,
					body: envelope(
						releaseId,
						query === null
							? dataCatalog.measures.map(withEvidence)
							: searchMeasures(dataCatalog, query).map(
									withEvidence,
								),
					),
				}
			: problem(
					503,
					"Catalogue Unavailable",
					"Build the data catalogue before listing measures.",
				);
	}
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
			? { status: 200, body: envelope(releaseId, withEvidence(measure)) }
			: problem(
					404,
					"Not Found",
					"No published measure matches that id.",
				);
	}
	return undefined;
};
