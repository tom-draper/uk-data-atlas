// components/population/AgeChart.tsx
import { useMemo } from "react";
import { AgeGroups, Dataset } from "@/lib/types";
import AgeDistributionChart from "./AgeDistributionChart";

interface AgeChartProps {
	activeDataset: Dataset
	ageData: { [age: string]: number };
	total: number;
	ageGroups: AgeGroups;
	setActiveDatasetId: (datasetId: string) => void;
}

export default function AgeChart({ ageData, total, ageGroups, setActiveDatasetId, activeDataset }: AgeChartProps) {
	const isActive = activeDataset.type === 'population';
	const colors = {
		bg: 'bg-emerald-50/60',
		border: 'border-emerald-300',
		badge: 'bg-emerald-300 text-emerald-900',
		text: 'bg-emerald-200 text-emerald-800'
	};

	const medianAge = useMemo(() => {
		const ages = Array.from({ length: 100 }, (_, i) => ({
			age: i,
			count: ageData[i.toString()] || 0
		}));

		// Distribute 90+ population with exponential decay
		const age90Plus = ages[90].count;
		const decayRate = 0.15;
		const weights = Array.from({ length: 10 }, (_, i) => Math.exp(-decayRate * i));
		const totalWeight = weights.reduce((sum, w) => sum + w, 0);
		for (let i = 90; i < 100; i++) {
			const weight = weights[i - 90];
			ages[i] = { age: i, count: (age90Plus * weight) / totalWeight };
		}

		const totalPop = ages.reduce((sum, { count }) => sum + count, 0);
		if (totalPop === 0) return 0;

		const halfPop = totalPop / 2;
		let cumulative = 0;

		for (const { age, count } of ages) {
			cumulative += count;
			if (cumulative >= halfPop) {
				return age;
			}
		}
		return 0;
	}, [ageData]);

	return (
		<div
			className={`p-2 rounded transition-all cursor-pointer ${isActive
				? `${colors.bg} border-2 ${colors.border}`
				: `bg-white/60 border-2 border-gray-200/80 hover:${colors.border.replace('border-', 'hover:border-')}`
				}`}
			onClick={() => setActiveDatasetId('population')}
		>
			<div className="flex items-center justify-between mb-2">
				<h3 className="text-xs font-bold">Age Distribution (2020)</h3>
				<span className="text-[10px] text-gray-400/80 mr-1">
					Median: <span className="font-semibold">{medianAge}</span>
				</span>
			</div>
			<AgeDistributionChart ageData={ageData} total={total} ageGroups={ageGroups} />
		</div>
	);
}