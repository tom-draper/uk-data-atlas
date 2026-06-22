import { LocalElectionDataset } from "@lib/types/index";
import { withCDN } from "../helpers/cdn";
import { useJsonDataLoader } from "./useJsonDataLoader";

export const useLocalElectionData = (enabled = true) =>
	useJsonDataLoader<LocalElectionDataset>(
		withCDN("/data/precompiled/local-election.json"),
		enabled,
	);
