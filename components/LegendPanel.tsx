// components/LegendPanel.tsx
'use client';
import { PARTIES } from '@/lib/data/parties';
import { memo, useMemo, useState, useRef, useEffect } from 'react';
import type { MapOptions } from '@lib/types/mapOptions';
import type { Dataset, PartyVotes } from '@/lib/types';

interface LegendPanelProps {
    activeDatasetId: string;
    activeDataset: Dataset;
    aggregatedData: { partyVotes: PartyVotes };
    mapOptions: MapOptions;
    onMapOptionsChange: (type: keyof MapOptions, options: Partial<MapOptions[typeof type]>) => void;
}

interface RangeControlProps {
    min: number;
    max: number;
    currentMin: number;
    currentMax: number;
    gradient: string;
    labels: string[];
    onRangeInput: (min: number, max: number) => void; // Changed from onRangeChange
    onRangeChangeEnd: () => void; // Added for mouseup event
}

function RangeControl({ min, max, currentMin, currentMax, gradient, labels, onRangeInput, onRangeChangeEnd }: RangeControlProps) {
    const [isDraggingMin, setIsDraggingMin] = useState(false);
    const [isDraggingMax, setIsDraggingMax] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const getValueFromPosition = (clientY: number) => {
        if (!containerRef.current) return currentMax;
        const rect = containerRef.current.getBoundingClientRect();
        const relativeY = clientY - rect.top;
        const percentage = Math.max(0, Math.min(1, relativeY / rect.height));
        return max - (percentage * (max - min));
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDraggingMin) {
                const newMin = Math.min(getValueFromPosition(e.clientY), currentMax - (max - min) * 0.05);
                onRangeInput(newMin, currentMax); // Use onRangeInput for live update
            } else if (isDraggingMax) {
                const newMax = Math.max(getValueFromPosition(e.clientY), currentMin + (max - min) * 0.05);
                onRangeInput(currentMin, newMax); // Use onRangeInput for live update
            }
        };

        const handleMouseUp = () => {
            if (isDraggingMin || isDraggingMax) {
                setIsDraggingMin(false);
                setIsDraggingMax(false);
                onRangeChangeEnd(); // Call change end handler on mouse up
            }
        };

        if (isDraggingMin || isDraggingMax) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDraggingMin, isDraggingMax, currentMin, currentMax, min, max, onRangeInput, onRangeChangeEnd]); // Updated dependencies

    const maxPosition = ((max - currentMax) / (max - min)) * 100;
    const minPosition = ((max - currentMin) / (max - min)) * 100;

    return (
        <div className="p-1 relative select-none">
            <div ref={containerRef} className="h-40 w-6 rounded relative" style={{ background: gradient }}>
                {/* Max handle (top) */}
                <div
                    className="absolute left-0 w-full h-0.5 bg-white shadow-md cursor-ns-resize group"
                    style={{ top: `${maxPosition}%`, transform: 'translateY(-50%)' }}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        setIsDraggingMax(true);
                    }}
                >
                    <div className="absolute -left-1 -top-1.5 w-8 h-4 flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full shadow-md border border-gray-300 group-hover:scale-125 transition-transform" />
                    </div>
                </div>

                {/* Min handle (bottom) */}
                <div
                    className="absolute left-0 w-full h-0.5 bg-white shadow-md cursor-ns-resize group"
                    style={{ top: `${minPosition}%`, transform: 'translateY(-50%)' }}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        setIsDraggingMin(true);
                    }}
                >
                    <div className="absolute -left-1 -top-1.5 w-8 h-4 flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full shadow-md border border-gray-300 group-hover:scale-125 transition-transform" />
                    </div>
                </div>
            </div>

            {/* Labels */}
            <div className="flex flex-col justify-between h-40 text-[10px] text-gray-400/80 -mt-40 ml-8 pointer-events-none">
                {labels.map((label, i) => (
                    <span key={i}>{label}</span>
                ))}
            </div>
        </div>
    );
}

