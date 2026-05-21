"use client";
import {
	ActiveViz,
	AggregatedCrimeData,
	Dataset,
	CrimeDataset,
	SelectedArea,
} from "@lib/types";
import { memo, useMemo, useState } from "react";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";
import {
	ChartLoadingBackground,
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { useIsDark } from "@/lib/context/ThemeContext";
import { chartHeadingClass, cardClass, useCardAccent } from "@/lib/hooks/useCardAccent";

interface CrimeRateChartProps {
	activeDataset: Dataset | null;
	availableDatasets: Record<string, CrimeDataset>;
	aggregatedData: Record<number, AggregatedCrimeData> | null;
	selectedArea: SelectedArea | null;
	codeMapper?: CodeMapper;
	year: number;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

const layers = [
	{ r: 45, opacity: 0.3 },
	{ r: 35, opacity: 0.4 },
	{ r: 25, opacity: 0.5 },
	{ r: 15, opacity: 0.6 },
	{ r: 5, opacity: 0.8 },
];

export default memo(function CrimeRateChart({
	activeDataset,
	availableDatasets,
	aggregatedData,
	selectedArea,
	codeMapper,
	year,
	activeViz,
	setActiveViz,
}: CrimeRateChartProps) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const [hovered, setHovered] = useState(false);
	const dataset = availableDatasets?.[year];

	const filterId = useMemo(() => `contour-filter-${year}`, [year]);

	const distortionSeed = useMemo(() => {
		if (!selectedArea) return 0;
		const code = selectedArea.code || "";
		return (
			code.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) %
			100
		);
	}, [selectedArea]);

	const crimeRate = useMemo(() => {
		if (!dataset) return null;
		let rate: number | null = null;
		if (selectedArea === null && aggregatedData && aggregatedData[dataset.year]) {
			rate = aggregatedData[dataset.year].averageRecordedCrime || null;
		} else if (
			selectedArea &&
			selectedArea.type === "localAuthority" &&
			selectedArea.data
		) {
			const laCode = selectedArea.code;
			rate = dataset.data?.[laCode]?.totalRecordedCrime || null;
			if (!rate && codeMapper) {
				const mappedCode = codeMapper.getCodeForYear(
					"localAuthority",
					laCode,
					year,
				);
				if (mappedCode) {
					rate = dataset.data?.[mappedCode]?.totalRecordedCrime || null;
				}
			}
		}
		return rate;
	}, [dataset, aggregatedData, selectedArea, codeMapper, year]);

	if (!dataset) return null;

	const isActive =
		activeDataset &&
		((activeDataset.type === "crime" &&
			activeDataset.id === `crime${dataset.year}`) ||
			(activeViz.datasetType === "custom" && activeViz.vizId === "custom"));

	const rawValue = crimeRate || 0;
	const maxThreshold = 100000;
	const minThreshold = 5000;

	let intensity = 0;
	const hasData = crimeRate !== null && crimeRate > 0;
	if (hasData && rawValue > minThreshold) {
		intensity = Math.min(
			Math.max(
				(rawValue - minThreshold) / (maxThreshold - minThreshold),
				0,
			),
			1,
		);
	}

	const baseHue = 50 - intensity * 50;
	const hotHue = 50 - intensity * 50;

	const dynamicBgColor = hasData
		? isDark
			? `hsl(${baseHue}, ${20 + intensity * 30}%, ${8 + intensity * 8}%)`
			: `hsl(${baseHue}, ${40 + intensity * 40}%, ${95 - intensity * 20}%)`
		: "";

	// Same hue as the background, at a mid-brightness level visible in both modes
	const borderColor = hasData
		? `hsl(${baseHue}, ${50 + intensity * 40}%, 60%)`
		: null;

	const combinedStyle: React.CSSProperties = {
		...(dynamicBgColor ? { backgroundColor: dynamicBgColor } : {}),
		...((isActive || hovered) && borderColor ? { borderColor } : {}),
	};

	return (
		<div
			style={combinedStyle}
			className={`p-2 rounded cursor-pointer overflow-hidden relative h-20 border-2 ${isActive
				? isDark ? "bg-white/10" : "bg-white/60"
				: isDark ? "bg-white/5 border-white/10" : "bg-white/60 border-gray-200/80"
			}`}
			title="Home Office. Police Recorded Crime Open Data Tables. data.police.uk"
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			onClick={() =>
				setActiveViz({
					vizId: dataset.id,
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
		>
			<ChartLoadingBackground />
			{hasData && intensity > 0 && (
				<div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
					<svg
						viewBox="-100 -100 300 300"
						preserveAspectRatio="xMidYMid slice"
						className="w-full h-full"
					>
						<defs>
							<filter
								id={filterId}
								x="-50%"
								y="-50%"
								width="200%"
								height="200%"
							>
								<feTurbulence
									type="fractalNoise"
									baseFrequency="0.04"
									numOctaves="3"
									seed={distortionSeed}
									result="noise"
								/>
								<feDisplacementMap
									in="SourceGraphic"
									in2="noise"
									scale={20 + intensity * 20}
								/>
							</filter>
						</defs>

						<g filter={`url(#${filterId})`}>
							{layers.map((layer, i) => (
								<circle
									key={i}
									cx="50"
									cy="50"
									r={layer.r * 2.5}
									fill={`hsla(${hotHue + (20 - i * 5)}, 80%, ${60 - i * 5}%, ${layer.opacity + intensity * 0.2})`}
								/>
							))}
						</g>
					</svg>
				</div>
			)}

			<div className={`absolute inset-0 z-0 ${isDark ? "bg-black/20" : "bg-white/20"}`} />
			<div className="relative z-10">
				<h3 className={chartHeadingClass(isDark)}>
					Recorded Crime [{dataset.year}]
				</h3>
				{crimeRate ? (
					<div
						className="text-xl font-bold mt-2 text-center"
						style={{
							color: isDark
								? intensity > 0.5 ? "#fca5a5" : "#fdba74"
								: intensity > 0.5 ? "#7f1d1d" : "#78350f",
						}}
					>
						{Math.round(crimeRate).toLocaleString()}
					</div>
				) : (
					<div className="h-5 mt-2 mb-2">
						{chartsLoading ? (
							<ChartContentPlaceholder className="h-full" />
						) : (
							<div className={`text-xs pt-0.5 text-center ${isDark ? "text-gray-400" : "text-gray-400/80"}`}>
								No data available
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
});
