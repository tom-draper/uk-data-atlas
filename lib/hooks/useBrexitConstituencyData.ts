import { BrexitConstituencyDataset } from "@lib/types";
import { withCDN } from "../helpers/cdn";
import { useJsonDataLoader } from "./useJsonDataLoader";

export const useBrexitConstituencyData = (enabled = true) =>
	useJsonDataLoader<BrexitConstituencyDataset>(withCDN("/data/precompiled/brexit-constituency.json"), enabled);
