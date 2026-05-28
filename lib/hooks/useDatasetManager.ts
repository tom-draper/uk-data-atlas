// lib/hooks/useDatasetManager.ts
import {
	CrimeDataset,
	GeneralElectionDataset,
	HousePriceDataset,
	LocalElectionDataset,
	PopulationDataset,
	IncomeDataset,
	BrexitLADDataset,
	BrexitConstituencyDataset,
} from "../types";

/**
 * Centralized dataset selection logic
 * Determines active dataset, mode, and boundary requirements
 */
export function useDatasetManager(
	activeDatasetId: string,
	localElectionDatasets: Record<string, LocalElectionDataset>,
	generalElectionDatasets: Record<string, GeneralElectionDataset>,
	populationDatasets: Record<string, PopulationDataset>,
	housePriceDatasets: Record<string, HousePriceDataset>,
	crimeDatasets: Record<string, CrimeDataset>,
	incomeDatasets: Record<string, IncomeDataset>,
	brexitDatasets: Record<string, BrexitLADDataset>,
	brexitConstituencyDatasets: Record<string, BrexitConstituencyDataset>,
) {
	const activeDataset = (() => {
		switch (activeDatasetId) {
			case "ageDistribution2020":
			case "populationDensity2020":
			case "gender2020":
				return populationDatasets["population2020"];
			case "ageDistribution2021":
			case "populationDensity2021":
			case "gender2021":
				return populationDatasets["population2021"];
			case "ageDistribution2022":
			case "populationDensity2022":
			case "gender2022":
				return populationDatasets["population2022"];
			case "generalElection2024":
			case "generalElection2019":
			case "generalElection2017":
			case "generalElection2015":
				return generalElectionDatasets[activeDatasetId];
			case "localElection2025":
			case "localElection2024":
			case "localElection2023":
			case "localElection2022":
			case "localElection2021":
				return localElectionDatasets[activeDatasetId];
			case "housePrice2023":
				return housePriceDatasets[activeDatasetId];
			case "crime2025":
				return crimeDatasets[activeDatasetId];
			case "income2025":
				return incomeDatasets[activeDatasetId];
			case "brexit2016":
				return brexitDatasets[activeDatasetId];
			case "brexitConstituency2016":
				return brexitConstituencyDatasets[activeDatasetId];
		}
	})();

	return activeDataset;
}
