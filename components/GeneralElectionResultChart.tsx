// components/GeneralElectionResultChart.tsx
'use client';
import { PARTY_COLORS } from '@/lib/data/parties';
import { GeneralElectionDataset } from '@/lib/hooks/useGeneralElectionData';
import { ChartData } from '@lib/types';
import { useMemo } from 'react';

interface GeneralElectionResultChartProps {
	activeDataset: any; // Could be local or general election dataset
	availableDatasets: GeneralElectionDataset[];
	onDatasetChange: (datasetId: string) => void;
	constituencyId?: string; // ONS ID when hovering over a constituency
}

export default function GeneralElectionResultChart({
	activeDataset,
	availableDatasets,
	onDatasetChange,
	constituencyId,
}: GeneralElectionResultChartProps) {
	
	console.log('GeneralElectionResultChart props:', { activeDataset, availableDatasets, constituencyId });
	console.log('availableDatasets details:', availableDatasets.map(d => ({ id: d.id, name: d.name, type: d.type })));
	
	const dataset2024 = availableDatasets.find(d => d.id === 'general-2024');
	
	console.log('Found dataset2024:', dataset2024);

	const { chartData2024, turnout2024, constituencyName } = useMemo(() => {
		if (!dataset2024) {
			return { chartData2024: undefined, turnout2024: undefined, constituencyName: undefined };
		}

		// If we have a specific constituency selected (hovering), use that constituency's data
		if (constituencyId && constituencyId.trim() && dataset2024.constituencyData[constituencyId]) {
			const data = dataset2024.constituencyData[constituencyId];

			console.log('HEEEEER', data)
			
			return {
				chartData2024: {
					LAB: data.LAB || 0,
					CON: data.CON || 0,
					LD: data.LD || 0,
					GREEN: data.GREEN || 0,
					REF: data.RUK || 0,
					SNP: data.SNP || 0,
					PC: data.PC || 0,
					DUP: data.DUP || 0,
					SF: data.SF || 0,
					IND: data.OTHER || 0,
				},
				turnout2024: data.turnoutPercent,
				constituencyName: data.constituencyName,
			};
		}

		// No constituency selected - could show aggregated data here in the future
		return { chartData2024: undefined, turnout2024: undefined, constituencyName: undefined };
	}, [constituencyId, dataset2024]);

	const renderCompactBar = (data: ChartData | undefined, dataset: GeneralElectionDataset) => {
		if (!data) {
			return <div className="text-xs text-gray-400 pt-3 text-center">No data available</div>;
		}

		const parties = dataset.partyInfo;
		const totalVotes = parties.reduce((sum, p) => sum + (data[p.key] || 0), 0);

		console.log('DATASET', dataset)
		console.log('PARTIES', parties)

		if (totalVotes === 0) {
			return <div className="text-xs text-gray-400 pt-3 text-center">No votes recorded</div>;
		}

		return (
			<div className="space-y-1">
				{/* Main bar showing all parties */}
				<div className="flex h-5 rounded overflow-hidden bg-gray-200 gap-0">
					{parties.map(party => {
						console.log(data);
						console.log('Rendering party:', party);
						console.log('Party votes:', data[party.key]);
						console.log('Total votes:', totalVotes);
						const votes = data[party.key] || 0;
						const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
						
						if (percentage === 0) return null;
						
						return (
							<div
								key={party.key}
								style={{
									width: `${percentage}%`,
									backgroundColor: PARTY_COLORS[party.key],
								}}
								title={`${party.name}: ${votes.toLocaleString()} (${percentage.toFixed(1)}%)`}
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
					{parties
						.filter(party => (data[party.key] || 0) > 0)
						.map(party => (
							<div key={party.key} className="flex items-center gap-1">
								<div
									className="w-1.5 h-1.5 rounded-sm shrink-0"
									style={{ backgroundColor: PARTY_COLORS[party.key] }}
								/>
								<span className="truncate font-medium">
									{party.key}: {(data[party.key] || 0).toLocaleString()}
								</span>
							</div>
						))}
				</div>
			</div>
		);
	};

	const renderYearBar = (
		year: string,
		data: ChartData | undefined,
		dataset: GeneralElectionDataset | undefined,
		turnout: number | undefined,
		constituencyName: string | undefined,
		isActive: boolean
	) => {
		if (!dataset) {
			return <div className="text-xs text-gray-400 pt-3 text-center">No data available</div>;
		}

		const yearColors: Record<string, { bg: string; border: string }> = {
			'general-2024': { bg: 'bg-indigo-50/60', border: 'border-indigo-400' },
		};

		const colors = yearColors[dataset.id] || { bg: 'bg-indigo-50/60', border: 'border-indigo-400' };

		return (
			<div
				key={dataset.id}
				className={`p-2 h-[95px] rounded transition-all cursor-pointer ${
					isActive
						? `${colors.bg} border-2 ${colors.border}`
						: `bg-white/60 border-2 border-gray-200/80 hover:border-indigo-300`
				}`}
				onClick={() => onDatasetChange(dataset.id)}
			>
				<div className="flex items-center justify-between mb-1.5">
					<div>
						<h3 className="text-xs font-bold">{year} General Election</h3>
					</div>
					<div className="flex items-center gap-1.5">
						{turnout !== undefined && (
							<span className="text-[9px] text-gray-500 font-medium">
								{turnout.toFixed(1)}% turnout
							</span>
						)}
					</div>
				</div>
				{renderCompactBar(data, dataset)}
			</div>
		);
	};

	return (
		<div className="space-y-2">
			<h3 className="text-xs font-bold text-gray-700 pt-2">General Election Results</h3>
			{renderYearBar(
				'2024',
				chartData2024,
				dataset2024,
				turnout2024,
				constituencyName,
				activeDataset.id === 'general-2024'
			)}
		</div>
	);
};