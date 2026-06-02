import { IMDDataset } from "@/lib/types/imd";
import { withCDN } from "../helpers/cdn";
import { useJsonDataLoader } from "./useJsonDataLoader";

export const useIMDData = (enabled = true) =>
	useJsonDataLoader<IMDDataset>(withCDN("/data/precompiled/imd.json"), enabled);
