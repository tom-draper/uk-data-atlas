import { HomelessnessDataset } from "../types/homelessness";
import { withCDN } from "../helpers/cdn";
import { useJsonDataLoader } from "./useJsonDataLoader";

export const useHomelessnessData = (enabled = true) =>
	useJsonDataLoader<HomelessnessDataset>(
		withCDN("/data/precompiled/homelessness.json"),
		enabled,
	);
