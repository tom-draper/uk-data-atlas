import { loadAirQuality } from "@/lib/data/air-quality/loader";
import type { AirQualityDataset } from "@/lib/types/airQuality";
import type { ScalarDatasetDefinition } from "./types";

export const airQualityDefinition: ScalarDatasetDefinition<AirQualityDataset> = {
	type: "airQuality", precompiledFile: "air-quality",
	chart: { group: "Environment", key: "environment-airQuality", label: "Air Quality - NO₂ [2022]", defaultVisible: true, componentPath: "@/components/environment/air-quality/AirQualityChart", boundaryType: "localAuthority", calculateStats: (m, g, d, l, id) => m.calculateAirQualityStats(g, d, l, id), year: 2022 },
	source: { name: "Air Quality", source: "Department for Environment, Food and Rural Affairs", sourceUrl: "https://www.gov.uk/government/statistics/air-quality-statistics", year: "2022", licence: "Open Government Licence v3.0", licenceUrl: "http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/", description: "Annual mean concentrations of nitrogen dioxide (NO2) by local authority district." },
	map: { valueKey: "no2Mean", colorRange: { min: 5, max: 35 }, legend: { min: 0, max: 60, format: (v) => `${v.toFixed(0)} µg/m³ NO₂` } },
	precompile: ({ text }) => loadAirQuality(text),
};
