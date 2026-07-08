import { CustomDataset } from "../types/custom";
import { withCDN } from "../helpers/cdn";
import { useJsonDataLoader } from "./useJsonDataLoader";

export const useRoadSafetyData = (enabled = true) =>
	useJsonDataLoader<CustomDataset>(
		withCDN("/data/precompiled/road-safety.json"),
		enabled,
	);
