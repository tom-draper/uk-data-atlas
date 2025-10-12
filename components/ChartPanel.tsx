// components/ChartPanel.tsx
'use client';
import { ChartData, Dataset } from '@/lib/types';

interface ChartPanelProps {
    title: string;
    wardCode: string;
    chartData: ChartData;
    activeDataset: Dataset;
    availableDatasets: Dataset[];
    onDatasetChange: (datasetId: string) => void;
}

interface DatasetComparison {
    dataset: Dataset;
    data: ChartData;
}

export const ChartPanel = ({
    title,
    wardCode,
    chartData,
    activeDataset,
    availableDatasets,
    onDatasetChange,
}: ChartPanelProps) => {
    // For now, show active dataset and 2023 (if available)
    const dataset2023 = availableDatasets.find(d => d.id === '2023');
    const dataset2024 = availableDatasets.find(d => d.id === '2024');

    // In a real app, you'd need to store 2023 chart data separately
    // For this demo, we show the current chartData for active dataset
    const datasets: DatasetComparison[] = [];
    if (activeDataset.id === '2024' && dataset2024) {
        datasets.push({ dataset: dataset2024, data: chartData });
    } else if (activeDataset.id === '2023' && dataset2023) {
        datasets.push({ dataset: dataset2023, data: chartData });
    }

    const renderCompactBar = (data: ChartData, dataset: Dataset) => {
        const maxVotes = Math.max(
            data.LAB,
            data.CON,
            data.LD,
            data.GREEN,
            data.REF,
            data.IND
        );

        if (maxVotes === 0) {
            return <div className="text-xs text-gray-400 py-2">No data available</div>;
        }

        const parties = dataset.partyInfo;
        const totalVotes = parties.reduce((sum, p) => sum + (data[p.key] || 0), 0);

        return (
            <div className="space-y-1">
                {/* Main bar showing all parties */}
                <div className="flex h-6 rounded overflow-hidden bg-gray-200 gap-0">
                    {parties.map(party => {
                        const votes = data[party.key] || 0;
                        const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
                        return (
                            <div
                                key={party.key}
                                style={{
                                    width: `${percentage}%`,
                                    backgroundColor: party.color,
                                }}
                                title={`${party.name}: ${votes.toLocaleString()}`}
                                className="group relative hover:opacity-80 transition-opacity"
                            >
                                {percentage > 10 && (
                                    <span className="text-white text-[10px] font-bold px-1 leading-6 truncate">
                                        {party.key}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
                {/* Compact legend below */}
                <div className="grid grid-cols-3 gap-1 text-[10px]">
                    {parties.map(party => (
                        <div key={party.key} className="flex items-center gap-1">
                            <div
                                className="w-2 h-2 rounded-sm flex-shrink-0"
                                style={{ backgroundColor: party.color }}
                            />
                            <span className="truncate">
                                {(data[party.key] || 0).toLocaleString()}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="pointer-events-auto p-[10px] flex flex-col h-full w-[300px]">
            <div className="bg-[rgba(255,255,255,0.9)] rounded-md backdrop-blur-md shadow-lg h-[100%] p-3 flex flex-col overflow-y-auto">
                {/* Header */}
                <div className="min-h-[50px] pb-2 border-b border-gray-200">
                    <h2 className="font-semibold text-sm">{title}</h2>
                    {wardCode && <div className="text-gray-500 text-xs">{wardCode}</div>}
                </div>

                {/* Dataset Comparison */}
                <div className="space-y-3 flex-1 overflow-y-auto">
                    {/* 2024 Dataset */}
                    {dataset2024 && (
                        <div
                            className={`p-2 rounded transition-all cursor-pointer ${
                                activeDataset.id === '2024'
                                    ? 'bg-blue-50 border-2 border-blue-300'
                                    : 'bg-gray-50 border-2 border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => onDatasetChange('2024')}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-xs font-bold">2024 Elections</h3>
                                {activeDataset.id === '2024' && (
                                    <span className="text-[10px] bg-blue-300 text-blue-900 px-2 py-0.5 rounded">
                                        Active
                                    </span>
                                )}
                            </div>
                            {activeDataset.id === '2024' && renderCompactBar(chartData, dataset2024)}
                            {activeDataset.id !== '2024' && (
                                <div className="text-[10px] text-gray-500">Click to view</div>
                            )}
                        </div>
                    )}

                    {/* 2023 Dataset */}
                    {dataset2023 && (
                        <div
                            className={`p-2 rounded transition-all cursor-pointer ${
                                activeDataset.id === '2023'
                                    ? 'bg-amber-50 border-2 border-amber-300'
                                    : 'bg-gray-50 border-2 border-gray-200 hover:border-gray-300'
                            }`}
                            onClick={() => onDatasetChange('2023')}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-xs font-bold">2023 Elections</h3>
                                {activeDataset.id === '2023' && (
                                    <span className="text-[10px] bg-amber-300 text-amber-900 px-2 py-0.5 rounded">
                                        Active
                                    </span>
                                )}
                            </div>
                            {activeDataset.id === '2023' && renderCompactBar(chartData, dataset2023)}
                            {activeDataset.id !== '2023' && (
                                <div className="text-[10px] text-gray-500">Click to view</div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer note */}
                <div className="text-[10px] text-gray-400 pt-2 border-t border-gray-200 mt-auto">
                    Click to switch datasets and update the map
                </div>
            </div>
        </div>
    );
};