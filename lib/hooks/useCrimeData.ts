import { CrimeDataset } from "@lib/types";
import { withCDN } from "../helpers/cdn";
import { useJsonDataLoader } from "./useJsonDataLoader";

export const useCrimeData = (enabled = true) =>
	useJsonDataLoader<CrimeDataset>(withCDN("/data/precompiled/crime.json"), enabled);
