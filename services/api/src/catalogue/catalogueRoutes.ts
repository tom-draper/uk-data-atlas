import { envelope, problem, type ApiResponse } from "../runtime/index.ts";
import type { RouteRequestFor } from "../runtime/index.ts";
import { retiredMeasure } from "../dimensions/retiredMeasure";
import { searchMeasures } from "./measureTerms";
import {
	dimensionCatalogue,
	identityDimensions,
} from "@uk-data-atlas/measures";
import {
	describeMeasure,
	searchDimensionalMeasures,
} from "../dimensions/measureDiscovery";
import {
	isTaxonomyQuery,
	matchesTaxonomy,
	readTaxonomyQuery,
	taxonomyOfDataset,
	taxonomyOfMeasure,
	withTaxonomy,
	type TaxonomyQuery,
} from "./datasetTaxonomy";
import { describeModules, describeThemes } from "./themesAndModules";

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
	const withTheme = <T extends { sources: Array<{ datasetId: string }> }>(
		measure: T,
	) => withTaxonomy(measure, taxonomyOfMeasure(measure));
	const inTaxonomy = (
		measure: { sources: Array<{ datasetId: string }> },
		query: TaxonomyQuery,
	) => matchesTaxonomy(taxonomyOfMeasure(measure), query);
	if (segments[0] !== "v1") return undefined;
	if (
		(segments[1] === "themes" || segments[1] === "modules") &&
		segments.length === 2
	) {
		// The dataset counts come from the catalogue, so without one they
		// would read as zero rather than as unknown.
		if (!dataCatalog)
			return problem(
				503,
				"Catalogue Unavailable",
				`Build the data catalogue before listing ${segments[1]}.`,
			);
		const describe =
			segments[1] === "themes" ? describeThemes : describeModules;
		return {
			status: 200,
			body: envelope(releaseId, describe(dataCatalog.datasets)),
		};
	}
	if (segments[1] === "datasets" && segments.length === 2) {
		if (!dataCatalog)
			return problem(
				503,
				"Catalogue Unavailable",
				"Build the data catalogue before listing datasets.",
			);
		const query = readTaxonomyQuery(parsedUrl.searchParams);
		if (!isTaxonomyQuery(query)) return query;
		return {
			status: 200,
			body: envelope(
				releaseId,
				dataCatalog.datasets
					.filter((dataset) =>
						matchesTaxonomy(taxonomyOfDataset(dataset.id), query),
					)
					.map((dataset) =>
						withTaxonomy(dataset, taxonomyOfDataset(dataset.id)),
					),
			),
		};
	}
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
			? {
					status: 200,
					body: envelope(
						releaseId,
						withTaxonomy(dataset, taxonomyOfDataset(dataset.id)),
					),
				}
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
		const taxonomy = readTaxonomyQuery(parsedUrl.searchParams);
		if (!isTaxonomyQuery(taxonomy)) return taxonomy;
		return {
			status: 200,
			body: envelope(
				releaseId,
				(query === null
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
						}))
				)
					.filter((measure) => inTaxonomy(measure, taxonomy))
					.map(withTheme),
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
		if (aliased && aliased.series.id !== measure.id)
			return retiredMeasure(term, measure, aliased.series);
		return {
			status: 200,
			body: envelope(
				releaseId,
				withTheme(describeMeasure(measure, context.documents)),
			),
		};
	}
	if (segments[1] === "measures" && segments.length === 2) {
		// A search never picks one: it lists every match, best first, and an
		// empty list is an answer, not a refusal.
		const query = parsedUrl.searchParams.get("q");
		const taxonomy = readTaxonomyQuery(parsedUrl.searchParams);
		if (!isTaxonomyQuery(taxonomy)) return taxonomy;
		return dataCatalog
			? {
					status: 200,
					body: envelope(
						releaseId,
						(query === null
							? dataCatalog.measures.map(withEvidence)
							: searchMeasures(dataCatalog, query).map(
									withEvidence,
								)
						)
							.filter((measure) => inTaxonomy(measure, taxonomy))
							.map(withTheme),
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
			? {
					status: 200,
					body: envelope(releaseId, withTheme(withEvidence(measure))),
				}
			: problem(
					404,
					"Not Found",
					"No published measure matches that id.",
				);
	}
	return undefined;
};
