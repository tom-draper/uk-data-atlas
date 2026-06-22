import { GeneralElectionDataset } from "@lib/types";
import { withCDN } from "../helpers/cdn";
import { useJsonDataLoader } from "./useJsonDataLoader";

export const useGeneralElectionData = (enabled = true) =>
	useJsonDataLoader<GeneralElectionDataset>(
		withCDN("/data/precompiled/general-election.json"),
		enabled,
	);
