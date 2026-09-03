import { loadAirQuality } from "../../air-quality/loader";
import type { AirQualityDataset } from "@/lib/types/airQuality";
import type { DatasetDefinition } from "../types";

export const airQualityDatasetDefinition: DatasetDefinition<AirQualityDataset> = {
	type: "airQuality", precompiledFile: "air-quality", boundaryType: "localAuthority",
	source: { name: "Air Quality", source: "Department for Environment, Food and Rural Affairs", sourceUrl: "https://www.gov.uk/government/statistics/air-quality-statistics", year: "2022", licence: "Open Government Licence v3.0", licenceUrl: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/", description: "Annual mean concentrations of nitrogen dioxide (NO2) by local authority district." },
	precompile: ({ text }) => loadAirQuality(text),
};
