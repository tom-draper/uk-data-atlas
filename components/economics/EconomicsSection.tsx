// components/HousePriceChart.tsx
'use client';
import { CodeMapper } from '@/lib/hooks/useCodeMapper';
import { ActiveViz, AggregatedHousePriceData, AggregatedIncomeData, Dataset, HousePriceDataset, IncomeDataset } from '@lib/types';
import HousePriceChart from './house-price/HousePriceChart';
import IncomeChart from './income/IncomeChart';

interface EconomicsSectionProps {
    activeDataset: Dataset | null;
    availableHousePriceDatasets: Record<string, HousePriceDataset>;
    aggregatedHousePriceData: AggregatedHousePriceData | null;
    availableIncomeDatasets: Record<string, IncomeDataset>;
    aggregatedIncomeData: AggregatedIncomeData | null;
    setActiveViz: (value: ActiveViz) => void;
    wardCode?: string;
    constituencyCode?: string;
    codeMapper: CodeMapper
}

export default function EconomicsSection({
    activeDataset,
    availableHousePriceDatasets,
    aggregatedHousePriceData,
    availableIncomeDatasets,
    aggregatedIncomeData,
    setActiveViz,
    wardCode,
    constituencyCode,
    codeMapper,
}: EconomicsSectionProps) {
    return (
        <div className="space-y-2 border-t border-gray-200/80">
            <h3 className="text-xs font-bold pt-2">Economics</h3>
            <HousePriceChart
                activeDataset={activeDataset}
                availableDatasets={availableHousePriceDatasets}
                aggregatedData={aggregatedHousePriceData}
                year={2023}
                setActiveViz={setActiveViz}
                wardCode={wardCode}
                constituencyCode={constituencyCode}
                codeMapper={codeMapper}
            />
            <IncomeChart
                activeDataset={activeDataset}
                availableDatasets={availableIncomeDatasets}
                aggregatedData={aggregatedIncomeData}
                year={2025}
                setActiveViz={setActiveViz}
                wardCode={wardCode}
                constituencyCode={constituencyCode}
                codeMapper={codeMapper}
            />
        </div>
    );
};