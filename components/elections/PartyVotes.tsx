"use client";

import { formatCount } from "@/lib/helpers/formatCount";

export interface PartyVotes {
	key: string;
	name: string;
	color: string;
	votes: number;
	percentage: number;
}

export function VoteBar({ data }: { data: PartyVotes[] }) {
	return (
		<div className="flex h-5 rounded overflow-hidden bg-gray-200 gap-0 w-full">
			{data.map((p) => (
				<div
					key={p.key}
					style={{
						width: `${p.percentage}%`,
						backgroundColor: p.color,
					}}
					title={`${p.name}: ${formatCount(p.votes)} (${p.percentage.toFixed(1)}%)`}
					className="group relative hover:opacity-80 transition-opacity"
				>
					{p.percentage > 12 && (
						<span className="text-white text-[9px] font-bold px-0.5 leading-5 truncate block">
							{p.key}
						</span>
					)}
				</div>
			))}
		</div>
	);
}

export function PartyVotesGrid({ partyData }: { partyData: PartyVotes[] }) {
	return (
		<div className="grid grid-cols-3 gap-0.5 text-[9px]">
			{partyData.map((p) => (
				<div key={p.key} className="flex items-center gap-1">
					<div
						className="size-1.5 rounded-sm shrink-0"
						style={{ backgroundColor: p.color }}
					/>
					<span className="truncate font-medium">
						{p.key}: {formatCount(p.votes)}
					</span>
				</div>
			))}
		</div>
	);
}
