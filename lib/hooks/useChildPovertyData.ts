import { ChildPovertyDataset } from "../types/childPoverty";
import { withCDN } from "../helpers/cdn";
import { useJsonDataLoader } from "./useJsonDataLoader";

export const useChildPovertyData = (enabled = true) =>
	useJsonDataLoader<ChildPovertyDataset>(
		withCDN("/data/precompiled/child-poverty.json"),
		enabled,
	);
