'use client';

import { ActiveViz, EthnicityDataset, SelectedArea, EthnicityCategory, Ethnicity } from '@/lib/types';
import { useMemo, memo } from 'react';

// Ethnicity subcategory colors
const ETHNICITY_COLORS: Record<string, string> = {
    // Asian subcategories - Blues
    'Bangladeshi': '#0ea5e9',      // Sky blue
    'Chinese': '#3b82f6',          // Blue
    'Indian': '#1d4ed8',           // Deep blue
    'Pakistani': '#60a5fa',        // Light blue
    'Other Asian': '#93c5fd',      // Lighter blue
    
    // Black subcategories - Greens/Teals
    'African': '#14b8a6',          // Teal
    'Caribbean': '#10b981',        // Emerald
    'Other Black': '#34d399',      // Light green
    
    // Mixed subcategories - Oranges/Ambers
    'White and Asian': '#f97316',           // Orange
    'White and Black African': '#fb923c',   // Light orange
    'White and Black Caribbean': '#fdba74', // Lighter orange
    'Other Mixed or Multiple ethnic groups': '#fbbf24', // Amber
    
    // White subcategories - Purples
    'English, Welsh, Scottish, Northern Irish or British': '#8b5cf6', // Violet
    'Irish': '#a78bfa',                     // Light violet
    'Gypsy or Irish Traveller': '#c4b5fd',  // Lighter violet
    'Roma': '#ddd6fe',                      // Very light violet
    'Other White': '#6366f1',               // Indigo
    
    // Other subcategories - Pinks/Roses
    'Arab': '#ec4899',             // Pink
    'Any other ethnic group': '#f472b6', // Light pink
};

const YEAR_STYLES = {
    bg: 'bg-indigo-50/60',
    border: 'border-indigo-300',
};

interface ProcessedEthnicityData {
    ethnicity: string;
    color: string;
    population: number;
    percentage: number;
    parentCategory: string;
}

const EthnicityBar = memo(({ data }: { data: ProcessedEthnicityData[] }) => (
    <div className="flex h-5 rounded overflow-hidden bg-gray-200 gap-0 w-full">
        {data.map((item, idx) => (
            <div
                key={`${item.parentCategory}-${item.ethnicity}-${idx}`}
                style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                title={`${item.ethnicity}: ${item.population.toLocaleString()} (${item.percentage.toFixed(1)}%)`}
                className="group relative hover:opacity-80 transition-opacity"
            >
                {item.percentage > 5 && (
                    <span className="text-white text-[9px] font-bold px-0.5 leading-5 truncate block">
                        {item.percentage.toFixed(0)}%
                    </span>
                )}
            </div>
        ))}
    </div>
));
EthnicityBar.displayName = 'EthnicityBar';

const Legend = memo(({ ethnicityData }: { ethnicityData: ProcessedEthnicityData[] }) => (
    <div className="animate-in fade-in duration-200 mt-1">
        <div className="grid grid-cols-3 gap-0.5 text-[9px]">
            {ethnicityData.map((item, idx) => (
                <div key={`${item.parentCategory}-${item.ethnicity}-${idx}`} className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="truncate font-medium" title={item.ethnicity}>
                        {item.ethnicity}: {item.population.toLocaleString()}
                    </span>
                </div>
            ))}
        </div>
    </div>
));
Legend.displayName = 'Legend';

interface EthnicityChartProps {
    dataset: EthnicityDataset;
    selectedArea: SelectedArea | null;
    activeViz: ActiveViz;
    setActiveViz: (value: ActiveViz) => void;
}

export default memo(function EthnicityChart({
    dataset,
    selectedArea,
    activeViz,
    setActiveViz,
}: EthnicityChartProps) {
    const vizId = dataset.id;
    const isActive = activeViz.vizId === vizId;

    // Process ethnicity data - flatten all subcategories
    const processedData = useMemo(() => {
        const ladCode = selectedArea?.code;
        
        if (!ladCode || !dataset.localAuthorityData[ladCode]) {
            return { hasData: false, ethnicityData: [], totalPopulation: 0 };
        }

        const areaData = dataset.localAuthorityData[ladCode];
        const allEthnicities: ProcessedEthnicityData[] = [];
        
        // Flatten all subcategories and assign individual colors
        for (const [parentCategory, subcategories] of Object.entries(areaData)) {
            for (const ethnicity of Object.values(subcategories as EthnicityCategory)) {
                allEthnicities.push({
                    ethnicity: ethnicity.ethnicity,
                    color: ETHNICITY_COLORS[ethnicity.ethnicity] || '#6b7280',
                    population: ethnicity.population,
                    percentage: 0, // Will calculate after we have total
                    parentCategory,
                });
            }
        }

        const totalPopulation = allEthnicities.reduce((sum, item) => sum + item.population, 0);

        if (totalPopulation === 0) {
            return { hasData: false, ethnicityData: [], totalPopulation: 0 };
        }

        // Calculate percentages and sort by population
        const ethnicityData = allEthnicities
            .map(item => ({
                ...item,
                percentage: (item.population / totalPopulation) * 100,
            }))
            .sort((a, b) => b.population - a.population);

        return { hasData: true, ethnicityData, totalPopulation };
    }, [dataset, selectedArea]);

    const heightClass = isActive ? 'h-[95px]' : 'h-[65px]';

    const handleActivate = () => {
        setActiveViz({
            vizId: dataset.id,
            datasetType: dataset.type,
            datasetYear: dataset.year
        });
    };

    return (
        <div
            className={`
                p-2 rounded cursor-pointer overflow-hidden border-2 
                ${heightClass}
                ${isActive ? `${YEAR_STYLES.bg} ${YEAR_STYLES.border}` : 'bg-white/60 border-gray-200/80 hover:border-indigo-300'}
            `}
            onClick={handleActivate}
        >
            <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-xs font-bold">{dataset.year} Ethnicity</h3>
                {processedData.hasData && (
                    <span className="text-[9px] text-gray-500 font-medium">
                        Pop: {processedData.totalPopulation.toLocaleString()}
                    </span>
                )}
            </div>

            {!processedData.hasData ? (
                <div className="text-xs text-gray-400/80 pt-0.5 text-center">
                    {selectedArea ? 'No data available' : 'Select an area'}
                </div>
            ) : (
                <div className="space-y-1">
                    <EthnicityBar data={processedData.ethnicityData} />
                    {isActive && <Legend ethnicityData={processedData.ethnicityData} />}
                </div>
            )}
        </div>
    );
});