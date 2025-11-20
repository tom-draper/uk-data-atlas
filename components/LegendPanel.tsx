// components/LegendPanel.tsx
'use client';

import { memo, useMemo, useState, useRef, useEffect } from 'react';
import { PARTIES } from '@/lib/data/election/parties';
import { themes } from '@/lib/utils/colorScale'; // Import themes
import type { MapOptions } from '@/lib/types/mapOptions';
import { ActiveViz, AggregatedData, Dataset } from '@/lib/types';

interface LegendPanelProps {
    activeDataset: Dataset | null;
    activeViz: ActiveViz;
    aggregatedData: AggregatedData;
    mapOptions: MapOptions;
    onMapOptionsChange: (type: keyof MapOptions, options: Partial<MapOptions[typeof type]>) => void;
}

// --- Helper: Range Control Component ---
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
        // Flip percentage because DOM Y coordinates go down, but graph Y goes up
        return max - (percentage * (max - min));
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDraggingMin) {
                // Ensure min doesn't cross max (with 5% buffer)
                const newMin = Math.min(getValueFromPosition(e.clientY), currentMax - (max - min) * 0.05);
                // Ensure min doesn't go below absolute min
                onRangeInput(Math.max(newMin, min), currentMax);
            } else if (isDraggingMax) {
                // Ensure max doesn't cross min
                const newMax = Math.max(getValueFromPosition(e.clientY), currentMin + (max - min) * 0.05);
                // Ensure max doesn't go above absolute max
                onRangeInput(currentMin, Math.min(newMax, max));
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
        <div className="p-2.5 relative select-none">
            <div ref={containerRef} className="h-40 w-6 rounded-md relative" style={{ background: gradient }}>
                {/* Max handle */}
                <div
                    className="absolute left-0 w-full h-0.5 bg-white shadow-md cursor-ns-resize group z-10"
                    style={{ top: `${maxPosition}%`, transform: 'translateY(-50%)' }}
                    onMouseDown={(e) => { e.preventDefault(); setIsDraggingMax(true); }}
                >
                    <div className="absolute -left-1 -top-1.5 w-8 h-4 flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full shadow-md border border-gray-300 group-hover:scale-125 transition-transform" />
                    </div>
                </div>

                {/* Min handle */}
                <div
                    className="absolute left-0 w-full h-0.5 bg-white shadow-md cursor-ns-resize group z-10"
                    style={{ top: `${minPosition}%`, transform: 'translateY(-50%)' }}
                    onMouseDown={(e) => { e.preventDefault(); setIsDraggingMin(true); }}
                >
                    <div className="absolute -left-1 -top-1.5 w-8 h-4 flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full shadow-md border border-gray-300 group-hover:scale-125 transition-transform" />
                    </div>
                </div>
            </div>

            {/* Labels */}
            <div className="flex flex-col justify-between h-40 text-[10px] text-gray-400/80 -mt-40 ml-8 pointer-events-none">
                {labels.map((label, i) => (
                    <span key={i} className="whitespace-nowrap drop-shadow-sm">{label}</span>
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
    const [liveOptions, setLiveOptions] = useState<MapOptions | null>(null);

    // 1. Resolve Options
    const displayOptions = liveOptions || mapOptions;
    
    // 2. Resolve Theme Gradient
    const themeId = displayOptions.general?.theme || 'viridis';
    const activeTheme = useMemo(() => themes.find(t => t.id === themeId) || themes[0], [themeId]);
    
    // Construct a vertical gradient based on the active theme's colors
    const verticalThemeGradient = useMemo(() => 
        `linear-gradient(to bottom, ${activeTheme.colors.join(', ')})`, 
    [activeTheme]);

    // 3. Resolve Election Parties
    const parties = useMemo(() => {
        if (!activeDataset || !aggregatedData[activeDataset.type as keyof AggregatedData]) return [];
        // Safe access to nested data
        const datasetData = aggregatedData[activeDataset.type as keyof AggregatedData];
        // @ts-ignore - complex union type handling
        const yearData = datasetData?.[activeDataset.year]; 
        
        if (!yearData?.partyVotes) return [];
        
        return Object.entries(yearData.partyVotes)
            .filter(([_, votes]) => (votes as number) > 0)
            .sort((a, b) => (b[1] as number) - (a[1] as number))
            .map(([id]) => ({
                id,
                color: PARTIES[id]?.color || '#ccc',
                name: PARTIES[id]?.name || id,
            }));
    }, [aggregatedData, activeDataset]);

    // --- Handlers ---

    const handleRangeInput = (datasetKey: keyof MapOptions, min: number, max: number) => {
        setLiveOptions(prev => {
            const base = prev || mapOptions;
            return {
                ...base,
                [datasetKey]: { 
                    ...base[datasetKey], 
                    colorRange: { min, max } 
                }
            };
        });
    };

    const handleRangeChangeEnd = (datasetKey: keyof MapOptions) => {
        if (!liveOptions) return;
        // @ts-ignore - Dynamic key access
        const range = liveOptions[datasetKey]?.colorRange;
        if (range) {
            onMapOptionsChange(datasetKey, { colorRange: range });
        }
        setLiveOptions(null);
    };

    const handlePartyClick = (partyCode: string) => {
        const type = activeDataset?.type as 'general-election' | 'local-election';
        if (!type) return;

        const currentMode = displayOptions[type].mode;
        const currentParty = displayOptions[type].selectedParty;

        if (currentMode === 'party-percentage' && currentParty === partyCode) {
            onMapOptionsChange(type, { mode: 'winner', selectedParty: undefined });
        } else {
            onMapOptionsChange(type, { mode: 'party-percentage', selectedParty: partyCode });
        }
    };

    // --- Renderers ---

    // Generic Renderer for Age, Density, House Prices (DRY principle)
    const renderDynamicLegend = (
        datasetKey: keyof MapOptions,
        absMin: number,
        absMax: number,
        defaultMin: number,
        defaultMax: number,
        formatLabel: (v: number) => string = (v) => v.toFixed(0)
    ) => {
        // @ts-ignore
        const currentMin = displayOptions[datasetKey]?.colorRange?.min ?? defaultMin;
        // @ts-ignore
        const currentMax = displayOptions[datasetKey]?.colorRange?.max ?? defaultMax;

        return (
            <RangeControl
                min={absMin}
                max={absMax}
                currentMin={currentMin}
                currentMax={currentMax}
                gradient={verticalThemeGradient}
                labels={[
                    formatLabel(currentMax),
                    formatLabel((currentMax - currentMin) * 0.75 + currentMin),
                    formatLabel((currentMax - currentMin) * 0.5 + currentMin),
                    formatLabel((currentMax - currentMin) * 0.25 + currentMin),
                    formatLabel(currentMin)
                ]}
                onRangeInput={(min, max) => handleRangeInput(datasetKey, min, max)}
                onRangeChangeEnd={() => handleRangeChangeEnd(datasetKey)}
            />
        );
    };

    const renderGenderLegend = () => {
        const currentMin = displayOptions.gender?.colorRange?.min ?? -0.1;
        const currentMax = displayOptions.gender?.colorRange?.max ?? 0.1;
        // Gender keeps its specific Pink/Blue gradient regardless of theme
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
        const type = activeDataset?.type as 'general-election' | 'local-election';
        const options = displayOptions[type];

        return (
            <div className="flex flex-col max-h-[60vh] gap-1 overflow-y-auto py-1 px-1">
                {parties.map((party) => {
                    const isSelected = options?.mode === 'party-percentage' && options.selectedParty === party.id;
                    return (
                        <button
                            key={party.id}
                            onClick={() => handlePartyClick(party.id)}
                            className={`flex items-center gap-2 px-1.5 py-0.5 w-full text-left rounded-xs transition-all cursor-pointer ${
                                isSelected ? 'bg-gray-100 ring-1 ring-gray-300' : 'hover:bg-gray-50'
                            }`}
                        >
                            <div
                                className="w-3 h-3 rounded-xs shrink-0"
                                style={{ backgroundColor: party.color }}
                            />
                            <span className={`text-xs ${isSelected ? 'text-gray-800' : 'text-gray-600'}`}>
                                {party.name}
                            </span>
                        </button>
                    );
                })}
            </div>
        );
    };

    const renderLegendContent = () => {
        if (!activeDataset) return null;

        const formatCurrency = (val: number) => {
            if (val >= 1_000_000) return `£${(val / 1_000_000).toFixed(1)}M`;
            if (val >= 1_000) return `£${(val / 1_000).toFixed(0)}K`;
            return `£${val.toFixed(0)}`;
        };

        switch (activeDataset.type) {
            case 'population':
                if (activeViz.vizId.startsWith('age-distribution')) {
                    return renderDynamicLegend('age-distribution', 18, 80, 25, 55);
                }
                if (activeViz.vizId.startsWith('population-density')) {
                    return renderDynamicLegend('population-density', 0, 15000, 500, 8000);
                }
                if (activeViz.vizId.startsWith('gender')) {
                    return renderGenderLegend();
                }
                return null;

            case 'house-price':
                return renderDynamicLegend('house-price', 0, 2000000, 80000, 500000, formatCurrency);

            case 'general-election':
            case 'local-election':
                return renderElectionLegend();

            default:
                return null;
        }
    };

    return (
        <div className="pointer-events-none p-2.5 pr-0 flex flex-col h-full gap-2.5">
            <div className="bg-white/80 pointer-events-auto rounded-lg backdrop-blur-md shadow-xl border border-white/40">
                <div className="p-2 overflow-hidden">
                    {renderLegendContent()}
                </div>
            </div>

            {/* Special secondary legend for Election Party Percentage Mode */}
            {['general-election', 'local-election'].includes(activeDataset?.type || '') && 
             displayOptions[activeDataset!.type as 'general-election' | 'local-election']?.mode === 'party-percentage' && (
                <div className="bg-white/80 pointer-events-auto rounded-lg backdrop-blur-md shadow-xl border border-white/40 w-fit ml-auto">
                     <div className="overflow-hidden">
                        <RangeControl
                            min={0}
                            max={100}
                            // @ts-ignore
                            currentMin={displayOptions[activeDataset.type].partyPercentageRange?.min ?? 0}
                            // @ts-ignore
                            currentMax={displayOptions[activeDataset.type].partyPercentageRange?.max ?? 100}
                            gradient={`linear-gradient(to bottom, ${
                                // @ts-ignore
                                PARTIES[displayOptions[activeDataset.type].selectedParty]?.color || '#999'
                            }, #f5f5f5)`}
                            labels={['100%', '75%', '50%', '25%', '0%']}
                            onRangeInput={(min, max) => {
                                setLiveOptions(prev => {
                                    const base = prev || mapOptions;
                                    const type = activeDataset!.type as 'general-election';
                                    return { ...base, [type]: { ...base[type], partyPercentageRange: { min, max } } };
                                });
                            }}
                            onRangeChangeEnd={() => {
                                if (!liveOptions) return;
                                const type = activeDataset!.type as 'general-election';
                                // @ts-ignore
                                onMapOptionsChange(type, { partyPercentageRange: liveOptions[type].partyPercentageRange });
                                setLiveOptions(null);
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
});