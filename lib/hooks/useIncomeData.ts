import { IncomeDataset } from "../types/income";
import { withCDN } from "../helpers/cdn";
import { useJsonDataLoader } from "./useJsonDataLoader";

export const useIncomeData = (enabled = true) =>
	useJsonDataLoader<IncomeDataset>(withCDN("/data/precompiled/income.json"), enabled);
