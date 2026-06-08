import { UnemploymentDataset } from "../types/unemployment";
import { withCDN } from "../helpers/cdn";
import { useJsonDataLoader } from "./useJsonDataLoader";

export const useUnemploymentData = (enabled = true) =>
	useJsonDataLoader<UnemploymentDataset>(withCDN("/data/precompiled/unemployment.json"), enabled);