export default memo(function LegendPanel({
    activeDatasetId,
    activeDataset,
    aggregatedData,
    mapOptions,
    onMapOptionsChange
}: LegendPanelProps) {
    // Local state to hold "live" changes during a drag for responsive UI
    const [liveOptions, setLiveOptions] = useState<MapOptions | null>(null);

    // Use liveOptions if dragging, otherwise fall back to mapOptions from props
    const displayOptions = liveOptions || mapOptions;

    const parties = useMemo(() => {
        if (!aggregatedData || !aggregatedData.partyVotes) return [];
        return Object.entries(aggregatedData.partyVotes)
            .filter(([_, votes]) => votes > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([id]) => ({
                id,
                color: PARTIES[id].color,
                name: PARTIES[id].name,
            }));
    }, [aggregatedData])

    const handlePartyClick = (partyCode: string) => {
        const electionType = activeDataset.type as 'general-election' | 'local-election';
        if (electionType !== 'general-election' && electionType !== 'local-election') return;

        // Use mapOptions for clicks, as this is a new action, not a drag
        const currentOptions = mapOptions[electionType];

        if (currentOptions.mode === 'party-percentage' && currentOptions.selectedParty === partyCode) {
            onMapOptionsChange(electionType, {
                mode: 'winner',
                selectedParty: undefined,
            });
        } else {
            onMapOptionsChange(electionType, {
                mode: 'party-percentage',
                selectedParty: partyCode,
            });
        }
    };

    // Use displayOptions to render the current state
    const currentOptions = activeDataset.type === 'general-election'
        ? displayOptions['general-election']
        : activeDataset.type === 'local-election'
            ? displayOptions['local-election']
            : null;

    const isElectionDataset = activeDataset.type === 'general-election' || activeDataset.type === 'local-election';

    // "Input" handler: Updates local state (cheap)
    const handleRangeInput = (datasetId: string, min: number, max: number) => {
        setLiveOptions(prev => {
            const base = prev || mapOptions;
            const newOptions = { ...base };
            if (datasetId === 'population') {
                newOptions.population = { ...base.population, colorRange: { min, max } };
            } else if (datasetId === 'density') {
                newOptions.density = { ...base.density, colorRange: { min, max } };
            } else if (datasetId === 'gender') {
                newOptions.gender = { ...base.gender, colorRange: { min, max } };
            }
            return newOptions;
        });
    };

    // "ChangeEnd" handler: Updates parent state (expensive)
    const handleRangeChangeEnd = (datasetId: string) => {
        if (!liveOptions) return; // No drag happened

        if (datasetId === 'population' && liveOptions.population.colorRange) {
            onMapOptionsChange('population', { colorRange: liveOptions.population.colorRange });
        } else if (datasetId === 'density' && liveOptions.density.colorRange) {
            onMapOptionsChange('density', { colorRange: liveOptions.density.colorRange });
        } else if (datasetId === 'gender' && liveOptions.gender.colorRange) {
            onMapOptionsChange('gender', { colorRange: liveOptions.gender.colorRange });
        }
        setLiveOptions(null); // Clear local state
    };

    // "Input" handler for party percentage
    const handlePartyRangeInput = (min: number, max: number) => {
        const electionType = activeDataset.type as 'general-election' | 'local-election';
        if (electionType !== 'general-election' && electionType !== 'local-election') return;

        setLiveOptions(prev => {
            const base = prev || mapOptions;
            return {
                ...base,
                [electionType]: {
                    ...base[electionType],
                    partyPercentageRange: { min, max }
                }
            };
        });
    };

    // "ChangeEnd" handler for party percentage
    const handlePartyRangeChangeEnd = () => {
        if (!liveOptions) return;

        const electionType = activeDataset.type as 'general-election' | 'local-election';
        if (electionType !== 'general-election' && electionType !== 'local-election') return;

        if (liveOptions[electionType]?.partyPercentageRange) {
            onMapOptionsChange(electionType, {
                partyPercentageRange: liveOptions[electionType].partyPercentageRange
            });
        }
        setLiveOptions(null);
    };

    const renderPopulationLegend = () => {
        const options = displayOptions.population; // Use displayOptions
        const currentMin = options?.colorRange?.min ?? 25;
        const currentMax = options?.colorRange?.max ?? 55;

        return (
            <RangeControl
                min={18}
                max={80}
                currentMin={currentMin}
                currentMax={currentMax}
                gradient="linear-gradient(to top, rgb(253,231,37), rgb(94,201,98), rgb(33,145,140), rgb(59,82,139), rgb(68,1,84))"
                labels={[
                    currentMax.toFixed(0),
                    ((currentMax - currentMin) * 0.75 + currentMin).toFixed(0),
                    ((currentMax - currentMin) * 0.5 + currentMin).toFixed(0),
                    ((currentMax - currentMin) * 0.25 + currentMin).toFixed(0),
                    currentMin.toFixed(0)
                ]}
                onRangeInput={(min, max) => handleRangeInput('population', min, max)}
                onRangeChangeEnd={() => handleRangeChangeEnd('population')}
            />
        );
    };

    const renderDensityLegend = () => {
        const options = displayOptions.density; // Use displayOptions
        const currentMin = options?.colorRange?.min ?? 500;
        const currentMax = options?.colorRange?.max ?? 10000;

        return (
            <RangeControl
                min={0}
                max={10000}
                currentMin={currentMin}
                currentMax={currentMax}
                gradient="linear-gradient(to top, rgb(253,231,37), rgb(94,201,98), rgb(33,145,140), rgb(59,82,139), rgb(68,1,84))"
                labels={[
                    currentMax.toFixed(0),
                    ((currentMax - currentMin) * 0.75 + currentMin).toFixed(0),
                    ((currentMax - currentMin) * 0.5 + currentMin).toFixed(0),
                    ((currentMax - currentMin) * 0.25 + currentMin).toFixed(0),
                    currentMin.toFixed(0)
                ]}
                onRangeInput={(min, max) => handleRangeInput('density', min, max)}
                onRangeChangeEnd={() => handleRangeChangeEnd('density')}
            />
        );
    };

    const renderGenderLegend = () => {
        const options = displayOptions.gender; // Use displayOptions
        const currentMin = options?.colorRange?.min ?? -0.1;
        const currentMax = options?.colorRange?.max ?? 0.1;

        return (
            <RangeControl
                min={-0.5}
                max={0.5}
                currentMin={currentMin}
                currentMax={currentMax}
                gradient="linear-gradient(to top, rgba(255,105,180,0.8), rgba(240,240,240,0.8), rgba(70,130,180,0.8))"
                labels={[
                    `M ${(currentMax * 100).toFixed(0)}%`,
                    '0%',
                    `F ${(Math.abs(currentMin) * 100).toFixed(0)}%`
                ]}
                onRangeInput={(min, max) => handleRangeInput('gender', min, max)}
                onRangeChangeEnd={() => handleRangeChangeEnd('gender')}
            />
        );
    };

    const renderElectionLegend = () => {
        return (
            <div>
                {parties.map((party) => {
                    // currentOptions reads from displayOptions, so this is fine
                    const isSelected = currentOptions?.mode === 'party-percentage'
                        && currentOptions.selectedParty === party.id;
                    return (
                        <button
                            key={party.id}
                            onClick={() => handlePartyClick(party.id)}
                            className={`flex items-center gap-2 px-1 py-[3px] w-full text-left rounded-sm transition-all cursor-pointer ${isSelected
                                ? 'ring-1'
                                : 'hover:bg-gray-100/30'
                                }`}
                            style={isSelected ? {
                                backgroundColor: `${party.color}15`,
                                '--tw-ring-color': `${party.color}80`
                            } as React.CSSProperties : {}}
                        >
                            <div
                                className={`w-3 h-3 rounded-xs shrink-0 transition-opacity ${isSelected ? 'opacity-100 ring-1' : 'opacity-100'
                                    }`}
                                style={{
                                    backgroundColor: party.color,
                                    ...(isSelected ? { '--tw-ring-color': party.color } as React.CSSProperties : {})
                                }}
                            />
                            <span className={`text-xs ${isSelected ? 'text-gray-700 font-medium' : 'text-gray-500'
                                }`}>
                                {party.name}
                            </span>
                        </button>
                    );
                })}
            </div>
        )
    }

    const renderLegendContent = () => {
        switch (activeDatasetId) {
            case 'population-2020':
            case 'population-2021':
            case 'population-2022':
                return renderPopulationLegend();
            case 'density-2020':
            case 'density-2021':
            case 'density-2022':
                return renderDensityLegend();
            case 'gender-2020':
            case 'gender-2021':
            case 'gender-2022':
                return renderGenderLegend();
            default:
                return renderElectionLegend();
        }
    };

    return (
        <div className="pointer-events-none p-2.5 pr-0 flex flex-col h-full gap-2.5">
            <div className="bg-[rgba(255,255,255,0.5)] pointer-events-auto rounded-md backdrop-blur-md shadow-lg border border-white/30">
                <div className="bg-white/20 p-1 overflow-hidden">
                    {renderLegendContent()}
                </div>
            </div>

            {isElectionDataset && currentOptions?.mode === 'party-percentage' && currentOptions.selectedParty && (
                <div className="bg-[rgba(255,255,255,0.5)] pointer-events-auto rounded-md backdrop-blur-md shadow-lg border border-white/30 w-fit ml-auto">
                    <div className="bg-white/20 p-1 overflow-hidden">
                        <RangeControl
                            min={0}
                            max={100}
                            currentMin={currentOptions.partyPercentageRange?.min ?? 0}
                            currentMax={currentOptions.partyPercentageRange?.max ?? 100}
                            gradient={`linear-gradient(to bottom, ${PARTIES[currentOptions.selectedParty].color || '#999'}, #f5f5f5)`}
                            labels={[
                                `${(currentOptions.partyPercentageRange?.max ?? 100).toFixed(0)}%`,
                                `${((currentOptions.partyPercentageRange?.max ?? 100) * 0.75 + (currentOptions.partyPercentageRange?.min ?? 0) * 0.25).toFixed(0)}%`,
                                `${((currentOptions.partyPercentageRange?.max ?? 100) * 0.5 + (currentOptions.partyPercentageRange?.min ?? 0) * 0.5).toFixed(0)}%`,
                                `${((currentOptions.partyPercentageRange?.max ?? 100) * 0.25 + (currentOptions.partyPercentageRange?.min ?? 0) * 0.75).toFixed(0)}%`,
                                `${(currentOptions.partyPercentageRange?.min ?? 0).toFixed(0)}%`
                            ]}
                            onRangeInput={handlePartyRangeInput}
                            onRangeChangeEnd={handlePartyRangeChangeEnd}
                        />
                    </div>
                </div>
            )}
        </div>
    );
});