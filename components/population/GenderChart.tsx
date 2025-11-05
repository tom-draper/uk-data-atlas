// components/population/GenderChart.tsx
import { useMemo } from "react";
import { Dataset, PopulationWardData } from "@/lib/types";
import { resolveWardCode } from "@/lib/utils/populationHelpers";
import GenderBalanceByAge from "./GenderBalanceByAge";
import { GeneralElectionDataset } from "@/lib/hooks/useGeneralElectionData";

interface GenderChartProps {
	population: PopulationWardData;
	wardCode: string;
	wardName: string;
	onDatasetChange: (datasetId: string) => void;
	activeDataset: Dataset
}

export default function GenderChart({ population, wardCode, wardName, onDatasetChange, activeDataset }: GenderChartProps) {
	const isActive = activeDataset.type === 'population';
	const colors = { 
		bg: 'bg-emerald-50/60', 
		border: 'border-emerald-300', 
		badge: 'bg-emerald-300 text-emerald-900', 
		text: 'bg-emerald-200 text-emerald-800' 
	};
	
	// Calculate total males and females
	const { totalMales, totalFemales } = useMemo(() => {
		const resolvedCode = resolveWardCode(wardCode, wardName, population, {});
		let males = 0;
		let females = 0;

		if (resolvedCode && population[resolvedCode]) {
			const ward = population[resolvedCode];
			males = Object.values(ward.males).reduce((sum, count) => sum + count, 0);
			females = Object.values(ward.females).reduce((sum, count) => sum + count, 0);
		} else if (!wardCode) {
			// Aggregate all wards
			for (const ward of Object.values(population)) {
				males += Object.values(ward.males).reduce((sum, count) => sum + count, 0);
				females += Object.values(ward.females).reduce((sum, count) => sum + count, 0);
			}
		}

		return { totalMales: males, totalFemales: females };
	}, [population, wardCode, wardName]);

	return (
		<div
			className={`p-2 rounded transition-all cursor-pointer ${isActive
				? `${colors.bg} border-2 ${colors.border}`
				: `bg-white/60 border-2 border-gray-200/80 hover:${colors.border.replace('border-', 'hover:border-')}`
				}`}
			onClick={() => onDatasetChange('population')}
		>
			<div className="flex items-center justify-between mb-0">
				<h3 className="text-xs font-bold">Gender (2020)</h3>
				<span className="text-[10px] text-gray-600">
					<span className="text-blue-600">{totalMales.toLocaleString()}</span> / <span className="text-pink-600">{totalFemales.toLocaleString()}</span>
				</span>
			</div>
			<GenderBalanceByAge
				population={population}
				wardCode={wardCode}
				wardName={wardName}
			/>
		</div>
	);
}