import { loadAirQuality } from "../../air-quality/loader";
import type { AirQualityDataset } from "@/lib/types/airQuality";
import type { DatasetDefinition } from "../types";

export const airQualityDatasetDefinition: DatasetDefinition<AirQualityDataset> =
	{
		type: "airQuality",
		precompiledFile: "air-quality",
		boundaryType: "localAuthority",
		source: {
			name: "Air Quality",
			source: "Department for Environment, Food and Rural Affairs",
			sourceUrl: "https://uk-air.defra.gov.uk/data/pcm-data",
			year: "2024",
			licence: "Open Government Licence v3.0",
			licenceUrl:
				"http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/",
			description:
				"Modelled 2024 annual mean background NO2, PM10 and PM2.5 by local authority, averaged from Defra's 1x1 km PCM maps, with Defra's population-weighted PM2.5.",
		},
		precompile: ({ text }) => loadAirQuality(text),
	};
