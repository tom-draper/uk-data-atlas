import { WIMDDataset } from "@/lib/types/wimd";
import { withCDN } from "../helpers/cdn";
import { useJsonDataLoader } from "./useJsonDataLoader";

export const useWIMDData = (enabled = true) =>
	useJsonDataLoader<WIMDDataset>(withCDN("/data/precompiled/wimd.json"), enabled);
