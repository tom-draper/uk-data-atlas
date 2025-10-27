// components/population/NoDataView.tsx

export default function NoDataView() {
	return (
		<div className="p-2 h-[95px] rounded transition-all cursor-pointer bg-white/60 border-2 border-gray-200/80">
			<div className="flex items-center justify-between mb-1.5">
				<h3 className="text-xs font-bold">Population (2020)</h3>
			</div>
			<div className="text-xs text-gray-400 pt-3 text-center">
				No data available
			</div>
		</div>
	);
}