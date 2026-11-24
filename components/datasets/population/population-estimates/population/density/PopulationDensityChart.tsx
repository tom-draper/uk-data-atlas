import { formatDatasetCoverage } from "@/lib/helpers/datasetCoverage";
import type {
	ActiveViz,
	AggregatedPopulationData,
	BoundaryData,
	PopulationDataset,
	SelectedArea,
} from "@/lib/types";
import type { PopulationCodeResolver } from "@/lib/data/boundaries/codeMapper";
import type { LadResolver } from "@/lib/helpers/selectedAreaLad";
import {
	ChartContentPlaceholder,
	useChartsLoading,
} from "@/components/ChartLoadingPlaceholder";
import { ChartCard } from "@/components/ChartCard";
import { resolvePopulationDensity } from "@/lib/helpers/populationDensity";
import { useIsDark } from "@/lib/context/ThemeContext";
import { formatCount } from "@/lib/helpers/formatCount";
import { getProp } from "@uk-data-atlas/datasets";
import { BOUNDARY_CATALOG } from "@/lib/data/boundaries/catalog";
import { featureAreaSqKm } from "@/lib/data/boundaries/derived";
import {
	formatNationCoverage,
	useNationPopulation,
	type NationPopulationState,
} from "@/lib/hooks/useNationPopulation";
import { loadCouncilDensity } from "@/lib/measures/populationDensity";
import { useLoaded } from "@/lib/measures/useLoaded";
import type { BoundaryType } from "@/lib/types";

interface PopulationDensityChartProps {
	dataset: PopulationDataset;
	aggregatedData: Record<number, AggregatedPopulationData> | null;
	boundaryData: BoundaryData;
	selectedArea: SelectedArea | null;
	codeMapper?: PopulationCodeResolver & LadResolver;
	activeViz: ActiveViz;
	setActiveViz: (value: ActiveViz) => void;
}

const createSeededRandom = (seed: number) => {
	let currentSeed = seed;
	return () => {
		currentSeed = (currentSeed * 9301 + 49297) % 233280;
		return currentSeed / 233280;
	};
};

const DENSITY_CATEGORIES = [
	{
		threshold: 2000,
		label: "Low",
		hex: "#22c55e",
		color: "bg-green-500",
		count: 15,
		variations: ["bg-green-400", "bg-green-500", "bg-green-600"],
	},
	{
		threshold: 5000,
		label: "Medium",
		hex: "#eab308",
		color: "bg-yellow-500",
		count: 30,
		variations: ["bg-yellow-400", "bg-yellow-500", "bg-yellow-600"],
	},
	{
		threshold: Infinity,
		label: "High",
		hex: "#ef4444",
		color: "bg-red-500",
		count: 50,
		variations: ["bg-red-400", "bg-red-500", "bg-red-600"],
	},
] as const;

const getDensityCategory = (density: number) => {
	for (const category of DENSITY_CATEGORIES) {
		if (density < category.threshold) return category;
	}
	return DENSITY_CATEGORIES[DENSITY_CATEGORIES.length - 1];
};

function DensityGrid({ density }: { density: number }) {
	const gridWidth = 18;
	const gridHeight = 4;
	const totalSquares = gridWidth * gridHeight;
	const squareClasses = (() => {
		const category = getDensityCategory(density);
		const seededRandom = createSeededRandom(Math.floor(density));
		const indices = Array.from(
			{ length: totalSquares },
			(_, index) => index,
		);
		for (let index = indices.length - 1; index > 0; index--) {
			const randomIndex = Math.floor(seededRandom() * (index + 1));
			[indices[index], indices[randomIndex]] = [
				indices[randomIndex],
				indices[index],
			];
		}
		const colors = new Array(totalSquares).fill("bg-gray-200");
		for (let index = 0; index < category.count; index++) {
			const square = indices[index];
			const colorIndex = Math.floor(
				seededRandom() * category.variations.length,
			);
			colors[square] = category.variations[colorIndex];
		}
		return colors;
	})();

	return (
		<div
			className="absolute inset-0 grid gap-0.5 p-0 opacity-25"
			style={{
				gridTemplateColumns: `repeat(${gridWidth}, 1fr)`,
				gridTemplateRows: `repeat(${gridHeight}, 1fr)`,
			}}
		>
			{squareClasses.map((className, index) => (
				<div key={index} className={`rounded-xs ${className}`} />
			))}
		</div>
	);
}

/** The area of a boundary on the map, in square kilometres, if loaded. */
const boundaryAreaSqKm = (
	boundaryData: BoundaryData,
	type: string,
	year: number,
	code: string,
): number | null => {
	const geojson = (
		boundaryData as Partial<
			Record<string, Record<number, { features: unknown[] } | null>>
		>
	)[type]?.[year];
	const keys = BOUNDARY_CATALOG[type as BoundaryType]?.properties.code;
	if (!geojson || !keys) return null;
	const feature = (
		geojson.features as Parameters<typeof featureAreaSqKm>[0][]
	).find((candidate) => getProp(candidate.properties, keys) === code);
	return feature ? featureAreaSqKm(feature) : null;
};

