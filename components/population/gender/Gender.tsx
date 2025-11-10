// components/population/gender/Gender.tsx
import { useMemo } from "react";
import { AggregatedPopulationData, PopulationDataset } from "@/lib/types";
import GenderBalanceByAgeChart from "./GenderBalanceByAgeChart";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";

interface GenderProps {
	dataset: PopulationDataset;
	aggregatedData: AggregatedPopulationData | null;
	wardCode: string;
	setActiveDatasetId: (datasetId: string) => void;
	activeDatasetId: string;
	codeMapper: CodeMapper;
}

export default function Gender({
	dataset,
	aggregatedData,
	wardCode,
	setActiveDatasetId,
	activeDatasetId,
	codeMapper
}: GenderProps) {
	const isActive = activeDatasetId === 'gender';
	const colors = {
		bg: 'bg-emerald-50/60',
		border: 'border-emerald-300',
		badge: 'bg-emerald-300 text-emerald-900',
		text: 'bg-emerald-200 text-emerald-800'
	};

	// Calculate total males and females
	const { totalMales, totalFemales } = useMemo(() => {
		if (wardCode && dataset) {
			let males = 0;
			let females = 0;

			// Try to find the ward data - population uses 2021 codes
			const codesToTry = [
				wardCode,
				codeMapper.convertWardCode(wardCode, 2021)
			].filter((code): code is string => code !== null);

			for (const code of codesToTry) {
				if (dataset.populationData[code]) {
					const ward = dataset.populationData[code];
					males = Object.values(ward.males).reduce((sum, count) => sum + count, 0);
					females = Object.values(ward.females).reduce((sum, count) => sum + count, 0);
					break
				}
			}

			return { totalMales: males, totalFemales: females }
		} else if (aggregatedData) {
			return { totalMales: aggregatedData[2020].populationStats.males, totalFemales: aggregatedData[2020].populationStats.females }
		} else {
			return { totalMales: 0, totalFemales: 0 }
		}
	}, [dataset, wardCode, codeMapper]);

	return (
		<div
			className={`p-2 rounded transition-all cursor-pointer ${isActive
				? `${colors.bg} border-2 ${colors.border}`
				: `bg-white/60 border-2 border-gray-200/80 hover:${colors.border.replace('border-', 'hover:border-')}`
				}`}
			onClick={() => setActiveDatasetId('gender')}
		>
			<div className="flex items-center justify-between mb-0">
				<h3 className="text-xs font-bold">Gender (2020)</h3>
				{totalMales + totalFemales > 0 && (
					<span className="text-[10px] text-gray-600 mr-1">
						<span className="text-blue-600">{totalMales.toLocaleString()}</span> <span className="text-gray-500">/</span> <span className="text-pink-600">{totalFemales.toLocaleString()}</span>
					</span>
				)}
			</div>
			<GenderBalanceByAgeChart
				dataset={dataset}
				aggregatedData={aggregatedData}
				wardCode={wardCode}
				codeMapper={codeMapper}
			/>
		</div>
	);
}