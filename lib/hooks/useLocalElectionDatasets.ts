import { useEffect, useMemo } from "react";
import { normalizeElectionDatasetCodes } from "@/lib/data/election/local-election/normalize";
import type { CodeMapperStore } from "@/lib/data/boundaries/codeMapper";
import type { Datasets, WardCodes } from "@/lib/types";

/**
 * Supplies election data in the boundary vintage currently held by the map.
 *
 * Election source files also carry ward-to-LAD information missing from older
 * boundary releases, so the same adaptation seeds the mapper before charts
 * request their aggregates.
 */
export function useLocalElectionDatasets(
	datasets: Datasets,
	wardCodes: WardCodes,
	codeMapper: CodeMapperStore,
): Datasets {
	const { addWardLadMappings, getCodeForYear } = codeMapper;

	useEffect(() => {
		const mappings: Record<string, string> = {};
		for (const dataset of Object.values(datasets.localElection)) {
			for (const ward of Object.values(dataset.data)) {
				if (
					ward.wardCode &&
					ward.ladCode &&
					ward.ladCode !== "Unknown"
				) {
					mappings[ward.wardCode] = ward.ladCode;
				}
			}
		}
		if (Object.keys(mappings).length > 0) addWardLadMappings(mappings);
	}, [addWardLadMappings, datasets.localElection]);

	return useMemo(() => {
		if (!wardCodes) return datasets;
		const localElection = Object.fromEntries(
			Object.entries(datasets.localElection).map(([year, dataset]) => {
				const validCodes = wardCodes[dataset.boundaryYear];
				if (!validCodes) return [year, dataset];
				return [
					year,
					normalizeElectionDatasetCodes(
						dataset,
						validCodes,
						getCodeForYear,
					),
				];
			}),
		) as Datasets["localElection"];
		return { ...datasets, localElection };
	}, [datasets, getCodeForYear, wardCodes]);
}
