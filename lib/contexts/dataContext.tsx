// lib/contexts/dataContext.tsx
import { createContext, useContext, useMemo, useCallback, ReactNode } from 'react';
import type { Dataset, GeneralElectionDataset, HousePriceDataset, LocalElectionDataset, PopulationDataset } from '@lib/types';

interface DataContextValue {
	datasets: {
		'local-election': Record<string, LocalElectionDataset>;
		'general-election': Record<string, GeneralElectionDataset>;
		'population': Record<string, PopulationDataset>;
		'house-price': Record<string, HousePriceDataset>;
	};
	activeDatasetId: string;
	activeDataset: Dataset | null;
	selectedLocation: string;
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
	datasets: {
		'local-election': Record<string, LocalElectionDataset>;
		'general-election': Record<string, GeneralElectionDataset>;
		'population': Record<string, PopulationDataset>;
		'house-price': Record<string, HousePriceDataset>;
	};
	activeDatasetId: string;
	selectedLocation: string;
	onDatasetChange: (id: string) => void;
	onLocationChange: (location: string) => void;
}

export function DataProvider({
	children,
	datasets,
	activeDatasetId,
	selectedLocation,
	onDatasetChange,
	onLocationChange,
}: DataProviderProps) {


	// Stable callback references
	const handleDatasetChange = useCallback((id: string) => {
		onDatasetChange(id);
	}, [onDatasetChange]);

	const handleLocationChange = useCallback((location: string) => {
		onLocationChange(location);
	}, [onLocationChange]);

	const value = useMemo(() => ({
		datasets,
		activeDatasetId,
		activeDataset,
		selectedLocation,
		setActiveDatasetId: handleDatasetChange,
		setSelectedLocation: handleLocationChange,
	}), [datasets, activeDatasetId, activeDataset, selectedLocation, handleDatasetChange, handleLocationChange]
	);

	return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}