import { useIsDark } from "@/lib/context/ThemeContext";

type MetricPillProps = {
	label: string;
	value: number | null;
	unit: string;
	format?: (value: number) => string;
};

/** A compact labelled metric used beside a chart card's primary value. */
export function MetricPill({
	label,
	value,
	unit,
	format = (number) => number.toFixed(1),
}: MetricPillProps) {
	const isDark = useIsDark();
	return (
		<div
			className={`flex flex-col items-center px-2 py-1 rounded ${isDark ? "bg-white/5" : "bg-black/5"}`}
		>
			<span
				className={`text-[9px] font-medium ${isDark ? "text-gray-400" : "text-gray-500"}`}
			>
				{label}
			</span>
			<span
				className={`text-xs font-bold ${isDark ? "text-gray-200" : "text-gray-800"}`}
			>
				{value != null ? format(value) : "—"}
				{value != null && (
					<span className="text-[9px] font-normal ml-0.5">
						{unit}
					</span>
				)}
			</span>
		</div>
	);
}
