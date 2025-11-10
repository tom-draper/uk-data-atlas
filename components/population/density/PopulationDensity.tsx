// components/population/density/PopulationDensity.tsx
import { AggregatedPopulationData, BoundaryGeojson } from "@/lib/types";
import PopulationDensityChart from "./PopulationDensityChart";

interface PopulationDensityChartProps {
	activeDatasetId: string;
	geojson: BoundaryGeojson | null;
	aggregatedData: AggregatedPopulationData | null;
	wardCode: string | null;
	setActiveDatasetId: (datasetId: string) => void;
}

export default function PopulationDensity({ aggregatedData, geojson, wardCode, setActiveDatasetId, activeDatasetId }: PopulationDensityChartProps) {
	const isActive = activeDatasetId === 'density';
	const colors = {
		bg: 'bg-emerald-50/60',
		border: 'border-emerald-300',
		badge: 'bg-emerald-300 text-emerald-900',
		text: 'bg-emerald-200 text-emerald-800'
	};

	return (
		<div
			className={`p-2 rounded transition-all cursor-pointer ${isActive
				? `${colors.bg} border-2 ${colors.border}`
				: `bg-white/60 border-2 border-gray-200/80 hover:${colors.border.replace('border-', 'hover:border-')}`
				}`}
			onClick={() => setActiveDatasetId('density')}
		>
			<div className="flex items-center justify-between mb-1.5">
				<h3 className="text-xs font-bold">Population Density (2020)</h3>
			</div>
			<PopulationDensityChart geojson={geojson} wardCode={wardCode} total={aggregatedData[2020]?.populationStats.total} />
		</div>
	);
}