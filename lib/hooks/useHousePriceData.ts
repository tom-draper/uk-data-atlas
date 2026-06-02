import { HousePriceDataset } from "../types/housePrice";
import { withCDN } from "../helpers/cdn";
import { useJsonDataLoader } from "./useJsonDataLoader";

export const useHousePriceData = (enabled = true) =>
	useJsonDataLoader<HousePriceDataset>(withCDN("/data/precompiled/house-price.json"), enabled);
