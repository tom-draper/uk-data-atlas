// components/LegendPanel.tsx
'use client';
import { PARTIES } from '@/lib/data/parties';
import { memo, useMemo } from 'react';
import type { MapOptions } from '@lib/types/mapOptions';
import type { Dataset, PartyVotes } from '@/lib/types';

interface LegendPanelProps {
    activeDatasetId: string;
    activeDataset: Dataset;
    aggregatedData: { partyVotes: PartyVotes };
    mapOptions: MapOptions;
    onMapOptionsChange: (type: keyof MapOptions, options: Partial<MapOptions[typeof type]>) => void;
}

export default memo(function LegendPanel({
    activeDatasetId,
    activeDataset,
    aggregatedData,
    mapOptions,
    onMapOptionsChange
}: LegendPanelProps) {
    const handlePartyClick = (partyCode: string) => {
        if (activeDataset.type === 'general-election') {
            const currentOptions = mapOptions['general-election'];

            // Toggle: if clicking the same party, go back to winner mode
            if (currentOptions.mode === 'party-percentage' && currentOptions.selectedParty === partyCode) {
                onMapOptionsChange('general-election', {
                    mode: 'winner',
                    selectedParty: undefined,
                });
            } else {
                // Switch to party percentage mode
                onMapOptionsChange('general-election', {
                    mode: 'party-percentage',
                    selectedParty: partyCode,
                });
            }
        } else if (activeDataset.type === 'local-election') {
            const currentOptions = mapOptions['local-election'];

            if (currentOptions.mode === 'party-percentage' && currentOptions.selectedParty === partyCode) {
                onMapOptionsChange('local-election', {
                    mode: 'winner',
                    selectedParty: undefined,
                });
            } else {
                onMapOptionsChange('local-election', {
                    mode: 'party-percentage',
                    selectedParty: partyCode,
                });
            }
        }
    };

    const currentOptions = activeDataset.type === 'general-election'
        ? mapOptions['general-election']
        : activeDataset.type === 'local-election'
            ? mapOptions['local-election']
            : null;

    const isElectionDataset = activeDataset.type === 'general-election' || activeDataset.type === 'local-election';

    const renderPopulationLegend = () => (
        <div className="p-1">
            <div className="h-40 w-6 rounded" style={{
                background: 'linear-gradient(to bottom, rgb(253,231,37), rgb(94,201,98), rgb(33,145,140), rgb(59,82,139), rgb(68,1,84))'
            }} />
            <div className="flex flex-col justify-between h-40 text-[10px] text-gray-400/80 -mt-40 ml-8">
                <span>55</span>
                <span>47</span>
                <span>40</span>
                <span>32</span>
                <span>25</span>
            </div>
        </div>
    );

    const renderDensityLegend = () => (
        <div className="p-1">
            <div className="h-40 w-6 rounded" style={{
                background: 'linear-gradient(to bottom, rgb(253,231,37), rgb(94,201,98), rgb(33,145,140), rgb(59,82,139), rgb(68,1,84))'
            }} />
            <div className="flex flex-col justify-between h-40 text-[10px] text-gray-400/80 -mt-40 ml-8">
                <span>10000</span>
                <span>5000</span>
                <span>2000</span>
                <span>1000</span>
                <span>500</span>
            </div>
        </div>
    );

    const renderGenderLegend = () => (
        <div className="p-1">
            <div className="h-40 w-6 rounded" style={{
                background: 'linear-gradient(to top, rgba(255,105,180,0.8), rgba(240,240,240,0.8), rgba(70,130,180,0.8))'
            }} />
            <div className="flex flex-col justify-between h-40 text-[10px] text-gray-400/80 -mt-40 ml-8">
                <span>M</span>
                <span>F</span>
            </div>
        </div>
    );

    const renderElectionLegend = () => {
        const parties = useMemo(() => {
            if (!aggregatedData) return [];
            return Object.entries(aggregatedData.partyVotes)
                .filter(([_, votes]) => votes > 0) // remove zero votes
                .sort((a, b) => b[1] - a[1]) // sort by vote count descending
                .map(([id]) => ({
                    id,
                    color: PARTIES[id].color,
                    name: PARTIES[id].name,
                }));
        }, [aggregatedData])

        return (
            <div>
                {parties.map((party) => {
                    const isSelected = currentOptions?.mode === 'party-percentage'
                        && currentOptions.selectedParty === party.id;

                    return (
                        <button
                            key={party.id}
                            onClick={() => handlePartyClick(party.id)}
                            className={`flex items-center gap-2 px-1 py-[3px] w-full text-left rounded transition-all cursor-pointer ${isSelected
                                ? 'bg-blue-100/50 ring-1 ring-blue-400/50'
                                : 'hover:bg-gray-100/30'
                                }`}
                        >
                            <div
                                className={`w-3 h-3 rounded-xs shrink-0 transition-opacity ${isSelected ? 'opacity-100 ring-1 ring-blue-400' : 'opacity-100'
                                    }`}
                                style={{ backgroundColor: party.color }}
                            />
                            <span className={`text-xs ${isSelected ? 'text-gray-700 font-medium' : 'text-gray-500'
                                }`}>
                                {party.name}
                            </span>
                        </button>
                    );
                })}

                {isElectionDataset && currentOptions?.mode === 'party-percentage' && currentOptions.selectedParty && (
                    <div className="my-1 mx-1 border-t border-gray-200/80">
                        <div className="pt-2">
                            <div className="text-[10px] text-gray-400 mb-1.5 flex justify-between px-1">
                                <span>0%</span>
                                <p className="text-[10px] text-gray-400 leading-relaxed px-2">
                                    Showing vote % for <span style={{ color: PARTIES[currentOptions.selectedParty].color }}>{currentOptions.selectedParty}</span>
                                </p>
                                <span>100%</span>
                            </div>
                            <div className="h-3 rounded" style={{
                                background: `linear-gradient(to right, #f5f5f5, ${PARTIES[currentOptions.selectedParty].color || '#999'})`
                            }} />
                        </div>
                    </div>
                )}
            </div>
        )
    }

    const renderLegendContent = () => {
        switch (activeDatasetId) {
            case 'population':
                return renderPopulationLegend();
            case 'density':
                return renderDensityLegend();
            case 'gender':
                return renderGenderLegend();
            default:
                return renderElectionLegend();
        }
    };

    return (
        <div className="pointer-events-none p-2.5 pr-0 flex flex-col h-full">
            <div className="bg-[rgba(255,255,255,0.5)] pointer-events-auto rounded-md backdrop-blur-md shadow-lg border border-white/30">
                <div className="bg-white/20 p-1 overflow-hidden">
                    {renderLegendContent()}
                </div>
            </div>
        </div>
    );
});