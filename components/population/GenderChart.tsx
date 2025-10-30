// components/population/PopulationSummary.tsx

import { Dataset, PopulationWardData } from "@/lib/types";
import GenderBalanceByAge from "./GenderBalanceByAge";

interface GenderChartProps {
	population: PopulationWardData;
	wardCode: string;
	wardName: string;
	wardCodeMap: { [name: string]: string };
	ageData: { [age: string]: number };
	onDatasetChange: (datasetId: string) => void;
	activeDataset: Dataset
}

export default function GenderChart({ population, wardCode, wardName, wardCodeMap, onDatasetChange, activeDataset }: GenderChartProps) {
	const isActive = activeDataset.type === 'population';
	const colors = { bg: 'bg-emerald-50/60', border: 'border-emerald-300', badge: 'bg-emerald-300 text-emerald-900', text: 'bg-emerald-200 text-emerald-800' };
	return (
		<div
			// className="p-2 h-[95px] rounded transition-all cursor-pointer bg-white/60 border-2 border-gray-200/80"
			className={`p-2 rounded transition-all cursor-pointer ${isActive
				? `${colors.bg} border-2 ${colors.border}`
				: `bg-white/60 border-2 border-gray-200/80 hover:${colors.border.replace('border-', 'hover:border-')}`
				}`}
			onClick={() => onDatasetChange('population')}
		>
			<div className="flex items-center justify-between mb-0">
				<h3 className="text-xs font-bold">Gender (2020)</h3>
			</div>

			<GenderBalanceByAge
				population={population}
				wardCode={wardCode}
				wardName={wardName}
				wardCodeMap={wardCodeMap}
			/>
		</div>
	);
}