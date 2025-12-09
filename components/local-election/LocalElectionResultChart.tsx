// components/LocalElectionResultChart.tsx
'use client';

import { memo } from 'react';
import { LocalElectionDataset, ActiveViz } from '@lib/types';

const YEAR_STYLES: Record<string, { bg: string; border: string }> = {
    '2024': { bg: 'bg-blue-50/60', border: 'border-blue-300' },
    '2023': { bg: 'bg-amber-50/60', border: 'border-amber-300' },
    '2022': { bg: 'bg-purple-50/60', border: 'border-purple-300' },
    '2021': { bg: 'bg-emerald-50/60', border: 'border-emerald-300' },
};

interface ProcessedPartyData {
    key: string;
    name: string;
    color: string;
    votes: number;
    percentage: number;
}

interface ProcessedYearData {
    year: number;
    dataset: LocalElectionDataset | null;
    partyData: ProcessedPartyData[];
    totalVotes: number;
    turnout: number | null;
    hasData: boolean;
}

const VoteBar = memo(({ data }: { data: ProcessedPartyData[] }) => (
    <div className="flex h-5 rounded overflow-hidden bg-gray-200 gap-0 w-full">
        {data.map((p) => (
            <div
                key={p.key}
                style={{ width: `${p.percentage}%`, backgroundColor: p.color }}
                title={`${p.name}: ${p.votes.toLocaleString()} (${p.percentage.toFixed(1)}%)`}
                className="group relative hover:opacity-80 transition-opacity"
            >
                {p.percentage > 12 && (
                    <span className="text-white text-[9px] font-bold px-0.5 leading-5 truncate block">
                        {p.key}
                    </span>
                )}
            </div>
        ))}
    </div>
));
VoteBar.displayName = 'VoteBar';

const Legend = memo(({ partyData }: { partyData: ProcessedPartyData[] }) => (
    <div className="animate-in fade-in duration-200 mt-1">
        <div className="grid grid-cols-3 gap-0.5 text-[9px]">
            {partyData.map((p) => (
                <div key={p.key} className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="truncate font-medium">
                        {p.key}: {p.votes.toLocaleString()}
                    </span>
                </div>
            ))}
        </div>
    </div>
));
Legend.displayName = 'Legend';

export default memo(function LocalElectionResultChart({
    data,
    isActive,
    setActiveViz
}: {
    data: ProcessedYearData;
    isActive: boolean;
    setActiveViz: (val: ActiveViz) => void;
}) {
    const colors = YEAR_STYLES[data.year] || YEAR_STYLES['2024'];

    // Active = Medium Height | Inactive = Small Height
    const heightClass = isActive ? 'h-[95px]' : 'h-[65px]';

    const handleActivate = () => {
        if (data.dataset) {
            setActiveViz({
                vizId: data.dataset.id,
                datasetType: data.dataset.type,
                datasetYear: data.dataset.year
            });
        }
    };

    return (
        <div
            className={`
        p-2 rounded transition-all duration-300 ease-in-out cursor-pointer overflow-hidden border-2 
        ${heightClass}
        ${isActive ? `${colors.bg} ${colors.border}` : 'bg-white/60 border-gray-200/80 hover:border-blue-300'}
      `}
            onClick={handleActivate}
        >
            <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-xs font-bold">{data.year} Local Elections</h3>
                {data.turnout && (
                    <span className="text-[9px] text-gray-500 font-medium">
                        {data.turnout.toFixed(1)}% turnout
                    </span>
                )}
            </div>

            {!data.hasData ? (
                <div className="text-xs text-gray-400/80 pt-0.5 text-center">No data available</div>
            ) : (
                <div className="space-y-1">
                    <VoteBar data={data.partyData} />
                    {isActive && <Legend partyData={data.partyData} />}
                </div>
            )}
        </div>
    );
});