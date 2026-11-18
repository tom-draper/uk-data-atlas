import { DATASET_DECLARATIONS, definitionOf } from "@uk-data-atlas/datasets";
import type {
	CatalogueDataset,
	DatasetDeclaration,
	DisplayCategories,
} from "@uk-data-atlas/datasets";
import { aggregateCategories } from "@/lib/helpers/datasetAggregation/demographics";
import { createBoundaryAggregationSpec } from "@/lib/helpers/datasetAggregation/ports";
import { renderCategories } from "@/lib/helpers/mapRendering";
import type { CategoryRecords } from "@/lib/helpers/mapManager/featureBuilder";
import type {
	CategoryDatasetId,
	CategoryOptions,
	ColorRangeOption,
} from "@/lib/types/mapOptions";
import type { ChartDatasetDefinition } from "./types";

/**
 * The website's reading of `categories`: a dataset whose areas are coloured by
 * their largest group. Its chart, legend, map and options come from the
 * declaration, so a dataset that fits needs no website code of its own.
 */

type Categorised = DatasetDeclaration & { categories: DisplayCategories };

const categorised = DATASET_DECLARATIONS.filter(
	(declaration): declaration is Categorised =>
		declaration.categories !== undefined,
);

/** The datasets mapped by their largest group. */
export const CATEGORY_DATASET_TYPES = categorised.map(
	({ id }) => id,
) as readonly CategoryDatasetId[];

/** A dataset's categories, or undefined for any other. */
export const declaredCategories = (
	type: string,
): DisplayCategories | undefined =>
	categorised.find(({ id }) => id === type)?.categories;

/** Whether a dataset type is mapped by its largest group. */
export const isCategoryDataset = (type: string): type is CategoryDatasetId =>
	categorised.some(({ id }) => id === type);

/** A dataset's group colours, grey for a group it names none for. */
export const categoryColor = (type: string, name: string) =>
	declaredCategories(type)?.colors[name] ?? "#cccccc";

/** The initial map options of every categorical dataset, by dataset. */
export const declaredCategoryOptions = () => {
	const initial: CategoryOptions & ColorRangeOption = {
		mode: "majority",
		percentageRange: { min: 0, max: 50 },
		colorRange: { min: 0, max: 1 },
	};
	return Object.fromEntries(
		categorised.map(({ id }) => [id, { ...initial }]),
	) as Record<CategoryDatasetId, CategoryOptions & ColorRangeOption>;
};

/** A categorical dataset's key as a chart card, in its theme like any declared card. */
export const categoryChartKey = (declaration: Categorised) =>
	`population-${declaration.id}`;

const chartDefinitionOf = (
	declaration: Categorised,
): ChartDatasetDefinition => {
	const { categories, boundary } = declaration;
	const { breakdown } = categories;
	const aggregation = createBoundaryAggregationSpec(
		declaration.id,
		boundary.type,
		aggregateCategories,
	);
	const calculateStats: ChartDatasetDefinition["chart"]["calculateStats"] = (
		aggregator,
		geojson,
		data,
		location,
		datasetId,
	) =>
		aggregator.aggregate(
			aggregation,
			geojson,
			data as never,
			location,
			datasetId,
		);
	return {
		...definitionOf(declaration),
		chart: {
			topic: declaration.topic,
			key: categoryChartKey(declaration),
			label: categories.label,
			componentPath: "@/components/measures/MeasureBreakdownChart",
			breakdown: {
				request: {
					measure: breakdown.measure,
					datasetId: declaration.id,
					geography: boundary.type,
					boundaryYear: boundary.year,
				},
				dimension: breakdown.dimension,
				total: breakdown.total,
				parts: breakdown.parts,
				accent: breakdown.accent,
				order: breakdown.order,
				legendFilter: true,
				heading: breakdown.heading,
				period: breakdown.period,
				source: breakdown.source,
				coverage: breakdown.coverage,
			},
			calculateStats,
			year: categories.year,
		},
		legendAggregation: { calculateStats },
		legendKind: "category",
		mapRenderer: {
			getOptions: (_activeViz, mapOptions) =>
				mapOptions[declaration.id as CategoryDatasetId],
			render: ({ map, geojson, dataset, mapOptions, isDark }) =>
				renderCategories(
					map,
					geojson,
					dataset as unknown as CategoryRecords,
					{ colors: categories.colors, boundary: boundary.type },
					mapOptions,
					isDark,
				),
		},
	};
};

/** The chart definition of every dataset mapped by its largest group. */
export const CATEGORY_CHART_DEFINITIONS: readonly ChartDatasetDefinition<CatalogueDataset>[] =
	categorised.map(
		(declaration) =>
			chartDefinitionOf(
				declaration,
			) as unknown as ChartDatasetDefinition<CatalogueDataset>,
	);
