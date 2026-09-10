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

export function HousePriceMeasurePanel({
	measure,
	onChange,
}: {
	measure: "median" | "mean";
	onChange: (measure: "median" | "mean") => void;
}) {
	const isDark = useIsDark();
	const theme = panelTheme(isDark);
	const isMean = measure === "mean";
	return (
		<div
			className={`pointer-events-auto rounded-md w-fit ml-auto relative overflow-hidden ${isDark ? "text-gray-100" : "text-gray-800"}`}
			style={glassStyle(isDark)}
		>
			<GlassOverlays isDark={isDark} />
			<div
				className={`relative ${theme.section} flex items-center gap-2 p-2 text-xs`}
				style={{ zIndex: 1 }}
			>
				<span className={isMean ? "font-medium" : "text-gray-400"}>
					Mean
				</span>
				<button
					type="button"
					role="switch"
					aria-checked={isMean}
					aria-label="Show mean house prices"
					onClick={() => onChange(isMean ? "median" : "mean")}
					className={`relative h-4 w-7 rounded-full transition-colors ${isMean ? "bg-indigo-500" : isDark ? "bg-gray-600" : "bg-gray-300"}`}
				>
					<span
						className={`absolute top-0.5 left-0.5 size-3 rounded-full bg-white shadow transition-transform ${isMean ? "" : "translate-x-3"}`}
					/>
				</button>
				<span className={isMean ? "text-gray-400" : "font-medium"}>
					Median
				</span>
			</div>
		</div>
	);
}

export function LifeExpectancyMeasurePanel({
	measure,
	onChange,
}: {
	measure: "average" | "male" | "female";
	onChange: (measure: "average" | "male" | "female") => void;
}) {
	const isDark = useIsDark();
	const theme = panelTheme(isDark);
	const measures = [
		["average", "Average"],
		["male", "Male"],
		["female", "Female"],
	] as const;
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
