// components/population/GenderChart.tsx
import { useMemo } from "react";
import { PopulationDataset } from "@/lib/types";
import GenderBalanceByAge from "./GenderBalanceByAge";
import { WardCodeMapper } from "@/lib/hooks/useWardCodeMapper";

interface GenderChartProps {
	population: PopulationDataset['populationData'];
	wardCode: string;
	setActiveDatasetId: (datasetId: string) => void;
	activeDatasetId: string;
	wardCodeMapper: WardCodeMapper;
}

export default function GenderChart({
	population,
	wardCode,
	setActiveDatasetId,
	activeDatasetId,
	wardCodeMapper
}: GenderChartProps) {
	const isActive = activeDatasetId === 'gender';
	const colors = {
		bg: 'bg-emerald-50/60',
		border: 'border-emerald-300',
		badge: 'bg-emerald-300 text-emerald-900',
		text: 'bg-emerald-200 text-emerald-800'
	};

	// Calculate total males and females
	const { totalMales, totalFemales } = useMemo(() => {
		let males = 0;
		let females = 0;

		if (wardCode) {
			// Try to find the ward data - population uses 2021 codes
			const codesToTry = [
				wardCode,
				wardCodeMapper.convertWardCode(wardCode, 2021)
			].filter((code): code is string => code !== null);

			for (const code of codesToTry) {
				if (population[code]) {
					const ward = population[code];
					males = Object.values(ward.males).reduce((sum, count) => sum + count, 0);
					females = Object.values(ward.females).reduce((sum, count) => sum + count, 0);
					break; // Found the data, stop looking
				}
			}
		} else {
			// Aggregate all wards
			for (const ward of Object.values(population)) {
				males += Object.values(ward.males).reduce((sum, count) => sum + count, 0);
				females += Object.values(ward.females).reduce((sum, count) => sum + count, 0);
			}
		}

		return { totalMales: males, totalFemales: females };
	}, [population, wardCode, wardCodeMapper]);

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
				<span className="text-[10px] text-gray-600 mr-1">
					<span className="text-blue-600">{totalMales.toLocaleString()}</span> / <span className="text-pink-600">{totalFemales.toLocaleString()}</span>
				</span>
			</div>
			<GenderBalanceByAge
				population={population}
				wardCode={wardCode}
				wardCodeMapper={wardCodeMapper}
			/>
		</div>
	);
}