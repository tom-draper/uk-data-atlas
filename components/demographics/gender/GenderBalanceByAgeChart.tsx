// components/population/gender/GenderBalanceByAgeChart.tsx
import { useMemo, memo, useRef, useCallback } from "react";
import {
	AggregatedPopulationData,
	PopulationDataset,
	SelectedArea,
} from "@/lib/types";

export interface GenderBalanceByAgeChartProps {
	dataset: PopulationDataset;
	aggregatedData: Record<number, AggregatedPopulationData> | null;
	selectedArea: SelectedArea | null;
	codeMapper?: {
		getCodeForYear: (
			type: "ward" | "localAuthority",
			code: string,
			targetYear: number,
		) => string | undefined;
		getWardsForLad: (ladCode: string, year: number) => string[];
	};
}

// Pre-create age indices array (constant)
const AGE_INDICES = Array.from({ length: 91 }, (_, i) => i);

// Cache for LAD gender balance aggregations
const genderBalanceCache = new Map<string, Map<number, any>>();

function GenderBalanceByAgeChart({
	dataset,
	aggregatedData,
	selectedArea,
	codeMapper,
}: GenderBalanceByAgeChartProps) {
	// Refs for direct DOM manipulation (avoids re-renders on hover)
	const tooltipRef = useRef<HTMLDivElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	// Memoize both data AND percentages to avoid recalculation on every render
	const { ageData, percentages } = useMemo(() => {
		// Handle no area selected - use aggregated data
		if (selectedArea === null && aggregatedData) {
			const yearlyData = aggregatedData[dataset.year];
			const data =
				yearlyData.medianAge !== 0 ? yearlyData.genderAgeData : [];

			// Pre-calculate percentages
			const pct = data.map(({ males, females }: { males: number; females: number }) => {
				const total = males + females;
				return total > 0 ? (males / total) * 100 : 50;
			});

			return { ageData: data, percentages: pct };
		}

		// Handle Ward Selection
		if (selectedArea && selectedArea.type === "ward") {
			const wardCode = selectedArea.code;
			let wardData = dataset.data[wardCode];

			// Try to map ward code if not found
			if (!wardData && codeMapper?.getCodeForYear) {
				const mappedCode = codeMapper.getCodeForYear(
					"ward",
					wardCode,
					dataset.boundaryYear,
				);
				if (mappedCode) {
					wardData = dataset.data[mappedCode];
				}
			}

			if (wardData) {
				const { males, females } = wardData;
				const data: Array<{
					age: number;
					males: number;
					females: number;
				}> = new Array(91);
				const pct: number[] = new Array(91);

				// Single loop: build data AND calculate percentages
				for (let age = 0; age < 91; age++) {
					const ageStr = age.toString();
					const m = males[ageStr] || 0;
					const f = females[ageStr] || 0;
					const total = m + f;

					data[age] = { age, males: m, females: f };
					pct[age] = total > 0 ? (m / total) * 100 : 50;
				}

				return { ageData: data, percentages: pct };
			}

			return { ageData: [], percentages: [] };
		}

		// Handle Local Authority Selection
		if (
			selectedArea &&
			selectedArea.type === "localAuthority" &&
			codeMapper?.getWardsForLad
		) {
			const ladCode = selectedArea.code;
			const cacheKey = `lad-${ladCode}`;

			if (!genderBalanceCache.has(cacheKey)) {
				genderBalanceCache.set(cacheKey, new Map());
			}
			const yearCache = genderBalanceCache.get(cacheKey)!;

			if (yearCache.has(dataset.year)) {
				return yearCache.get(dataset.year);
			}

			// Get all wards in this LAD
			const wardCodes = codeMapper.getWardsForLad(ladCode, 2022);

			if (wardCodes.length === 0) {
				const emptyResult = { ageData: [], percentages: [] };
				yearCache.set(dataset.year, emptyResult);
				return emptyResult;
			}

			// Aggregate gender counts by age across all wards
			const aggregatedMales = new Array(91).fill(0);
			const aggregatedFemales = new Array(91).fill(0);

			for (const wardCode of wardCodes) {
				let wardData = dataset.data?.[wardCode];

				// Try to map to the dataset's year if ward code doesn't exist
				if (!wardData && codeMapper?.getCodeForYear) {
					const mappedCode = codeMapper.getCodeForYear(
						"ward",
						wardCode,
						dataset.boundaryYear,
					);
					if (mappedCode) {
						wardData = dataset.data[mappedCode];
					}
				}

				if (wardData) {
					// Sum males and females by age
					for (let age = 0; age < 91; age++) {
						const ageStr = age.toString();
						aggregatedMales[age] += wardData.males[ageStr] || 0;
						aggregatedFemales[age] += wardData.females[ageStr] || 0;
					}
				}
			}

			// Build data array and calculate percentages
			const data: Array<{ age: number; males: number; females: number }> =
				new Array(91);
			const pct: number[] = new Array(91);

			for (let age = 0; age < 91; age++) {
				const m = aggregatedMales[age];
				const f = aggregatedFemales[age];
				const total = m + f;

				data[age] = { age, males: m, females: f };
				pct[age] = total > 0 ? (m / total) * 100 : 50;
			}

			const result = { ageData: data, percentages: pct };

			// Cache the result
			yearCache.set(dataset.year, result);
			return result;
		}

		// Unsupported area type or missing data
		return { ageData: [], percentages: [] };
	}, [dataset, aggregatedData, selectedArea, codeMapper]);

	// Handle mouse move to update tooltip directly without triggering React render
	const handleMouseMove = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			const tooltip = tooltipRef.current;
			if (!tooltip || !containerRef.current) return;

			// Find which age row we are hovering over using event delegation
			// (The target will be one of the bars, closest gets the row wrapper)
			const row = (e.target as HTMLElement).closest("[data-age]");

			if (row && row instanceof HTMLElement) {
				const age = parseInt(row.dataset.age || "0", 10);
				const data = ageData[age];

				if (data) {
					const { males, females } = data;
					const malePct = percentages[age];

					// Direct DOM update - extremely fast, no React overhead
					tooltip.innerHTML = `
            Age ${age}: ${males.toLocaleString()}M / ${females.toLocaleString()}F 
            <span class="opacity-75">(${malePct.toFixed(1)}% male)</span>
          `;

					// Position the tooltip near the row
					// We use fixed positioning or calculation based on container
					const containerRect = containerRef.current.getBoundingClientRect();
					const rowRect = row.getBoundingClientRect();

					// Center tooltip horizontally relative to container
					tooltip.style.left = "50%";
					tooltip.style.transform = "translateX(-50%)";

					// Position above the current row
					const topOffset = rowRect.top - containerRect.top - 8; // 8px buffer
					tooltip.style.top = `${topOffset}px`;

					tooltip.style.opacity = "1";
				}
			} else {
				tooltip.style.opacity = "0";
			}
		},
		[ageData, percentages]
	);

	const handleMouseLeave = useCallback(() => {
		if (tooltipRef.current) {
			tooltipRef.current.style.opacity = "0";
		}
	}, []);

	if (ageData.length === 0) {
		return (
			<div className="text-xs h-27.75 text-gray-400/80 text-center grid place-items-center">
				<div className="mb-4">No data available</div>
			</div>
		);
	}

	return (
		<div className="px-0.5 pt-0 -my-1">
			{/* Age labels */}
			<div className="flex justify-center text-[8px] text-gray-500 mt-0 mx-auto">
				<span>0</span>
			</div>

			<div className="relative rounded" ref={containerRef}>
				{/* Shared Tooltip - Rendered ONCE, updated via Ref */}
				<div
					ref={tooltipRef}
					className="absolute pointer-events-none bg-gray-800 text-white text-[8px] rounded px-1.5 py-0.5 whitespace-nowrap z-20 transition-opacity duration-75"
					style={{ opacity: 0, top: 0, left: 0 }}
				/>

				{/* Center line - using transform for GPU */}
				<div
					className="absolute top-0 bottom-0 w-px bg-gray-300 z-10 translate-x-1/2 left-1/2 pointer-events-none"
					style={{ marginLeft: "-1px" }}
				/>

				{/* Stack of age rows - Optimized Render Loop */}
				<div
					className="relative will-change-contents rounded-sm overflow-hidden"
					onMouseMove={handleMouseMove}
					onMouseLeave={handleMouseLeave}
				>
					{AGE_INDICES.map((age) => {
						const data = ageData[age];
						if (!data) return null;

						const { males, females } = data;
						const total = males + females;

						if (total === 0) {
							return <div key={age} className="h-px" />;
						}

						const malePercentage = percentages[age];
						const femalePercentage = 100 - malePercentage;

						return (
							<div
								key={age}
								data-age={age}
								className="flex h-px relative hover:bg-gray-100/10" // Added faint hover effect
							>
								{/* Males (left) */}
								<div
									className="bg-blue-400 pointer-events-none" // prevent target interference
									style={{ width: `${malePercentage}%` }}
								/>

								{/* Females (right) */}
								<div
									className="bg-pink-400 pointer-events-none" // prevent target interference
									style={{ width: `${femalePercentage}%` }}
								/>
							</div>
						);
					})}
				</div>
			</div>

			{/* Age labels */}
			<div className="flex justify-center text-[8px] text-gray-500 mt-1 -mb-1">
				<span>90</span>
			</div>
		</div>
	);
}

export default memo(GenderBalanceByAgeChart);