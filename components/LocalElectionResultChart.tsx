// components/LocalElectionResultChart.tsx
'use client';
import { PARTY_COLORS } from '@/lib/data/parties';
import { WardCodeMapper } from '@/lib/hooks/useWardCodeMapper';
import { AggregatedLocalElectionData, ChartData, Dataset, LocalElectionDataset } from '@lib/types';
import React, { useMemo, useCallback } from 'react';

interface LocalElectionResultChartProps {
	activeDataset: Dataset;
	availableDatasets: Record<string, LocalElectionDataset | null>;
	setActiveDatasetId: (datasetId: string) => void;
	wardCode: string;
	aggregatedData: AggregatedLocalElectionData;
	wardCodeMapper: WardCodeMapper
}

const ELECTION_YEARS = ['2024', '2023', '2022', '2021'] as const;
type ElectionYear = typeof ELECTION_YEARS[number];

interface CompactBarProps {
	data: ChartData | undefined;
	dataset: Dataset;
}

/**
 * Memoized component to render the party vote bar and legend.
 * Will not re-render if `data` and `dataset` props are unchanged.
 */
const CompactBar = React.memo(({ data, dataset }: CompactBarProps) => {
	if (!data) {
		return <div className="text-xs text-gray-400 pt-3 text-center">No data available</div>;
	}

	const parties = dataset.partyInfo;
	const totalVotes = parties.reduce((sum, p) => sum + (data[p.key] || 0), 0);

	if (totalVotes === 0) {
		return <div className="text-xs text-gray-400 pt-3 text-center">No votes recorded</div>;
	}

	return (
		<div className="space-y-1">
			{/* Main bar showing all parties */}
			<div className="flex h-5 rounded overflow-hidden bg-gray-200  gap-0">
				{parties.map(party => {
					const votes = data[party.key] || 0;
					const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
					return (
						<div
							key={party.key}
							style={{
								width: `${percentage}%`,
								backgroundColor: PARTY_COLORS[party.key],
							}}
							title={`${party.name}: ${votes.toLocaleString()}`}
							className="group relative hover:opacity-80 transition-opacity"
						>
							{percentage > 12 && (
								<span className="text-white text-[9px] font-bold px-0.5 leading-5 truncate">
									{party.key}
								</span>
							)}
						</div>
					);
				})}
			</div>
			{/* Compact legend */}
			<div className="grid grid-cols-3 gap-0.5 text-[9px]">
				{parties.filter((party) => data[party.key]).map(party => (
					<div key={party.key} className="flex items-center gap-1">
						<div
							className="w-1.5 h-1.5 rounded-sm shrink-0"
							style={{ backgroundColor: PARTY_COLORS[party.key] }}
						/>
						<span className="truncate font-medium">
							{(data[party.key] || 0).toLocaleString()}
						</span>
					</div>
				))}
			</div>
		</div>
	);
});
// Add a display name for better debugging
CompactBar.displayName = 'CompactBar';

interface YearBarProps {
	year: string;
	data: ChartData | undefined;
	dataset: Dataset; // No longer nullable, we'll check this in the parent
	turnout: number | undefined;
	isActive: boolean;
	setActiveDatasetId: (datasetId: string) => void;
}

const yearColors: Record<string, { bg: string; border: string; badge: string; text: string }> = {
	'2024': { bg: 'bg-blue-50/60', border: 'border-blue-300', badge: 'bg-blue-300 text-blue-900', text: 'bg-blue-200 text-blue-800' },
	'2023': { bg: 'bg-amber-50/60', border: 'border-amber-300', badge: 'bg-amber-300 text-amber-900', text: 'bg-amber-200 text-amber-800' },
	'2022': { bg: 'bg-purple-50/60', border: 'border-purple-300', badge: 'bg-purple-300 text-purple-900', text: 'bg-purple-200 text-purple-800' },
	'2021': { bg: 'bg-emerald-50/60', border: 'border-emerald-300', badge: 'bg-emerald-300 text-emerald-900', text: 'bg-emerald-200 text-emerald-800' },
};

