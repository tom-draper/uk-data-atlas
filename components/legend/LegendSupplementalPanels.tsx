"use client";

import type { WasteOptions } from "@/lib/types/mapOptions";
import { RangeControl } from "@/components/controls/RangeControl";
import { useIsDark } from "@/lib/context/ThemeContext";
import { glassStyle, panelTheme } from "@/lib/helpers/panelTheme";
import { REGIONAL_OUTPUT_MEASURES } from "@/lib/helpers/regionalGdpItl3Measures";
import { MOBILE_COVERAGE_MEASURES } from "@/lib/helpers/mobileCoverageMeasures";
import { GHG_EMISSIONS_MEASURES } from "@/lib/helpers/ghgEmissionsMeasures";
import { IMD_MEASURES } from "@/lib/helpers/imdMeasures";
import { PUBLIC_HEALTH_MEASURES } from "@uk-data-atlas/datasets/data/public-health/loader";
import { ABSENCE_MEASURES } from "@/lib/helpers/pupilAbsenceMeasures";
import { HEALTH_MEASURES } from "@/lib/helpers/generalHealthMeasures";
import { TENURE_MEASURES } from "@/lib/helpers/housingTenureMeasures";
import { WORKPLACE_PAY_MEASURES } from "@/lib/helpers/workplaceIncomeMeasures";
import type { EnergySector } from "@/lib/helpers/energyConsumptionMeasures";
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
	vertical = false,
}: {
	measure: Value;
	measures: readonly MeasureOption<Value>[];
	onChange: (measure: Value) => void;
	vertical?: boolean;
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
				className={`relative ${theme.section} flex ${vertical ? "flex-col" : ""} rounded-sm p-1 text-xs`}
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
							className={`cursor-pointer rounded-sm border px-2 py-1 ${vertical ? "text-left" : ""} backdrop-blur-md transition-all duration-200 ${isSelected ? selectedClass : isDark ? "border-transparent text-gray-400 hover:bg-white/10" : "border-transparent text-gray-500 hover:bg-white/20"}`}
						>
							{label}
						</button>
					);
				})}
			</div>
		</div>
	);
}

type WorkplacePayMeasure = (typeof WORKPLACE_PAY_MEASURES)[number]["value"];

export function WorkplacePayMeasurePanel({
	measure,
	onChange,
}: {
	measure: WorkplacePayMeasure;
	onChange: (measure: WorkplacePayMeasure) => void;
}) {
	const period = measure.startsWith("hourly") ? "hourly" : "annual";
	const statistic = measure.endsWith("Mean") ? "mean" : "median";
	return (
		<>
			<IncomePeriodPanel
				period={period}
				onChange={(nextPeriod) =>
					onChange(
						`${nextPeriod}${statistic === "mean" ? "Mean" : "Median"}`,
					)
				}
			/>
			<IncomeMeasurePanel
				measure={statistic}
				onChange={(nextStatistic) =>
					onChange(
						`${period}${nextStatistic === "mean" ? "Mean" : "Median"}`,
					)
				}
			/>
		</>
	);
}

const HOUSING_TENURE_SEGMENTS = TENURE_MEASURES.map(
	({ value, label }) => [value, label] as const,
);

type HousingTenureMeasure = (typeof TENURE_MEASURES)[number]["value"];

export function HousingTenureMeasurePanel({
	measure,
	onChange,
}: {
	measure: HousingTenureMeasure;
	onChange: (measure: HousingTenureMeasure) => void;
}) {
	return (
		<GlassSegmentedMeasurePanel
			measure={measure}
			measures={HOUSING_TENURE_SEGMENTS}
			onChange={onChange}
			vertical
		/>
	);
}

const PUBLIC_HEALTH_SEGMENTS = PUBLIC_HEALTH_MEASURES.map(
	({ value, label }) => [value, label] as const,
);

type PublicHealthMeasure = (typeof PUBLIC_HEALTH_MEASURES)[number]["value"];