/**
 * Density for an area in a nation the dataset leaves out. A council's is the
 * published density for the year of its population, with the land area that
 * density was calculated over; a data zone's is its population over its
 * boundary's area.
 */
function useNationDensity(
	nation: NationPopulationState | null,
	boundaryData: BoundaryData,
) {
	const target = nation?.target;
	const total = nation?.population?.total ?? null;
	const period = nation?.population?.period;
	const council =
		target?.geography === "localAuthority" && total != null && period
			? target.code
			: undefined;
	const published = useLoaded(
		council && period
			? {
					key: `population-density|${council}|${period}`,
					load: () => loadCouncilDensity(council, period),
				}
			: null,
	);
	if (!nation || !target) return null;
	const councilDensity =
		council && published.status === "ready" ? published.value : null;
	const areaSqKm = council
		? councilDensity && total != null
			? total / councilDensity.perSqKm
			: null
		: boundaryAreaSqKm(
				boundaryData,
				target.geography,
				target.boundaryYear,
				target.code,
			);
	return {
		total,
		areaSqKm,
		density: council
			? (councilDensity?.perSqKm ?? null)
			: total != null && areaSqKm
				? total / areaSqKm
				: null,
		loading:
			nation.status === "loading" ||
			(!!council &&
				(published.status === "loading" ||
					published.status === "idle")),
		areaSource: council
			? "Density over land area, without inland water: Office for National Statistics, Standard Area Measurements."
			: "Area of the data zone's boundary.",
	};
}

export default function PopulationDensityChart({
	dataset,
	aggregatedData,
	boundaryData,
	selectedArea,
	codeMapper,
	activeViz,
	setActiveViz,
}: PopulationDensityChartProps) {
	const chartsLoading = useChartsLoading();
	const isDark = useIsDark();
	const isActive =
		activeViz.datasetId === dataset.id && activeViz.view === "density";
	// An area in a nation the dataset leaves out is read from that nation's
	// own estimates, labelled with their year and publisher.
	const nation = useNationPopulation(dataset, selectedArea, codeMapper);
	const nationDensity = useNationDensity(nation, boundaryData);
	const { density, areaSqKm, total, fallbackLadCode } = nation
		? {
				density: nationDensity?.density ?? null,
				areaSqKm: nationDensity?.areaSqKm ?? null,
				total: nationDensity?.total ?? null,
				fallbackLadCode: undefined,
			}
		: resolvePopulationDensity({
				dataset,
				aggregatedData,
				boundaryData,
				selectedArea,
				codeMapper,
			});
	const accentColor =
		density !== null ? getDensityCategory(density).hex : null;

	return (
		<ChartCard
			coverage={
				nation
					? formatNationCoverage(
							nation,
							formatDatasetCoverage(dataset),
							dataset.year,
						)
					: formatDatasetCoverage(dataset)
			}
			heading={`Population Density [${nation ? (nation.population?.period ?? nation.nation) : dataset.year}]`}
			accent={accentColor}
			isActive={isActive}
			title={
				nation
					? [nation.source, nationDensity?.areaSource]
							.filter(Boolean)
							.join(" ") || undefined
					: "Office for National Statistics. Ward population estimates, mid-2022, England and Wales. ons.gov.uk"
			}
			onClick={() =>
				setActiveViz({
					datasetId: dataset.id,
					view: "density",
					datasetType: dataset.type,
					datasetYear: dataset.year,
				})
			}
		>
			{!total || density === null || areaSqKm === null ? (
				<div className="h-14 flex items-center justify-center">
					{chartsLoading || nationDensity?.loading ? (
						<ChartContentPlaceholder className="size-full" />
					) : (
						<div
							className={`text-xs text-center pb-2 ${isDark ? "text-gray-400" : "text-gray-400/80"}`}
						>
							{nation
								? nation.population
									? `${nation.nation}'s area is not loaded for this boundary`
									: nation.note
								: "No data available"}
						</div>
					)}
				</div>
			) : (
				<div className="relative h-14 overflow-hidden">
					<DensityGrid density={density} />
					<div className="relative py-1 h-full flex flex-col justify-between pl-4">
						<div className="flex items-baseline gap-2">
							<div className="text-xl font-bold">
								{formatCount(Math.round(density))}
							</div>
							<div className="text-sm">people/km²</div>
						</div>
						<div className="flex text-left text-xs pb-1">
							<div className="flex pr-3">
								<div className="mr-1">Population</div>
								<div className="font-semibold">
									{formatCount(total)}
								</div>
							</div>
							<div className="flex">
								<div className="mr-1">Area</div>
								<div className="font-semibold">
									{areaSqKm.toFixed(1)} km²
								</div>
							</div>
							{nation?.population && (
								<div
									className={`ml-auto pr-2 ${isDark ? "text-gray-400" : "text-gray-500"}`}
								>
									{nation.note}
								</div>
							)}
							{fallbackLadCode && (
								<div
									className={`ml-auto pr-2 ${isDark ? "text-gray-400" : "text-gray-500"}`}
									title={`No census population is published for this ward's boundaries, so the figures shown are for its local authority (${fallbackLadCode}).`}
								>
									Local authority
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</ChartCard>
	);
}
