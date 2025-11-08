// components/population/age/AgeGroupBar.tsx
interface AgeGroupBarProps {
	label: string;
	value: number;
	total: number;
	color: string;
}

export default function AgeGroupBar({ label, value, total, color }: AgeGroupBarProps) {
	const percentage = total > 0 ? (value / total) * 100 : 0;

	return (
		<div className="flex items-center gap-2">
			<div className="w-16 text-[10px] font-medium text-gray-600">{label}</div>
			<div className="flex-1 flex items-center gap-2">
				<div className="flex-1 h-4 bg-gray-200 rounded overflow-hidden">
					<div
						className="h-full transition-all"
						style={{ width: `${percentage}%`, backgroundColor: color }}
					/>
				</div>
				<div className="w-14 text-[10px] font-bold text-right">
					{value.toLocaleString()}
				</div>
			</div>
		</div>
	);
}