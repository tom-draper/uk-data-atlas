"use client";
import { useEffect, useMemo, useState } from "react";
import { useIsDark } from "@/lib/context/ThemeContext";
import { useExcludedCategories } from "@/lib/context/ExcludedCategoriesContext";
import { ActiveViz } from "@lib/types";
import { CustomDataset } from "@/lib/types/custom";
import { NetworkDataset } from "@/lib/types/network";
import { MapManager } from "@/lib/helpers/mapManager/mapManager";
import { gazetteer } from "@/lib/data/gazetteer/static";
import { getPointsInBounds } from "@/lib/helpers/locationPoints";
import { rgbToHex } from "@/lib/helpers/colorScale/interpolation";
import { ChartCard } from "@/components/ChartCard";
import { ChartCardValueBar } from "@/components/ChartCardValueBar";

/** Buckets the roads layer's currently rendered features into the dataset's legend rows. */
function useVisibleRoadBreakdown(
	mapManager: MapManager | null,
	dataset: NetworkDataset,
	isActive: boolean,
) {
	const [counts, setCounts] = useState<Record<string, number> | null>(null);
	const filterProperty = dataset.layer?.filterProperty;

	useEffect(() => {
		if (!mapManager || !isActive || !dataset.layer || !filterProperty) {
			setCounts(null);
			return;
		}
		const recompute = () =>
			setCounts(
				mapManager.countRenderedFeaturesByProperty(
					dataset.layer!.id,
					filterProperty,
				),
			);
		recompute();
		return mapManager.onIdle(recompute);
	}, [mapManager, isActive, dataset.layer, filterProperty]);

	return useMemo(() => {
		if (!counts || !dataset.legend) return null;
		const knownValues = new Set(dataset.legend.flatMap((item) => item.values ?? []));
		const buckets = dataset.legend.map((item) => ({
			id: item.id,
			label: item.label,
			color: item.color,
			count: item.values
				? item.values.reduce((sum, value) => sum + (counts[value] ?? 0), 0)
				: Object.entries(counts).reduce(
						(sum, [value, count]) => (knownValues.has(value) ? sum : sum + count),
						0,
					),
		}));
		const total = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
		return { buckets, total };
	}, [counts, dataset.legend]);
}

const SEVERITY_COLORS = [
	[250, 204, 21], // Slight
	[249, 115, 22], // Serious
	[153, 27, 27], // Fatal
] as const;

function severityColor(averageSeverity: number): string {
	const position = Math.max(0, Math.min(1, (averageSeverity - 1) / 2));
	const segment = position <= 0.5 ? 0 : 1;
	const localPosition = (position - segment * 0.5) * 2;
	const from = SEVERITY_COLORS[segment];
	const to = SEVERITY_COLORS[segment + 1];
	return rgbToHex(
		from[0] + (to[0] - from[0]) * localPosition,
		from[1] + (to[1] - from[1]) * localPosition,
		from[2] + (to[2] - from[2]) * localPosition,
	);
}

