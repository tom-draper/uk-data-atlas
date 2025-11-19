import { createContext, useContext, ReactNode, useMemo } from 'react';
import { useAggregatedData } from '@/lib/hooks/useAggregatedData';
import type { Dataset, GeneralElectionDataset, HousePriceDataset, LocalElectionDataset, PopulationDataset } from '@/lib/types';
import { BoundaryData } from '../hooks/useBoundaryData';

interface AggregatedDataProviderProps {
    children: ReactNode;
    mapManager: any; 
    activeDataset: Dataset | null;
    boundaryData: BoundaryData;
    datasets: {
        'local-election': Record<string, LocalElectionDataset>;
        'general-election': Record<string, GeneralElectionDataset>;
        'population': Record<string, PopulationDataset>;
        'house-price': Record<string, HousePriceDataset>;
    }
    location: string;
}

// Define the Context Type (The return type of useAggregatedData)
// We infer this is what useAggregatedData returns
type AggregatedDataContextType = {
    aggregatedData: ReturnType<typeof useAggregatedData>;
    currentAggregatedData: any; // Replace 'any' with the specific type if known
}

const AggregatedDataContext = createContext<AggregatedDataContextType | null>(null);

export const AggregatedDataProvider = ({
    children,
    activeDataset,
    mapManager,
    boundaryData,
    datasets,
    location,
}: AggregatedDataProviderProps) => {
    const aggregatedData = useAggregatedData({
        mapManager,
        boundaryData,
        datasets,
        location,
    });

    // Get current aggregated data for active dataset
    const currentAggregatedData = useMemo(() => {
        if (!activeDataset || !aggregatedData) return null;
        return aggregatedData[activeDataset.type]?.[activeDataset.year] ?? null;
    }, [activeDataset, aggregatedData]);

    return (
        <AggregatedDataContext.Provider value={{aggregatedData, currentAggregatedData}}>
            {children}
        </AggregatedDataContext.Provider>
    );
};

// Custom hook for child components (like UIOverlay) to access the data
export const useAggregatedDataContext = () => {
    const context = useContext(AggregatedDataContext);
    if (context === undefined) {
        throw new Error('useAggregatedDataContext must be used within an AggregatedDataProvider');
    }
    return context;
};