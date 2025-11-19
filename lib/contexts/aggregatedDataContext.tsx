// lib/contexts/aggregatedDataContext.tsx
import { createContext, useContext, ReactNode } from 'react';

interface AggregatedDataContextValue {
	'local-election': Record<string, any>;
	'general-election': Record<string, any>;
	'population': Record<string, any>;
	'house-price': Record<string, any>;
}

const AggregatedDataContext = createContext<AggregatedDataContextValue | null>(null);

export function useAggregatedDataContext() {
	const context = useContext(AggregatedDataContext);
	if (!context) throw new Error('useAggregatedDataContext must be used within AggregatedDataProvider');
	return context;
}

interface AggregatedDataProviderProps {
	children: ReactNode;
	value: AggregatedDataContextValue;
}

export function AggregatedDataProvider({ children, value }: AggregatedDataProviderProps) {
	return (
		<AggregatedDataContext.Provider value={value}>
			{children}
		</AggregatedDataContext.Provider>
	);
}