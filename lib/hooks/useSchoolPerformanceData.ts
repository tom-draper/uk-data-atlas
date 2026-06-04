import { SchoolPerformanceDataset } from "../types/schoolPerformance";
import { withCDN } from "../helpers/cdn";
import { useJsonDataLoader } from "./useJsonDataLoader";

export const useSchoolPerformanceData = (enabled = true) =>
	useJsonDataLoader<SchoolPerformanceDataset>(withCDN("/data/precompiled/school-performance.json"), enabled);
