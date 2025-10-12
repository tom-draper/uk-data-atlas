// components/ChartPanel.tsx
'use client';
import { ChartData, Dataset } from '@/lib/types';

interface ChartPanelProps {
    title: string;
    wardCode: string;
    chartData2024: ChartData;
    chartData2023: ChartData;
    chartData2022: ChartData;
    chartData2021: ChartData;
    activeDataset: Dataset;
    availableDatasets: Dataset[];
    onDatasetChange: (datasetId: string) => void;
}

export const ChartPanel = ({
    title,
    wardCode,
    chartData2024,
    chartData2023,
    chartData2022,
    chartData2021,
    activeDataset,
    availableDatasets,
    onDatasetChange,
}: ChartPanelProps) => {
    const dataset2024 = availableDatasets.find(d => d.id === '2024');
    const dataset2023 = availableDatasets.find(d => d.id === '2023');
    const dataset2022 = availableDatasets.find(d => d.id === '2022');
    const dataset2021 = availableDatasets.find(d => d.id === '2021');

    const renderCompactBar = (data: ChartData | undefined, dataset: Dataset) => {
        if (!data) {
            return <div className="text-xs text-gray-400 py-2">No data</div>;
        }

        const maxVotes = Math.max(
            data.LAB,
            data.CON,
            data.LD,
            data.GREEN,
            data.REF,
            data.IND
        );

        if (maxVotes === 0) {
            return <div className="text-xs text-gray-400 py-2">No data</div>;
        }

        const parties = dataset.partyInfo;
        const totalVotes = parties.reduce((sum, p) => sum + (data[p.key] || 0), 0);

        return (
            <div className="space-y-1">
                {/* Main bar showing all parties */}
                <div className="flex h-5 rounded overflow-hidden bg-gray-200 gap-0">
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
                                {percentage > 12 && (
                                    <span className="text-white text-[9px] font-bold px-0.5 leading-5 truncate">
                                        {party.key}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
                {/* Compact legend */}
                <div className="grid grid-cols-3 gap-0.5 text-[9px]">
                    {parties.map(party => (
                        <div key={party.key} className="flex items-center gap-1">
                            <div
                                className="w-1.5 h-1.5 rounded-sm flex-shrink-0"
                                style={{ backgroundColor: party.color }}
                            />
                            <span className="truncate font-medium">
                                {(data[party.key] || 0).toLocaleString()}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderYearBar = (year: string, data: ChartData | undefined, dataset: Dataset | undefined, isActive: boolean) => {
        if (!dataset) return null;

        const yearColors: Record<string, { bg: string; border: string; badge: string; text: string }> = {
            '2024': { bg: 'bg-blue-50', border: 'border-blue-300', badge: 'bg-blue-300 text-blue-900', text: 'bg-blue-200 text-blue-800' },
            '2023': { bg: 'bg-amber-50', border: 'border-amber-300', badge: 'bg-amber-300 text-amber-900', text: 'bg-amber-200 text-amber-800' },
            '2022': { bg: 'bg-purple-50', border: 'border-purple-300', badge: 'bg-purple-300 text-purple-900', text: 'bg-purple-200 text-purple-800' },
            '2021': { bg: 'bg-emerald-50', border: 'border-emerald-300', badge: 'bg-emerald-300 text-emerald-900', text: 'bg-emerald-200 text-emerald-800' },
        };

        const colors = yearColors[year] || yearColors['2024'];

        return (
            <div
                key={year}
                className={`p-2 rounded transition-all cursor-pointer ${
                    isActive
                        ? `${colors.bg} border-2 ${colors.border}`
                        : `bg-gray-50 border-2 border-gray-200 hover:${colors.border.replace('border-', 'hover:border-')}`
                }`}
                onClick={() => onDatasetChange(year)}
            >
                <div className="flex items-center justify-between mb-1.5">
                    <h3 className="text-xs font-bold">{year} Elections</h3>
                    {isActive && (
                        <span className={`text-[9px] ${colors.badge} px-1.5 py-0.5 rounded font-semibold`}>
                            ACTIVE
                        </span>
                    )}
                </div>
                {renderCompactBar(data, dataset)}
            </div>
        );
    };

    return (
        <div className="pointer-events-auto p-[10px] flex flex-col h-full w-[320px]">
            <div className="bg-[rgba(255,255,255,0.9)] rounded-md backdrop-blur-md shadow-lg h-[100%] p-3 flex flex-col overflow-y-auto">
                {/* Header */}
                <div className="min-h-[45px] pb-2 border-b border-gray-200">
                    <h2 className="font-semibold text-sm">{title}</h2>
                    {wardCode && <div className="text-gray-500 text-xs">{wardCode}</div>}
                </div>

                {/* Dataset Comparison */}
                <div className="space-y-2 flex-1 overflow-y-auto">
                    {/* 2024 Dataset */}
                    {renderYearBar('2024', chartData2024, dataset2024, activeDataset.id === '2024')}

                    {/* 2023 Dataset */}
                    {renderYearBar('2023', chartData2023, dataset2023, activeDataset.id === '2023')}

                    {/* 2022 Dataset */}
                    {renderYearBar('2022', chartData2022, dataset2022, activeDataset.id === '2022')}

                    {/* 2021 Dataset */}
                    {renderYearBar('2021', chartData2021, dataset2021, activeDataset.id === '2021')}
                </div>

                {/* Footer */}
                <div className="text-[9px] text-gray-400 pt-2 border-t border-gray-200 mt-auto">
                    Click to switch which dataset shows on map
                </div>
            </div>
        </div>
    );
};