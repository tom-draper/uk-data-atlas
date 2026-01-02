// lib/hooks/useAggregatedData.ts
import { useMemo } from "react";
import type {
    Dataset,
    Datasets,
    BoundaryType,
    BoundaryGeojson,
    AggregatedData,
    BoundaryData,
    CustomDataset,
} from "@lib/types";
import { MapManager } from "../helpers/mapManager";

interface DatasetConfig<T extends Dataset> {
    datasets: Record<string, T>;
    boundaryType: BoundaryType;
    calculateStats: (
        mapManager: MapManager,
        geojson: BoundaryGeojson,
        data: any,
        location: string | null,
        datasetId: string,
    ) => any;
}

/**
 * Generic aggregation function - works for ANY dataset type
 */
function aggregateDataset<T extends Dataset>(
    config: DatasetConfig<T>,
    mapManager: MapManager | null,
    boundaryData: BoundaryData,
    location: string | null,
) {
    if (!mapManager) return null;

    const result: Record<string, any> = {};

    for (const [datasetId, dataset] of Object.entries(config.datasets)) {
        // Get the appropriate boundary geojson
        const geojson =
            boundaryData[config.boundaryType]?.[dataset.boundaryYear];

        if (dataset.data && geojson) {
            result[dataset.year] = config.calculateStats(
                mapManager,
                geojson,
                dataset.data,
                location,
                datasetId,
            );
        } else {
            result[dataset.year] = null;
        }
    }

    return result;
}

interface UseAggregatedDataParams {
    mapManager: MapManager | null;
    boundaryData: BoundaryData;
    datasets: Datasets;
    customDataset: CustomDataset | null;
    location: string | null;
}

/**
 * Unified hook that aggregates ALL dataset types
 */
export function useAggregatedData({
    mapManager,
    boundaryData,
    datasets,
    customDataset,
    location,
}: UseAggregatedDataParams): AggregatedData {
    // Define configuration for each dataset type
    const configs: Record<keyof Datasets | 'custom', DatasetConfig<any>> = useMemo(
        () => ({
            localElection: {
                datasets: datasets.localElection,
                boundaryType: "ward",
                calculateStats: (mapManager, geojson, data, location, id) =>
                    mapManager.calculateLocalElectionStats(geojson, data, location, id),
            },
            generalElection: {
                datasets: datasets.generalElection,
                boundaryType: "constituency",
                calculateStats: (mapManager, geojson, data, location, id) =>
                    mapManager.calculateGeneralElectionStats(geojson, data, location, id),
            },
            population: {
                datasets: datasets.population,
                boundaryType: "ward",
                calculateStats: (mapManager, geojson, data, location, id) =>
                    mapManager.calculatePopulationStats(geojson, data, location, id),
            },
            ethnicity: {
                datasets: datasets.ethnicity,
                boundaryType: "localAuthority",
                calculateStats: (mapManager, geojson, data, location, id) =>
                    mapManager.calculateEthnicityStats(geojson, data, location, id),
            },
            housePrice: {
                datasets: datasets.housePrice,
                boundaryType: "ward",
                calculateStats: (mapManager, geojson, data, location, id) =>
                    mapManager.calculateHousePriceStats(geojson, data, location, id),
            },
            crime: {
                datasets: datasets.crime,
                boundaryType: "localAuthority",
                calculateStats: (mapManager, geojson, data, location, id) =>
                    mapManager.calculateCrimeStats(geojson, data, location, id),
            },
            income: {
                datasets: datasets.income,
                boundaryType: "localAuthority",
                calculateStats: (mapManager, geojson, data, location, id) =>
                    mapManager.calculateIncomeStats(geojson, data, location, id),
            },
            custom: {
                datasets: customDataset ? [customDataset] : [],
                boundaryType: customDataset?.boundaryType || 'ward',
                calculateStats: (mapManager, geojson, data, location, id) =>
                    mapManager.calculateCustomDatasetStats(geojson, data, location, id),
            }
        }),
        [datasets, customDataset],
    );

    // Aggregate all datasets using the same logic
    const aggregatedData = useMemo(() => {
        if (!mapManager) {
            return {
                localElection: null,
                generalElection: null,
                population: null,
                ethnicity: null,
                housePrice: null,
                crime: null,
                income: null,
                custom: null,
            };
        }

        return Object.fromEntries(
            Object.entries(configs).map(([key, config]) => [
                key,
                aggregateDataset(config, mapManager, boundaryData, location),
            ]),
        ) as AggregatedData;
    }, [mapManager, boundaryData, location, configs]);

    return aggregatedData;
}
