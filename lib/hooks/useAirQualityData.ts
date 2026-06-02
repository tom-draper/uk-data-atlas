import { AirQualityDataset } from "../types/airQuality";
import { withCDN } from "../helpers/cdn";
import { useJsonDataLoader } from "./useJsonDataLoader";

export const useAirQualityData = (enabled = true) =>
	useJsonDataLoader<AirQualityDataset>(withCDN("/data/precompiled/air-quality.json"), enabled);
