import { EthnicityDataset } from "../types/ethnicity";
import { withCDN } from "../helpers/cdn";
import { useJsonDataLoader } from "./useJsonDataLoader";

export const useEthnicityData = (enabled = true) =>
	useJsonDataLoader<EthnicityDataset>(withCDN("/data/precompiled/ethnicity.json"), enabled);
