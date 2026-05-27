// components/population/age/AgeDistribution.tsx
import { memo, useMemo } from "react";
import {
	ActiveViz,
	AgeGroups,
	AggregatedPopulationData,
	PopulationDataset,
	SelectedArea,
} from "@/lib/types";
import AgeDistributionChart from "./AgeDistributionChart";
import { CodeMapper } from "@/lib/hooks/useCodeMapper";
import { ChartLoadingBackground } from "@/components/ChartLoadingPlaceholder";
import { useIsDark } from "@/lib/context/ThemeContext";
import {
	resolveWardData,
	getLadCachedValue,
} from "@/lib/helpers/demographicData";
import { getAgeColor } from "@/lib/helpers/ageDistribution";
import {
	useCardAccent,
	cardClass,
	chartHeadingClass,
} from "@/lib/hooks/useCardAccent";

interface AgeDistributionProps {
	dataset: PopulationDataset;
	aggregatedData: Record<number, AggregatedPopulationData> | null;
	selectedArea: SelectedArea | null;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
	codeMapper?: CodeMapper;
}

// Pre-calculate age group boundaries (constant)
const AGE_BOUNDARIES = [
	{ max: 17, key: "0-17" as keyof AgeGroups },
	{ max: 29, key: "18-29" as keyof AgeGroups },
	{ max: 44, key: "30-44" as keyof AgeGroups },
	{ max: 64, key: "45-64" as keyof AgeGroups },
	{ max: Infinity, key: "65+" as keyof AgeGroups },
];

// Precomputed lookup tables — avoids i.toString() and boundary search in hot loops
const AGE_STRING_KEYS: string[] = Array.from({ length: 100 }, (_, i) =>
	String(i),
);
const AGE_GROUP_KEYS: (keyof AgeGroups)[] = Array.from(
	{ length: 100 },
	(_, i) => {
		for (let b = 0; b < AGE_BOUNDARIES.length; b++) {
			if (i <= AGE_BOUNDARIES[b].max) return AGE_BOUNDARIES[b].key;
		}
		return "65+";
	},
);

// Pre-calculate decay weights (constant)
const DECAY_RATE = 0.15;
const DECAY_WEIGHTS = new Array(10);
let totalWeight = 0;
for (let i = 0; i < 10; i++) {
	DECAY_WEIGHTS[i] = Math.exp(-DECAY_RATE * i);
	totalWeight += DECAY_WEIGHTS[i];
}
const NORMALIZED_WEIGHTS = DECAY_WEIGHTS.map((w) => w / totalWeight);

const ageDistributionCache = new Map<string, Map<number, any>>();

const EMPTY_AGE_GROUPS: AgeGroups = {
	"0-17": 0,
	"18-29": 0,
	"30-44": 0,
	"45-64": 0,
	"65+": 0,
};

