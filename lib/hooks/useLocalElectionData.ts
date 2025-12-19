import { useState, useEffect } from "react";
import { LocalElectionDataset } from "@lib/types/index";
import { ELECTION_SOURCES } from "../data/election/local-election/config";
import {
	fetchAndParseCsv,
	reconcile2023Data,
} from "../data/election/local-election/load";

export const useLocalElectionData = () => {
	const [datasets, setDatasets] = useState<
		Record<string, LocalElectionDataset>
	>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string>("");

	useEffect(() => {
		const loadData = async () => {
			try {
				setLoading(true);
				console.log("Loading election data...");

				// Fetch all Reference Datasets (Has Ward Codes)
				const refs = await Promise.all(
					Object.values(ELECTION_SOURCES)
						.filter((cfg) => cfg.isReference)
						.map((cfg) => fetchAndParseCsv(cfg)),
				);

				// Fetch Dataset needing reconciliation (2023)
				const needsMap = Object.values(ELECTION_SOURCES).find(
					(cfg) => !cfg.isReference,
				);
				let data2023 = needsMap
					? await fetchAndParseCsv(needsMap)
					: null;

				// Reconcile 2023 if it exists
				if (data2023) {
					data2023 = reconcile2023Data(data2023, refs);
				}

				// Combine and cache
				const finalMap: Record<number, LocalElectionDataset> = {};

				refs.forEach((d) => (finalMap[d.year] = d));
				if (data2023) finalMap[data2023.year] = data2023;

				setDatasets(finalMap);
			} catch (err: any) {
				console.error("Failed to load elections:", err);
				setError(err.message || "Error loading election data");
			} finally {
				setLoading(false);
			}
		};

		loadData();
	}, []);

	return { datasets, loading, error };
};
