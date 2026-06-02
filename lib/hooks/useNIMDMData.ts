import { NIMDMDataset } from "@/lib/types/nimdm";
import { withCDN } from "../helpers/cdn";
import { useJsonDataLoader } from "./useJsonDataLoader";

export const useNIMDMData = (enabled = true) =>
	useJsonDataLoader<NIMDMDataset>(withCDN("/data/precompiled/nimdm.json"), enabled);