export function PublicHealthMeasurePanel({
	measure,
	onChange,
}: {
	measure: PublicHealthMeasure;
	onChange: (measure: PublicHealthMeasure) => void;
}) {
	return (
		<GlassSegmentedMeasurePanel
			measure={measure}
			measures={PUBLIC_HEALTH_SEGMENTS}
			onChange={onChange}
			vertical
		/>
	);
}

const PUPIL_ABSENCE_SEGMENTS = ABSENCE_MEASURES.map(
	({ value, label }) => [value, label] as const,
);

type PupilAbsenceMeasure = (typeof ABSENCE_MEASURES)[number]["value"];

export function PupilAbsenceMeasurePanel({
	measure,
	onChange,
}: {
	measure: PupilAbsenceMeasure;
	onChange: (measure: PupilAbsenceMeasure) => void;
}) {
	return (
		<GlassSegmentedMeasurePanel
			measure={measure}
			measures={PUPIL_ABSENCE_SEGMENTS}
			onChange={onChange}
			vertical
		/>
	);
}

const GENERAL_HEALTH_SEGMENTS = HEALTH_MEASURES.map(
	({ value, label }) => [value, label] as const,
);

type GeneralHealthMeasure = (typeof HEALTH_MEASURES)[number]["value"];

export function GeneralHealthMeasurePanel({
	measure,
	onChange,
}: {
	measure: GeneralHealthMeasure;
	onChange: (measure: GeneralHealthMeasure) => void;
}) {
	return (
		<GlassSegmentedMeasurePanel
			measure={measure}
			measures={GENERAL_HEALTH_SEGMENTS}
			onChange={onChange}
			vertical
		/>
	);
}

const LIFE_EXPECTANCY_KINDS = [
	["le", "Life expectancy"],
	["hle", "Healthy life expectancy"],
] as const;

export function LifeExpectancyKindPanel({
	kind,
	onChange,
}: {
	kind: "le" | "hle";
	onChange: (kind: "le" | "hle") => void;
}) {
	return (
		<GlassSegmentedMeasurePanel
			measure={kind}
			measures={LIFE_EXPECTANCY_KINDS}
			onChange={onChange}
			vertical
		/>
	);
}

const PLANNING_SEGMENTS = [
	["received", "Received"],
	["decided", "Decided"],
	["withdrawn", "Withdrawn"],
] as const;

type PlanningMeasure = (typeof PLANNING_SEGMENTS)[number][0];

export function PlanningMeasurePanel({
	measure,
	onChange,
}: {
	measure: PlanningMeasure;
	onChange: (measure: PlanningMeasure) => void;
}) {
	return (
		<GlassSegmentedMeasurePanel
			measure={measure}
			measures={PLANNING_SEGMENTS}
			onChange={onChange}
		/>
	);
}

const IMD_SEGMENTS = IMD_MEASURES.map(
	({ value, label }) => [value, label] as const,
);

type ImdMeasure = (typeof IMD_MEASURES)[number]["value"];

export function ImdMeasurePanel({
	measure,
	onChange,
}: {
	measure: ImdMeasure;
	onChange: (measure: ImdMeasure) => void;
}) {
	return (
		<GlassSegmentedMeasurePanel
			measure={measure}
			measures={IMD_SEGMENTS}
			onChange={onChange}
			vertical
		/>
	);
}

const FUEL_POVERTY_SEGMENTS = [
	["rate", "Percentage"],
	["count", "Total"],
] as const;

export function FuelPovertyMeasurePanel({
	measure,
	onChange,
}: {
	measure: "rate" | "count";
	onChange: (measure: "rate" | "count") => void;
}) {
	return (
		<GlassSegmentedMeasurePanel
			measure={measure}
			measures={FUEL_POVERTY_SEGMENTS}
			onChange={onChange}
		/>
	);
}

const ENERGY_SECTOR_SEGMENTS = [
	["allMetersGwh", "All"],
	["domesticGwh", "Domestic"],
	["nonDomesticGwh", "Non-domestic"],
] as const;

