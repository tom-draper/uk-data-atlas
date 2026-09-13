"use client";
import { ChartCardValueBar } from "@/components/ChartCardValueBar";
import { ChartCard } from "@/components/ChartCard";
import { useChartsLoading } from "@/components/ChartLoadingPlaceholder";
import { useIsDark } from "@/lib/context/ThemeContext";
import { hexToRgb, rgbToHex } from "@/lib/helpers/colorScale/interpolation";

const LEAST_DEPRIVED = "#15803d";
const MID_DEPRIVATION = "#eab308";
const MOST_DEPRIVED = "#dc2626";

function mixColors(start: string, end: string, amount: number) {
	const from = hexToRgb(start);
	const to = hexToRgb(end);
	return rgbToHex(
		from.r + (to.r - from.r) * amount,
		from.g + (to.g - from.g) * amount,
		from.b + (to.b - from.b) * amount,
	);
}

export function deprivationColor(severity: number) {
	const normalized = Math.max(0, Math.min(1, severity));
	return normalized <= 0.5
		? mixColors(LEAST_DEPRIVED, MID_DEPRIVATION, normalized * 2)
		: mixColors(MID_DEPRIVATION, MOST_DEPRIVED, (normalized - 0.5) * 2);
}

interface DecileChartProps {
	title: string;
	heading: string;
	region: string;
	hasData: boolean;
	value: string | number;
	unit: string;
	secondary?: string;
	barWidth: number;
	/** From 0, least deprived, to 1, most deprived; sets the colour. */
	severity: number;
	/** Colour the headline value itself, when it is the decile. */
	colorValue?: boolean;
	isActive: boolean;
	onClick: () => void;
}

export default function DecileChart({
	title,
	heading,
	region,
	hasData,
	value,
	unit,
	secondary,
	barWidth,
	severity,
	colorValue = false,
	isActive,
	onClick,
}: DecileChartProps) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();

	const showData = hasData && !chartsLoading;
	const color = hasData ? deprivationColor(severity) : "#9ca3af";

	return (
		<ChartCard
			heading={heading}
			headerEnd={
				<span
					className={`text-[9px] shrink-0 ml-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}
				>
					{region}
				</span>
			}
			accent={showData ? color : null}
			isActive={isActive}
			title={title}
			onClick={onClick}
		>
			<ChartCardValueBar
				hasData={showData}
				value={value}
				unit={unit}
				secondary={secondary}
				barWidth={barWidth}
				barColor={color}
				valueColor={colorValue ? color : undefined}
				secondaryColor={secondary ? color : undefined}
			/>
		</ChartCard>
	);
}
