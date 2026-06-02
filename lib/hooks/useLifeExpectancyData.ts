import { LifeExpectancyDataset } from "@lib/types";
import { withCDN } from "../helpers/cdn";
import { useJsonDataLoader } from "./useJsonDataLoader";

export const useLifeExpectancyData = (enabled = true, _enableHLE = true) =>
	useJsonDataLoader<LifeExpectancyDataset>(withCDN("/data/precompiled/life-expectancy.json"), enabled);
