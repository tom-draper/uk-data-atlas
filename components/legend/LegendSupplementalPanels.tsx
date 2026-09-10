"use client";

import { RangeControl } from "@/components/controls/RangeControl";
import { useIsDark } from "@/lib/context/ThemeContext";
import { glassStyle, panelTheme } from "@/lib/helpers/panelTheme";
import GlassOverlays from "../GlassOverlays";

export function PercentageRangePanel({
	range,
	gradient,
	opacity,
	onRangeInput,
	onRangeChangeEnd,
}: {
	range: { min: number; max: number };
	gradient: string;
	opacity: number;
	onRangeInput: (min: number, max: number) => void;
	onRangeChangeEnd: () => void;
}) {
	const isDark = useIsDark();
	const theme = panelTheme(isDark);
	return (
		<div
			className={`pointer-events-auto rounded-md w-fit ml-auto relative overflow-hidden ${isDark ? "text-gray-100" : "text-gray-800"}`}
			style={glassStyle(isDark)}
		>
			<GlassOverlays isDark={isDark} />
			<div
				className={`relative ${theme.section} p-1 overflow-hidden`}
				style={{ zIndex: 1 }}
			>
				<RangeControl
					min={0}
					max={100}
					currentMin={range.min}
					currentMax={range.max}
					gradient={gradient}
					labels={[
						`${range.max.toFixed(0)}%`,
						"",
						"",
						"",
						`${range.min.toFixed(0)}%`,
					]}
					opacity={opacity}
					onRangeInput={onRangeInput}
					onRangeChangeEnd={onRangeChangeEnd}
				/>
			</div>
		</div>
	);
}

type MeasureOption<Value extends string> = readonly [Value, string];

function GlassSegmentedMeasurePanel<Value extends string>({
	measure,
	measures,
	onChange,
}: {
	measure: Value;
	measures: readonly MeasureOption<Value>[];
	onChange: (measure: Value) => void;
}) {
	const isDark = useIsDark();
	const theme = panelTheme(isDark);
	const selectedClass = isDark
		? "border-white/25 bg-white/15 text-gray-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.32),inset_0_-1px_0_rgba(0,0,0,0.18),0_2px_5px_rgba(0,0,0,0.28)]"
		: "border-white/60 bg-white/35 text-gray-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.85),inset_0_-1px_0_rgba(0,0,0,0.06),0_2px_5px_rgba(15,23,42,0.14)]";

	return (
		<div
			className={`pointer-events-auto rounded-md w-fit ml-auto relative overflow-hidden ${isDark ? "text-gray-100" : "text-gray-800"}`}
			style={glassStyle(isDark)}
		>
			<GlassOverlays isDark={isDark} />
			<div
				className={`relative ${theme.section} flex rounded-sm p-1 text-xs`}
				style={{ zIndex: 1 }}
			>
				{measures.map(([value, label]) => {
					const isSelected = measure === value;
					return (
						<button
							type="button"
							key={value}
							aria-pressed={isSelected}
							onClick={() => onChange(value)}
							className={`cursor-pointer rounded-sm border px-2 py-1 backdrop-blur-md transition-all duration-200 ${isSelected ? selectedClass : isDark ? "border-transparent text-gray-400 hover:bg-white/10" : "border-transparent text-gray-500 hover:bg-white/20"}`}
						>
							{label}
						</button>
					);
				})}
			</div>
		</div>
	);
}

const HOUSE_PRICE_MEASURES = [
	["median", "Median"],
	["mean", "Mean"],
] as const;

export function HousePriceMeasurePanel({
	measure,
	onChange,
}: {
	measure: "median" | "mean";
	onChange: (measure: "median" | "mean") => void;
}) {
	return (
		<GlassSegmentedMeasurePanel
			measure={measure}
			measures={HOUSE_PRICE_MEASURES}
			onChange={onChange}
		/>
	);
}

const LIFE_EXPECTANCY_MEASURES = [
	["average", "Average"],
	["male", "Male"],
	["female", "Female"],
] as const;

export function LifeExpectancyMeasurePanel({
	measure,
	onChange,
}: {
	measure: "average" | "male" | "female";
	onChange: (measure: "average" | "male" | "female") => void;
}) {
	return (
		<GlassSegmentedMeasurePanel
			measure={measure}
			measures={LIFE_EXPECTANCY_MEASURES}
			onChange={onChange}
		/>
	);
}
