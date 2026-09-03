import { loadPopulation } from "../../population/loader";
import type { PopulationDataset } from "@/lib/types/population";
import type { DatasetDefinition } from "../types";

export const populationDatasetDefinition: DatasetDefinition<PopulationDataset> = {
	type: "population",
	precompiledFile: "population",
	source: {
		name: "Population",
		source: "Office for National Statistics",
		sourceUrl: "https://www.ons.gov.uk/",
		year: "2022",
		licence: "Open Government Licence v3.0",
		licenceUrl: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
		description: "Ward population estimates.",
	},
	precompile: async ({ text }) => loadPopulation(text),
};
