import { renderEthnicity } from "@/lib/helpers/mapRendering";
import { ethnicityAggregation } from "@/lib/helpers/datasetAggregation/specifications";
import { ETHNICITY_COLORS } from "@/lib/helpers/colorScale/ethnicityColors";
import {
	definitionOf,
	ethnicity,
	ETHNICITY_CODES,
} from "@uk-data-atlas/datasets";
import type { EthnicityDataset } from "@uk-data-atlas/datasets";
import type { ChartDatasetDefinition, ChartDefinition } from "./types";

const calculateStats: ChartDefinition<EthnicityDataset>["calculateStats"] = (
	mapManager,
	geojson,
	data,
	location,
	datasetId,
) =>
	mapManager.aggregate(
		ethnicityAggregation,
		geojson,
		data,
		location,
		datasetId,
	);

/** Every ethnic group, by the census's code for it, in its own colour. */
const parts = Object.entries(ETHNICITY_CODES).map(([name, code]) => ({
	code,
	label: name,
	color: ETHNICITY_COLORS[name] ?? "#6b7280",
}));

export const ethnicityDefinition: ChartDatasetDefinition<EthnicityDataset> = {
	...definitionOf(ethnicity),
	chart: {
		topic: "ethnicity-and-identity",
		key: "demographics-ethnicity",
		label: "Ethnicity [2021]",
		componentPath: "@/components/measures/MeasureBreakdownChart",
		breakdown: {
			request: {
				measure: "usual-residents",
				datasetId: ethnicity.id,
				geography: ethnicity.boundary.type,
				boundaryYear: ethnicity.boundary.year,
			},
			dimension: "ethnic-group",
			parts,
			order: "largest",
			legendFilter: "ethnicity",
			heading: "Ethnicity",
			period: "2021",
			source: "Office for National Statistics. Census 2021: Ethnic Group, England and Wales. ons.gov.uk",
		},
		calculateStats,
		year: 2021,
	},
	legendAggregation: { calculateStats },
	legendKind: "ethnicity",
	mapRenderer: {
		getOptions: (_activeViz, mapOptions) => mapOptions.ethnicity,
		render: ({ map, geojson, dataset, mapOptions, isDark }) =>
			renderEthnicity(map, geojson, dataset, mapOptions, isDark),
	},
};
