// components/LegendPanel.tsx
'use client';
import { PARTIES } from '@/lib/data/election/parties';
import { memo, useMemo, useState, useRef, useEffect } from 'react';
import type { MapOptions } from '@lib/types/mapOptions';
import { ActiveViz, AggregatedData, Dataset } from '@/lib/types';

interface LegendPanelProps {
    activeDataset: Dataset | null;
    activeViz: ActiveViz;
    aggregatedData: AggregatedData;
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
    onRangeInput: (min: number, max: number) => void;
    onRangeChangeEnd: () => void;
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
                onRangeInput(newMin, currentMax);
            } else if (isDraggingMax) {
                const newMax = Math.max(getValueFromPosition(e.clientY), currentMin + (max - min) * 0.05);
                onRangeInput(currentMin, newMax);
            }
        };

        const handleMouseUp = () => {
            if (isDraggingMin || isDraggingMax) {
                setIsDraggingMin(false);
                setIsDraggingMax(false);
                onRangeChangeEnd();
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
    }, [isDraggingMin, isDraggingMax, currentMin, currentMax, min, max, onRangeInput, onRangeChangeEnd]);

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
    activeDataset,
    activeViz,
    aggregatedData,
    mapOptions,
    onMapOptionsChange
}: LegendPanelProps) {
    // Local state to hold "live" changes during a drag for responsive UI
    const [liveOptions, setLiveOptions] = useState<MapOptions | null>(null);

    // Use liveOptions if dragging, otherwise fall back to mapOptions from props
    const displayOptions = liveOptions || mapOptions;

    const parties = useMemo(() => {
        if (!activeDataset || aggregatedData[activeDataset.type] === null) return [];
        const partyVotes = aggregatedData[activeDataset.type][activeDataset.year].partyVotes;
        if (!partyVotes) return [];
        return Object.entries(partyVotes)
            .filter(([_, votes]) => votes > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([id]) => ({
                id,
                color: PARTIES[id].color,
                name: PARTIES[id].name,
            }));
    }, [aggregatedData, activeDataset])

    const handlePartyClick = (partyCode: string) => {
        const electionType = activeDataset?.type as 'general-election' | 'local-election';
        if (electionType !== 'general-election' && electionType !== 'local-election') return;

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
    const currentOptions = activeDataset?.type === 'general-election'
        ? displayOptions['general-election']
        : activeDataset?.type === 'local-election'
            ? displayOptions['local-election']
            : null;

    const isElectionDataset = activeDataset?.type === 'general-election' || activeDataset?.type === 'local-election';

    // "Input" handler: Updates local state (cheap)
    const handleRangeInput = (datasetId: string, min: number, max: number) => {
        setLiveOptions(prev => {
            const base = prev || mapOptions;
            const newOptions = { ...base };
            if (datasetId === 'age-distribution') {
                newOptions['age-distribution'] = { ...base['age-distribution'], colorRange: { min, max } };
            } else if (datasetId === 'population-density') {
                newOptions['population-density'] = { ...base['population-density'], colorRange: { min, max } };
            } else if (datasetId === 'gender') {
                newOptions.gender = { ...base['gender'], colorRange: { min, max } };
            } else if (datasetId === 'house-price') {
                newOptions['house-price'] = { ...base['house-price'], colorRange: { min, max } };
            }
            return newOptions;
        });
    };

    // "ChangeEnd" handler: Updates parent state (expensive)
    const handleRangeChangeEnd = (datasetId: string) => {
        if (!liveOptions) return;

        if (datasetId === 'age-distribution' && liveOptions['age-distribution'].colorRange) {
            onMapOptionsChange('age-distribution', { colorRange: liveOptions['age-distribution'].colorRange });
        } else if (datasetId === 'population-density' && liveOptions['population-density'].colorRange) {
            onMapOptionsChange('population-density', { colorRange: liveOptions['population-density'].colorRange });
        } else if (datasetId === 'gender' && liveOptions.gender.colorRange) {
            onMapOptionsChange('gender', { colorRange: liveOptions.gender.colorRange });
        } else if (datasetId === 'house-price' && liveOptions['house-price'].colorRange) {
            onMapOptionsChange('house-price', { colorRange: liveOptions['house-price'].colorRange });
        }
        setLiveOptions(null);
    };

    // "Input" handler for party percentage
    const handlePartyRangeInput = (min: number, max: number) => {
        const electionType = activeDataset?.type as 'general-election' | 'local-election';
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

        const electionType = activeDataset?.type as 'general-election' | 'local-election';
        if (electionType !== 'general-election' && electionType !== 'local-election') return;

        if (liveOptions[electionType]?.partyPercentageRange) {
            onMapOptionsChange(electionType, {
                partyPercentageRange: liveOptions[electionType].partyPercentageRange
            });
        }
        setLiveOptions(null);
    };

    const renderPopulationLegend = () => {
        const options = displayOptions['age-distribution'];
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
                onRangeInput={(min, max) => handleRangeInput('age-distribution', min, max)}
                onRangeChangeEnd={() => handleRangeChangeEnd('age-distribution')}
            />
        );
    };

    const renderDensityLegend = () => {
        const options = displayOptions['population-density'];
        const currentMin = options?.colorRange?.min ?? 500;
        const currentMax = options?.colorRange?.max ?? 8000;

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
                onRangeInput={(min, max) => handleRangeInput('population-density', min, max)}
                onRangeChangeEnd={() => handleRangeChangeEnd('population-density')}
            />
        );
    };

    const renderGenderLegend = () => {
        const options = displayOptions['gender'];
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

    const renderHousePriceLegend = () => {
        const options = displayOptions['house-price'];
        const currentMin = options?.colorRange?.min ?? 80000;
        const currentMax = options?.colorRange?.max ?? 500000;

        const formatPrice = (value: number) => {
            if (value >= 1000000) {
                return `£${(value / 1000000).toFixed(1)}M`;
            } else if (value >= 1000) {
                return `£${(value / 1000).toFixed(0)}K`;
            }
            return `£${value.toFixed(0)}`;
        };

        return (
            <RangeControl
                min={0}
                max={1000000}
                currentMin={currentMin}
                currentMax={currentMax}
                gradient="linear-gradient(to top, rgb(253,231,37), rgb(94,201,98), rgb(33,145,140), rgb(59,82,139), rgb(68,1,84))"
                labels={[
                    formatPrice(currentMax),
                    formatPrice((currentMax - currentMin) * 0.75 + currentMin),
                    formatPrice((currentMax - currentMin) * 0.5 + currentMin),
                    formatPrice((currentMax - currentMin) * 0.25 + currentMin),
                    formatPrice(currentMin)
                ]}
                onRangeInput={(min, max) => handleRangeInput('house-price', min, max)}
                onRangeChangeEnd={() => handleRangeChangeEnd('house-price')}
            />
        );
    };

    const renderElectionLegend = () => {
        return (
            <div>
                {parties.map((party) => {
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
                            <span className={`text-xs ${isSelected ? 'text-gray-700' : 'text-gray-500'
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
        switch (activeViz.vizId) {
            case 'age-distribution-2020':
            case 'age-distribution-2021':
            case 'age-distribution-2022':
                return renderPopulationLegend();
            case 'population-density-2020':
            case 'population-density-2021':
            case 'population-density-2022':
                return renderDensityLegend();
            case 'gender-2020':
            case 'gender-2021':
            case 'gender-2022':
                return renderGenderLegend();
            case 'house-price-2023':
                return renderHousePriceLegend();
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