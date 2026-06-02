import { QualificationDataset } from "@/lib/types/qualification";
import { withCDN } from "../helpers/cdn";
import { useJsonDataLoader } from "./useJsonDataLoader";

export const useQualificationData = (enabled = true) =>
	useJsonDataLoader<QualificationDataset>(withCDN("/data/precompiled/qualification.json"), enabled);
