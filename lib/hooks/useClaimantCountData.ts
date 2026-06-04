import { ClaimantCountDataset } from "../types/claimantCount";
import { withCDN } from "../helpers/cdn";
import { useJsonDataLoader } from "./useJsonDataLoader";

export const useClaimantCountData = (enabled = true) =>
	useJsonDataLoader<ClaimantCountDataset>(withCDN("/data/precompiled/claimant-count.json"), enabled);
