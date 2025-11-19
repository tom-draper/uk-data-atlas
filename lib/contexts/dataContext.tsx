// lib/contexts/dataContext.tsx
import { createContext, useContext, useMemo, useCallback, ReactNode } from 'react';
import type { Dataset } from '@lib/types';

interface DataContextValue {
	datasets: Record<string, Record<string, Dataset>>;
	activeDatasetId: string;
	activeDataset: Dataset | null;
	selectedLocation: string;
	aggregatedData: {
		aggregatedLocalElectionData: Record<string, any>;
		aggregatedGeneralElectionData: Record<string, any>;
		aggregatedPopulationData: Record<string, any>;
		aggregatedHousePriceData: Record<string, any>;
	} | null;
	setActiveDatasetId: (id: string) => void;
	setSelectedLocation: (location: string) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function useData() {
	const context = useContext(DataContext);
	if (!context) throw new Error('useData must be used within DataProvider');
	return context;
}

interface DataProviderProps {
	children: ReactNode;
	datasets: Record<string, Record<string, Dataset>>;
	activeDatasetId: string;
	selectedLocation: string;
	aggregatedData: DataContextValue['aggregatedData'];
	onDatasetChange: (id: string) => void;
	onLocationChange: (location: string) => void;
}

export function DataProvider({
	children,
	datasets,
	activeDatasetId,
	selectedLocation,
	aggregatedData,
	onDatasetChange,
	onLocationChange,
}: DataProviderProps) {
	// Memoize dataset lookup
	const activeDataset = useMemo(() => {
		for (const datasetsByType of Object.values(datasets)) {
			const dataset = Object.values(datasetsByType).find(
				ds => ds.id === activeDatasetId
			);
			if (dataset) return dataset;
		}
		return null;
	}, [datasets, activeDatasetId]);

	// Stable callback references
	const handleDatasetChange = useCallback((id: string) => {
		onDatasetChange(id);
	}, [onDatasetChange]);

	const handleLocationChange = useCallback((location: string) => {
		onLocationChange(location);
	}, [onLocationChange]);

	const value = useMemo(
		() => ({
			datasets,
			activeDatasetId,
			activeDataset,
			selectedLocation,
			aggregatedData,
			setActiveDatasetId: handleDatasetChange,
			setSelectedLocation: handleLocationChange,
		}),
		[
			datasets,
			activeDatasetId,
			activeDataset,
			selectedLocation,
			aggregatedData,
			handleDatasetChange,
			handleLocationChange,
		]
	);

	return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}