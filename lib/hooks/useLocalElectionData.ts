import { useState, useEffect } from "react";
import { LocalElectionDataset } from "@lib/types/index";
import { ELECTION_SOURCES } from "../data/election/local-election/config";
import {
	fetchAndParseCsv,
	reconcile2023Data,
} from "../data/election/local-election/load";

export const useLocalElectionData = (enabled = true) => {
	const [datasets, setDatasets] = useState<
		Record<string, LocalElectionDataset>
	>({});
	const [loading, setLoading] = useState(enabled);
	const [error, setError] = useState<string>("");

	useEffect(() => {
		if (!enabled) return;
		const loadData = () => {
			Promise.all(
				Object.values(ELECTION_SOURCES)
					.flatMap((cfg) => cfg.isReference ? [fetchAndParseCsv(cfg)] : []),
			)
				.then((refs) => {
					const needsMap = Object.values(ELECTION_SOURCES).find(
						(cfg) => !cfg.isReference,
					);
					const p = needsMap ? fetchAndParseCsv(needsMap) : Promise.resolve(null);
					return p.then((data2023raw) => {
						const data2023 = data2023raw ? reconcile2023Data(data2023raw, refs) : null;
						const finalMap: Record<number, LocalElectionDataset> = {};
						refs.forEach((d) => (finalMap[d.year] = d));
						if (data2023) finalMap[data2023.year] = data2023;
						setDatasets(finalMap);
					});
				})
				.catch((err: any) => {
					console.error("Failed to load elections:", err);
					setError(err.message || "Error loading election data");
				})
				.finally(() => {
					setLoading(false);
				});
		};

		loadData();
	}, [enabled]);

	return { datasets, loading, error };
};
