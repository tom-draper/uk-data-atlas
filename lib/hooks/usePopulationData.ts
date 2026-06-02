"use client";
import { PopulationDataset } from "@lib/types";
import { withCDN } from "../helpers/cdn";
import { useJsonDataLoader } from "./useJsonDataLoader";

export const usePopulationData = (enabled = true) =>
	useJsonDataLoader<PopulationDataset>(withCDN("/data/precompiled/population.json"), enabled);
