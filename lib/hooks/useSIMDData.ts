import { SIMDDataset } from "@/lib/types/simd";
import { withCDN } from "../helpers/cdn";
import { useJsonDataLoader } from "./useJsonDataLoader";

export const useSIMDData = (enabled = true) =>
	useJsonDataLoader<SIMDDataset>(withCDN("/data/precompiled/simd.json"), enabled);
