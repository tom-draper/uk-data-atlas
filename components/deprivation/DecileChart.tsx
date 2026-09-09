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
	decile: number | null;
	detail: { value: string; unit: string } | null;
	barWidth: number;
	hasData: boolean;
	isActive: boolean;
	onClick: () => void;
}

export default function DecileChart({
	title,
	heading,
	region,
	decile,
	detail,
	barWidth,
	hasData,
	isActive,
	onClick,
}: DecileChartProps) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();

	const showData = hasData && !chartsLoading;
	const displayDecile = decile ? 11 - decile : null;
	const decileColor = displayDecile
		? deprivationColor(barWidth / 100)
		: "#9ca3af";
	const primaryIsDecile = detail === null;

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
			accent={showData ? decileColor : null}
			isActive={isActive}
			title={title}
			onClick={onClick}
		>
			<ChartCardValueBar
				hasData={showData}
				value={detail?.value ?? displayDecile ?? ""}
				unit={detail?.unit ?? "decile"}
				secondary={detail ? `Decile ${displayDecile}` : undefined}
				barWidth={barWidth}
				barColor={decileColor}
				valueColor={primaryIsDecile ? decileColor : undefined}
				secondaryColor={detail ? decileColor : undefined}
			/>
		</ChartCard>
	);
}
