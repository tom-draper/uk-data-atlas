// lib/hooks/useGeneralElectionData.ts
import { useState, useEffect } from "react";
import { GeneralElectionDataset } from "@lib/types";
import { fetchAndParseGeneralElectionData } from "../data/election/general-election/load";
import { GENERAL_ELECTION_SOURCES } from "../data/election/general-election/config";

export const useGeneralElectionData = (enabled = true) => {
	const [datasets, setDatasets] = useState<
		Record<string, GeneralElectionDataset>
	>({});
	const [loading, setLoading] = useState(enabled);
	const [error, setError] = useState<string>("");

	useEffect(() => {
		if (!enabled) return;
		const loadData = () => {
			Promise.all(
				Object.values(GENERAL_ELECTION_SOURCES).map((config) =>
					fetchAndParseGeneralElectionData(config).catch((err) => {
						console.error(
							`Failed to load general election data for ${config.year}:`,
							err,
						);
						return null;
					}),
				),
			)
				.then((results) => {
					const loadedDatasets: Record<number, GeneralElectionDataset> = {};
					results.forEach((dataset) => {
						if (dataset) loadedDatasets[dataset.year] = dataset;
					});
					setDatasets(loadedDatasets);
				})
				.catch((err: any) => {
					setError(err.message || "Error loading general election data");
				})
				.finally(() => {
					setLoading(false);
				});
		};

		loadData();
	}, [enabled]);

	return { datasets, loading, error };
};