export function EnergySectorPanel({
	sector,
	onChange,
}: {
	sector: EnergySector;
	onChange: (sector: EnergySector) => void;
}) {
	return (
		<GlassSegmentedMeasurePanel
			measure={sector}
			measures={ENERGY_SECTOR_SEGMENTS}
			onChange={onChange}
		/>
	);
}

const MOBILE_COVERAGE_SEGMENTS = MOBILE_COVERAGE_MEASURES.map(
	({ value, label }) => [value, label] as const,
);

type MobileCoverageMeasure = (typeof MOBILE_COVERAGE_MEASURES)[number]["value"];

export function MobileCoverageMeasurePanel({
	measure,
	onChange,
}: {
	measure: MobileCoverageMeasure;
	onChange: (measure: MobileCoverageMeasure) => void;
}) {
	return (
		<GlassSegmentedMeasurePanel
			measure={measure}
			measures={MOBILE_COVERAGE_SEGMENTS}
			onChange={onChange}
			vertical
		/>
	);
}

const REGIONAL_OUTPUT_SEGMENTS = REGIONAL_OUTPUT_MEASURES.map(
	({ value, label }) => [value, label] as const,
);

export function RegionalOutputMeasurePanel({
	measure,
	onChange,
}: {
	measure: "gdp" | "gva";
	onChange: (measure: "gdp" | "gva") => void;
}) {
	return (
		<GlassSegmentedMeasurePanel
			measure={measure}
			measures={REGIONAL_OUTPUT_SEGMENTS}
			onChange={onChange}
		/>
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

const ELECTION_METRICS = [
	["votes", "Votes"],
	["turnout", "Turnout"],
] as const;

export function ElectionMetricPanel({
	metric,
	onChange,
}: {
	metric: "votes" | "turnout";
	onChange: (metric: "votes" | "turnout") => void;
}) {
	return (
		<GlassSegmentedMeasurePanel
			measure={metric}
			measures={ELECTION_METRICS}
			onChange={onChange}
		/>
	);
}

const INCOME_MEASURES = [
	["median", "Median"],
	["mean", "Mean"],
] as const;

export function IncomeMeasurePanel({
	measure,
	onChange,
}: {
	measure: "median" | "mean";
	onChange: (measure: "median" | "mean") => void;
}) {
	return (
		<GlassSegmentedMeasurePanel
			measure={measure}
			measures={INCOME_MEASURES}
			onChange={onChange}
		/>
	);
}

const INCOME_PERIODS = [
	["annual", "Annual"],
	["hourly", "Hourly"],
] as const;

export function IncomePeriodPanel({
	period,
	onChange,
}: {
	period: "annual" | "hourly";
	onChange: (period: "annual" | "hourly") => void;
}) {
	return (
		<GlassSegmentedMeasurePanel
			measure={period}
			measures={INCOME_PERIODS}
			onChange={onChange}
		/>
	);
}

const AIR_QUALITY_MEASURES = [
	["no2", "NO₂"],
	["pm25", "PM2.5"],
	["pm10", "PM10"],
] as const;

export function AirQualityMeasurePanel({
	measure,
	onChange,
}: {
	measure: "no2" | "pm25" | "pm10";
	onChange: (measure: "no2" | "pm25" | "pm10") => void;
}) {
	return (
		<GlassSegmentedMeasurePanel
			measure={measure}
			measures={AIR_QUALITY_MEASURES}
			onChange={onChange}
		/>
	);
}

const BROADBAND_MEASURES = [
	["fullFibre", "Full"],
	["superfast", "Super"],
	["ultrafast", "Ultra"],
	["gigabit", "Gig"],
] as const;

export function BroadbandMeasurePanel({
	measure,
	onChange,
}: {
	measure: "fullFibre" | "superfast" | "ultrafast" | "gigabit";
	onChange: (
		measure: "fullFibre" | "superfast" | "ultrafast" | "gigabit",
	) => void;
}) {
	return (
		<GlassSegmentedMeasurePanel
			measure={measure}
			measures={BROADBAND_MEASURES}
			onChange={onChange}
		/>
	);
}

const GHG_EMISSIONS_SEGMENTS = GHG_EMISSIONS_MEASURES.map(
	({ value, label }) => [value, label] as const,
);

type GhgEmissionsMeasure = (typeof GHG_EMISSIONS_MEASURES)[number]["value"];

export function GhgEmissionsMeasurePanel({
	measure,
	onChange,
}: {
	measure: GhgEmissionsMeasure;
	onChange: (measure: GhgEmissionsMeasure) => void;
}) {
	return (
		<GlassSegmentedMeasurePanel
			measure={measure}
			measures={GHG_EMISSIONS_SEGMENTS}
			onChange={onChange}
			vertical
		/>
	);
}

const UNEMPLOYMENT_MEASURES = [
	["rate", "Rate"],
	["count", "Count"],
] as const;

export function UnemploymentMeasurePanel({
	measure,
	onChange,
}: {
	measure: "rate" | "count";
	onChange: (measure: "rate" | "count") => void;
}) {
	return (
		<GlassSegmentedMeasurePanel
			measure={measure}
			measures={UNEMPLOYMENT_MEASURES}
			onChange={onChange}
		/>
	);
}

const CLAIMANT_COUNT_MEASURES = [
	["rate", "Rate"],
	["count", "Count"],
] as const;

export function ClaimantCountMeasurePanel({
	measure,
	onChange,
}: {
	measure: "rate" | "count";
	onChange: (measure: "rate" | "count") => void;
}) {
	return (
		<GlassSegmentedMeasurePanel
			measure={measure}
			measures={CLAIMANT_COUNT_MEASURES}
			onChange={onChange}
		/>
	);
}

const HOMELESSNESS_MEASURES = [
	["rate", "Rate"],
	["count", "Count"],
] as const;

export function HomelessnessMeasurePanel({
	measure,
	onChange,
}: {
	measure: "rate" | "count";
	onChange: (measure: "rate" | "count") => void;
}) {
	return (
		<GlassSegmentedMeasurePanel
			measure={measure}
			measures={HOMELESSNESS_MEASURES}
			onChange={onChange}
		/>
	);
}

const SCHOOL_PERFORMANCE_MEASURES = [
	["grade4", "Grade 4+"],
	["grade5", "Grade 5+"],
	["attainment8", "Attain. 8"],
	["progress8", "Progress 8"],
] as const;
export function SchoolPerformanceMeasurePanel({
	measure,
	onChange,
}: {
	measure: "grade4" | "grade5" | "attainment8" | "progress8";
	onChange: (
		measure: "grade4" | "grade5" | "attainment8" | "progress8",
	) => void;
}) {
	return (
		<GlassSegmentedMeasurePanel
			measure={measure}
			measures={SCHOOL_PERFORMANCE_MEASURES}
			onChange={onChange}
		/>
	);
}

const COUNT_METRICS = [
	["total", "Total"],
	["perPopulation", "Per pop."],
] as const;

export function CountMetricPanel({
	measure,
	onChange,
}: {
	measure: "total" | "perPopulation";
	onChange: (measure: "total" | "perPopulation") => void;
}) {
	return (
		<GlassSegmentedMeasurePanel
			measure={measure}
			measures={COUNT_METRICS}
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

const WASTE_METRICS = [
	["collected", "Collected"],
	["recycled", "Recycled"],
	["recyclingShare", "Recycling %"],
] as const;

export function WasteMetricPanel({
	metric,
	onChange,
}: {
	metric: WasteOptions["metric"];
	onChange: (metric: WasteOptions["metric"]) => void;
}) {
	return (
		<GlassSegmentedMeasurePanel
			measure={metric}
			measures={WASTE_METRICS}
			onChange={onChange}
		/>
	);
}
