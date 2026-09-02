import { loadUnemployment } from "@/lib/data/unemployment/loader";
import type { UnemploymentDataset } from "@/lib/types/unemployment";
import type { ChartDatasetDefinition } from "./types";

export const unemploymentDefinition: ChartDatasetDefinition<UnemploymentDataset> = {
	type: "unemployment",
	precompiledFile: "unemployment",
	chart: {
		group: "Economics",
		key: "economics-unemployment",
		label: "Unemployment Rate [2021]",
		defaultVisible: true,
		componentPath: "@/components/economics/unemployment/UnemploymentChart",
		boundaryType: "localAuthority",
		calculateStats: (mapManager, geojson, data, location, datasetId, dataset) =>
			dataset ? mapManager.calculateUnemploymentStats(geojson, dataset, location, datasetId) : null,
		year: 2021,
	},
	source: {
		name: "Unemployment",
		source: "Office for National Statistics",
		sourceUrl: "https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/datasets/modelledunemploymentforlocalandunitaryauthoritiesm01/current",
		year: "2021",
		licence: "Open Government Licence v3.0",
		licenceUrl: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description: "Model-based unemployment rate estimates by local authority for Great Britain.",
	},
	map: {
		valueFor: (dataset, code) => dataset.data[code]?.rates[dataset.latestYear] ?? null,
		colorRange: { min: 0, max: 15 },
		legend: { min: 0, max: 15, format: (value) => `${value.toFixed(1)}% unemployed` },
	},
	precompile: async ({ text }) => loadUnemployment(text),
};
