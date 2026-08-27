import { withCDN } from "../helpers/cdn";
import { FuelPovertyDataset } from "../types/fuelPoverty";
import { useJsonDataLoader } from "./useJsonDataLoader";

export const useFuelPovertyData = (enabled = true) =>
	useJsonDataLoader<FuelPovertyDataset>(withCDN("/data/precompiled/fuel-poverty.json"), enabled);
