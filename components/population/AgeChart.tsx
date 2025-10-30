// components/population/PopulationSummary.tsx

import { AgeGroups, Dataset } from "@/lib/types";
import AgeDistributionChart from "./AgeDistributionChart";

interface PopulationSummaryProps {
	ageData: { [age: string]: number };
	total: number;
	ageGroups: AgeGroups;
	males: number;
	females: number;
	onDatasetChange: (datasetId: string) => void;
	activeDataset: Dataset
}

export default function AgeChart({ ageData, total, ageGroups, males, females, onDatasetChange, activeDataset }: PopulationSummaryProps) {
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
			<div className="flex items-center justify-between mb-2">
				<h3 className="text-xs font-bold">Age Distribution (2020)</h3>
			</div>

			<AgeDistributionChart ageData={ageData} total={total} ageGroups={ageGroups} />
		</div>
	);
}