function AgeDistribution({
	dataset,
	aggregatedData,
	selectedArea,
	activeViz,
	setActiveViz,
	codeMapper,
}: AgeDistributionProps) {
	const isDark = useIsDark();
	const vizId = `ageDistribution${dataset.year}`;
	const isActive = activeViz.vizId === vizId;

	const { medianAge, ageGroups, total, counts, maxCount } = useMemo(() => {
		let max = 0;

		//  Handle Aggregated Data Case (no area selected)
		if (selectedArea === null && aggregatedData) {
			const data = aggregatedData[dataset.year];
			if (!data)
				return {
					medianAge: null,
					ageGroups: [],
					total: 0,
					counts: new Uint32Array(100),
					maxCount: 0,
				};
			const counts = new Uint32Array(100);

			if (data.ages) {
				for (let i = 0; i < data.ages.length; i++) {
					const item = data.ages[i];
					if (item.age < 100) {
						counts[item.age] = item.count;
						if (item.count > max) max = item.count;
					}
				}
			}

			return {
				medianAge: data.medianAge ?? 0,
				ageGroups:
					data.populationStats.ageGroups.total ?? EMPTY_AGE_GROUPS,
				total: data.populationStats.total ?? 0,
				counts: counts,
				maxCount: max,
			};
		}

		// Handle Ward Selection
		if (selectedArea && selectedArea.type === "ward") {
			const wardData = resolveWardData(
				dataset,
				selectedArea.code,
				codeMapper,
			);

			if (!wardData) {
				return {
					medianAge: 0,
					ageGroups: EMPTY_AGE_GROUPS,
					total: 0,
					counts: new Uint32Array(100),
					maxCount: 0,
				};
			}

			const agesCountTotal = wardData.total;

			// OPTIMIZATION: Use Typed Array for speed
			const counts = new Uint32Array(100);
			let totalPopulation = 0;
			let max = 0;

			// Build ages 0-89
			for (let i = 0; i < 90; i++) {
				const count = agesCountTotal[AGE_STRING_KEYS[i]] || 0;
				counts[i] = count;
				totalPopulation += count;
				if (count > max) max = count;
			}

			// Apply 90+ smoothing
			const age90Plus = agesCountTotal["90"] || 0;
			for (let i = 90; i < 100; i++) {
				const count = Math.round(
					age90Plus * NORMALIZED_WEIGHTS[i - 90],
				);
				counts[i] = count;
				totalPopulation += count;
				if (count > max) max = count;
			}

			// Compute median age
			let cumulative = 0;
			const halfPopulation = totalPopulation / 2;
			let median = 0;

			// Fill grouped buckets
			const currentAgeGroups: AgeGroups = { ...EMPTY_AGE_GROUPS };

			let medianFound = false;
			for (let i = 0; i < 100; i++) {
				const count = counts[i];

				// Grouping logic
				const key = AGE_GROUP_KEYS[i];
				currentAgeGroups[key] += count;

				// Median logic (integrated into single loop)
				if (!medianFound) {
					cumulative += count;
					if (cumulative >= halfPopulation) {
						median = i;
						medianFound = true;
					}
				}
			}

			return {
				medianAge: median,
				ageGroups: currentAgeGroups,
				total: totalPopulation,
				counts: counts,
				maxCount: max,
			};
		}

		// Handle Local Authority Selection
		if (
			selectedArea &&
			selectedArea.type === "localAuthority" &&
			codeMapper?.getWardsForLad
		) {
			return getLadCachedValue(
				ageDistributionCache,
				selectedArea.code,
				dataset.year,
				() => {
					const wardCodes = codeMapper.getWardsForLad!(
						selectedArea.code,
						dataset.boundaryYear,
					);

					if (wardCodes.length === 0) {
						return {
							medianAge: 0,
							ageGroups: EMPTY_AGE_GROUPS,
							total: 0,
							counts: new Uint32Array(100),
							maxCount: 0,
						};
					}

					// Aggregate age counts across all wards
					const aggregatedCounts = new Uint32Array(100);
					for (const wardCode of wardCodes) {
						const wardData = resolveWardData(
							dataset,
							wardCode,
							codeMapper,
						);
						if (wardData?.total) {
							for (let i = 0; i < 90; i++) {
								aggregatedCounts[i] +=
									wardData.total[AGE_STRING_KEYS[i]] || 0;
							}
							const age90Plus = wardData.total["90"] || 0;
							for (let i = 90; i < 100; i++) {
								aggregatedCounts[i] += Math.round(
									age90Plus * NORMALIZED_WEIGHTS[i - 90],
								);
							}
						}
					}

					let totalPopulation = 0;
					let max = 0;
					for (let i = 0; i < 100; i++) {
						totalPopulation += aggregatedCounts[i];
						if (aggregatedCounts[i] > max)
							max = aggregatedCounts[i];
					}

					let cumulative = 0;
					const halfPopulation = totalPopulation / 2;
					let median = 0;
					let medianFound = false;
					const currentAgeGroups: AgeGroups = { ...EMPTY_AGE_GROUPS };
					for (let i = 0; i < 100; i++) {
						const count = aggregatedCounts[i];
						currentAgeGroups[AGE_GROUP_KEYS[i]] += count;
						if (!medianFound) {
							cumulative += count;
							if (cumulative >= halfPopulation) {
								median = i;
								medianFound = true;
							}
						}
					}

					return {
						medianAge: median,
						ageGroups: currentAgeGroups,
						total: totalPopulation,
						counts: aggregatedCounts,
						maxCount: max,
					};
				},
			);
		}

		// Handle Constituency Selection (no cache — stale cache risks hiding data if computed
		// before constituency-ward mappings finish loading asynchronously)
		if (
			selectedArea &&
			selectedArea.type === "constituency" &&
			codeMapper?.getWardsForConstituency
		) {
			const wardCodes = codeMapper.getWardsForConstituency(
				selectedArea.code,
				dataset.boundaryYear,
			);

			if (wardCodes.length === 0) {
				return {
					medianAge: 0,
					ageGroups: EMPTY_AGE_GROUPS,
					total: 0,
					counts: new Uint32Array(100),
					maxCount: 0,
				};
			}

			const aggregatedCounts = new Uint32Array(100);
			for (const wardCode of wardCodes) {
				const wardData = resolveWardData(dataset, wardCode, codeMapper);
				if (wardData?.total) {
					for (let i = 0; i < 90; i++) {
						aggregatedCounts[i] +=
							wardData.total[AGE_STRING_KEYS[i]] || 0;
					}
					const age90Plus = wardData.total["90"] || 0;
					for (let i = 90; i < 100; i++) {
						aggregatedCounts[i] += Math.round(
							age90Plus * NORMALIZED_WEIGHTS[i - 90],
						);
					}
				}
			}

			let totalPopulation = 0;
			let max = 0;
			for (let i = 0; i < 100; i++) {
				totalPopulation += aggregatedCounts[i];
				if (aggregatedCounts[i] > max) max = aggregatedCounts[i];
			}

			let cumulative = 0;
			const halfPopulation = totalPopulation / 2;
			let median = 0;
			let medianFound = false;
			const currentAgeGroups: AgeGroups = { ...EMPTY_AGE_GROUPS };
			for (let i = 0; i < 100; i++) {
				const count = aggregatedCounts[i];
				currentAgeGroups[AGE_GROUP_KEYS[i]] += count;
				if (!medianFound) {
					cumulative += count;
					if (cumulative >= halfPopulation) {
						median = i;
						medianFound = true;
					}
				}
			}

			return {
				medianAge: median,
				ageGroups: currentAgeGroups,
				total: totalPopulation,
				counts: aggregatedCounts,
				maxCount: max,
			};
		}

		// Handle Missing Data or unsupported area types
		return {
			medianAge: 0,
			ageGroups: EMPTY_AGE_GROUPS,
			total: 0,
			counts: new Uint32Array(100),
			maxCount: 0,
		};
	}, [dataset, aggregatedData, selectedArea, codeMapper]);

	// Largest age group → its chart color → lightened for border
	const accentColor = useMemo(() => {
		if (!total || Array.isArray(ageGroups)) return null;
		const entries = Object.entries(ageGroups) as [string, number][];
		if (entries.length === 0) return null;
		const largestKey = entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
		return getAgeColor(parseInt(largestKey.split("-")[0]));
	}, [ageGroups, total]);

	const { style, onMouseEnter, onMouseLeave } = useCardAccent(
		accentColor,
		isActive,
		isDark,
	);

	return (
		<div
			style={style}
			className={cardClass(isActive, isDark)}
			title="Office for National Statistics. Census 2021: Age by Single Year of Age, England and Wales. ons.gov.uk"
			onMouseEnter={onMouseEnter}
			onMouseLeave={onMouseLeave}
			onClick={() =>
				setActiveViz({
					vizId: vizId,
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
		>
			<ChartLoadingBackground />
			<div className="flex items-center justify-between mb-2">
				<h3 className={chartHeadingClass(isDark)}>
					Age Distribution [{dataset.year}]
				</h3>
				{medianAge > 0 && (
					<span className="text-[10px] text-gray-500 mr-1">
						Median: {medianAge}
					</span>
				)}
			</div>

			{/* Pass primitive props to ensure reference stability and speed */}
			<AgeDistributionChart
				counts={counts}
				maxCount={maxCount}
				total={total}
				ageGroups={ageGroups}
				isActive={isActive}
			/>
		</div>
	);
}

export default memo(AgeDistribution);
