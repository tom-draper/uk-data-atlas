// components/population/PopulationSummary.tsx
import { GeneralElectionDataset } from "@/lib/hooks/useGeneralElectionData";
import { Dataset } from "@/lib/types";

interface PopulationSummaryProps {
	total: number;
	males: number;
	females: number;
	onDatasetChange: (datasetId: string) => void;
	activeDataset: GeneralElectionDataset | Dataset
}

export default function PopulationSummary({ total, males, females, onDatasetChange, activeDataset }: PopulationSummaryProps) {
	const isActive = activeDataset.type === 'population';
	const colors = { 
		bg: 'bg-emerald-50/60', 
		border: 'border-emerald-300', 
		badge: 'bg-emerald-300 text-emerald-900', 
		text: 'bg-emerald-200 text-emerald-800' 
	};
	return (
		<div
			className={`p-2 h-[95px] rounded transition-all cursor-pointer ${isActive
				? `${colors.bg} border-2 ${colors.border}`
				: `bg-white/60 border-2 border-gray-200/80 hover:${colors.border.replace('border-', 'hover:border-')}`
				}`}
			onClick={() => onDatasetChange('population')}
		>
			<div className="flex items-center justify-between mb-5">
				<h3 className="text-xs font-bold">Population (2020)</h3>
			</div>
			<div className="grid grid-cols-3 gap-2 text-center">
				<div>
					<div className="text-[10px] text-gray-500">Total</div>
					<div className="text-sm font-bold text-green-600">{total.toLocaleString()}</div>
				</div>
				<div>
					<div className="text-[10px] text-gray-500">Males</div>
					<div className="text-sm font-bold text-blue-600">{males.toLocaleString()}</div>
				</div>
				<div>
					<div className="text-[10px] text-gray-500">Females</div>
					<div className="text-sm font-bold text-pink-600">{females.toLocaleString()}</div>
				</div>
			</div>
		</div>
	);
}