function RoadSafetyCard({
	dataset,
	isActive,
	setActiveViz,
	location,
}: {
	dataset: CustomDataset;
	isActive: boolean;
	setActiveViz: (value: ActiveViz) => void;
	location: string;
}) {
	const isDark = useIsDark();
	const { excludedPointValues, selectedPointValue } = useExcludedCategories();
	const points = useMemo(() => {
		const locationPoints = getPointsInBounds(
			dataset.points ?? [],
			gazetteer.boundsOf(location),
		);
		if (!isActive) return locationPoints;
		return locationPoints.filter(
			(point) =>
				!excludedPointValues.has(point.value) &&
				(selectedPointValue === undefined || point.value === selectedPointValue),
		);
	}, [
		dataset.points,
		location,
		isActive,
		excludedPointValues,
		selectedPointValue,
	]);
	const hasData = points.length > 0;
	const averageSeverity = hasData
		? points.reduce((total, point) => total + point.value, 0) / points.length
		: 0;
	const severityBarWidth = (averageSeverity / 3) * 100;
	const accent = hasData ? severityColor(averageSeverity) : null;
	return (
		<ChartCard
			heading={dataset.dataColumn}
			headerEnd={
				<span
					className={`text-[9px] shrink-0 ml-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}
				>
					Great Britain
				</span>
			}
			accent={accent}
			isActive={isActive}
			onClick={() =>
				setActiveViz({
					datasetId: dataset.id,
					datasetType: "custom",
					datasetYear: 0,
				})
			}
			title="Department for Transport. Provisional road collision statistics for Great Britain, 2025."
		>
			<ChartCardValueBar
				hasData={hasData}
				value={points.length.toLocaleString("en-GB")}
				unit="collisions"
				secondary={`severity ${averageSeverity.toFixed(1)} / 3`}
				barWidth={severityBarWidth}
				barColor={accent ?? undefined}
			/>
		</ChartCard>
	);
}

function NetworkCard({
	dataset,
	isActive,
	setActiveViz,
	mapManager,
}: {
	dataset: NetworkDataset;
	isActive: boolean;
	setActiveViz: (value: ActiveViz) => void;
	mapManager: MapManager | null;
}) {
	const isDark = useIsDark();
	const breakdown = useVisibleRoadBreakdown(mapManager, dataset, isActive);
	const hasBreakdown = !!breakdown && breakdown.total > 0;

	return (
		<ChartCard
			heading={dataset.dataColumn}
			headerEnd={
				<span className={`text-[9px] shrink-0 ml-1 ${isDark ? "text-gray-500" : "text-gray-400"}`}>
					Great Britain
				</span>
			}
			accent="#c2410c"
			isActive={isActive}
			minHeightClassName={`transition-[min-height] duration-300 ease-in-out ${isActive ? "min-h-[150px]" : "min-h-[65px]"} block w-full text-left`}
			onClick={() =>
				setActiveViz({
					datasetId: dataset.id,
					datasetType: "network",
					datasetYear: dataset.year,
				})
			}
			title={`${dataset.provider}. ${dataset.description}`}
		>
			{!hasBreakdown ? (
				<ChartCardValueBar
					hasData
					value={dataset.available ? "Road network" : "Not configured"}
					unit={dataset.available ? "vector tiles" : "add tile URL"}
					secondary={dataset.licence}
					barWidth={dataset.available ? 100 : 0}
					barColor="#c2410c"
				/>
			) : (
				<div className="space-y-1">
					<div className={`text-[10px] ${isDark ? "text-gray-400" : "text-gray-500"}`}>
						{breakdown.total.toLocaleString("en-GB")} roads in view
					</div>
					<div className="flex h-5 rounded overflow-hidden w-full gap-0">
						{breakdown.buckets
							.filter((bucket) => bucket.count > 0)
							.map((bucket) => {
								const pct = (bucket.count / breakdown.total) * 100;
								return (
									<div
										key={bucket.id}
										style={{ width: `${pct}%`, backgroundColor: bucket.color }}
										title={`${bucket.label}: ${bucket.count.toLocaleString()} (${pct.toFixed(1)}%)`}
										className="hover:opacity-80 transition-opacity"
									>
										{pct > 8 && (
											<span className="text-white text-[9px] font-bold px-0.5 leading-5 truncate block">
												{pct.toFixed(0)}%
											</span>
										)}
									</div>
								);
							})}
					</div>
					{isActive && (
						<div className="animate-in fade-in duration-200 mt-1">
							<div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
								{breakdown.buckets.map((bucket) => (
									<div key={bucket.id} className="flex items-center gap-1 min-w-0">
										<div
											className="size-1.5 rounded-sm shrink-0"
											style={{ backgroundColor: bucket.color }}
										/>
										<span
											className={`text-[9px] truncate ${isDark ? "text-gray-400" : "text-gray-500"}`}
											title={bucket.label}
										>
											{((bucket.count / breakdown.total) * 100).toFixed(1)}% {bucket.label}
										</span>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			)}
		</ChartCard>
	);
}

export default function TransportSection({
	roadSafetyDatasets,
	networkDatasets,
	activeViz,
	setActiveViz,
	location,
	mapManager,
}: {
	roadSafetyDatasets: CustomDataset[];
	networkDatasets: NetworkDataset[];
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	location: string;
	mapManager: MapManager | null;
}) {
	const isDark = useIsDark();

	if (roadSafetyDatasets.length === 0 && networkDatasets.length === 0) return null;

	return (
		<div
			className={`space-y-2 border-t ${isDark ? "border-white/10" : "border-gray-200/80"}`}
		>
			<h3
				className={`text-xs font-bold pt-2 ${isDark ? "text-gray-200" : "text-gray-800"}`}
			>
				Transport
			</h3>
			<div className="space-y-2">
				{networkDatasets.map((ds) => (
					<NetworkCard
						key={ds.id}
						dataset={ds}
						isActive={
							activeViz.datasetType === "network" &&
							activeViz.datasetId === ds.id
						}
						setActiveViz={setActiveViz}
						mapManager={mapManager}
					/>
				))}
				{roadSafetyDatasets.map((ds) => (
					<RoadSafetyCard
						key={ds.id}
						dataset={ds}
						isActive={
							activeViz.datasetType === "custom" &&
							activeViz.datasetId === ds.id
						}
						setActiveViz={setActiveViz}
						location={location}
					/>
				))}
			</div>
		</div>
	);
}