const YearBar = React.memo(({ year, data, dataset, turnout, isActive, setActiveDatasetId }: YearBarProps) => {
	const colors = yearColors[year] || yearColors['2024'];

	const handleClick = useCallback(() => {
		setActiveDatasetId(year);
	}, [setActiveDatasetId, year]);

	return (
		<div
			className={`p-2 h-[95px] rounded transition-all cursor-pointer ${isActive
				? `${colors.bg} border-2 ${colors.border}`
				: `bg-white/60 border-2 border-gray-200/80 hover:${colors.border.replace('border-', 'hover:border-')}`
				}`}
			onClick={handleClick}
		>
			<div className="flex items-center justify-between mb-1.5">
				<h3 className="text-xs font-bold">{year} Local Elections</h3>
				<div className="flex items-center gap-1.5">
					{turnout !== undefined && (
						<span className="text-[9px] text-gray-500 font-medium">
							{turnout.toFixed(1)}% turnout
						</span>
					)}
				</div>
			</div>
			{/* Render the memoized CompactBar component */}
			<CompactBar data={data} dataset={dataset} />
		</div>
	);
});
// Add a display name for better debugging
YearBar.displayName = 'YearBar';

export default function LocalElectionResultChart({
	activeDataset,
	availableDatasets,
	setActiveDatasetId,
	wardCode,
	aggregatedData,
	wardCodeMapper
}: LocalElectionResultChartProps) {

	// This useMemo hook is already optimized from before
	const { chartData, turnout } = useMemo(() => {
		const newChartData: Partial<Record<ElectionYear, ChartData | undefined>> = {};
		const newTurnout: Partial<Record<ElectionYear, number | undefined>> = {};

		const getChartData = (year: ElectionYear): { chartData: ChartData | undefined; turnout: number | undefined } => {
			const yearData = availableDatasets[year]?.wardData;

			if (wardCode && yearData) {
				// Try the ward code directly first
				let data = yearData[wardCode];

				// If not found, try converting the ward code to this year
				if (!data) {
					const convertedCode = wardCodeMapper.convertWardCode(wardCode, parseInt(year) as 2024 | 2023 | 2022 | 2021);
					if (convertedCode) {
						data = yearData[convertedCode];
					}
				}

				// If we found data, return it
				if (data) {
					return {
						chartData: {
							LAB: (data.LAB as number) || 0,
							CON: (data.CON as number) || 0,
							LD: (data.LD as number) || 0,
							GREEN: (data.GREEN as number) || 0,
							REF: (data.REF as number) || 0,
							IND: (data.IND as number) || 0,
							DUP: (data.DUP as number) || 0,
							PC: (data.PC as number) || 0,
							SNP: (data.SNP as number) || 0,
							SF: (data.SF as number) || 0,
							APNI: (data.APNI as number) || 0,
							SDLP: (data.SDLP as number) || 0,
						},
						turnout: data.turnoutPercent
					};
				}
			}

			// Fallback to aggregated data
			if (!wardCode && aggregatedData && aggregatedData[year]) {
				return {
					chartData: aggregatedData[year],
					turnout: undefined
				};
			}

			return { chartData: undefined, turnout: undefined };
		};

		for (const year of ELECTION_YEARS) {
			const data = getChartData(year);
			newChartData[year] = data.chartData;
			newTurnout[year] = data.turnout;
		}

		return {
			chartData: newChartData,
			turnout: newTurnout
		};
	}, [wardCode, availableDatasets, aggregatedData]);

	return (
		<div className="space-y-2 border-t border-gray-200/80">
			<h3 className="text-xs font-bold text-gray-700 pt-2">Local Election Results</h3>

			{ELECTION_YEARS.map(year => {
				const dataset = availableDatasets[year];
				if (!dataset) {
					return null;
				}

				return (
					<YearBar
						key={year}
						year={year}
						data={chartData[year]}
						dataset={dataset}
						turnout={turnout[year]}
						isActive={activeDataset.id === year}
						setActiveDatasetId={setActiveDatasetId}
					/>
				);
			})}
		</div>
	);
};