import { NHSWaitingDataset } from "../types/nhsWaiting";
import { withCDN } from "../helpers/cdn";
import { useJsonDataLoader } from "./useJsonDataLoader";

export const useNHSWaitingData = (enabled = true) =>
	useJsonDataLoader<NHSWaitingDataset>(withCDN("/data/precompiled/nhs-waiting.json"), enabled);
