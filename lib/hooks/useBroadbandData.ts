import { BroadbandDataset } from "../types/broadband";
import { withCDN } from "../helpers/cdn";
import { useJsonDataLoader } from "./useJsonDataLoader";

export const useBroadbandData = (enabled = true) =>
	useJsonDataLoader<BroadbandDataset>(withCDN("/data/precompiled/broadband.json"), enabled);
