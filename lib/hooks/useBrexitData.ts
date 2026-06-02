import { BrexitLADDataset } from "@lib/types";
import { withCDN } from "../helpers/cdn";
import { useJsonDataLoader } from "./useJsonDataLoader";

export const useBrexitData = (enabled = true) =>
	useJsonDataLoader<BrexitLADDataset>(withCDN("/data/precompiled/brexit.json"), enabled);
