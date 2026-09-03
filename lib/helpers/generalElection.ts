import { PartyVotes, PartyCode, Party } from "../types/common";
import {
	AggregatedGeneralElectionData,
	GeneralElectionConstituencyData,
	GeneralElectionDataset,
	ProcessedPartyData,
} from "../types/elections";
import { PARTIES } from "../data/election/parties";
import type { SelectedArea } from "../types/areas";

export const getWinningParty = (
	data: GeneralElectionConstituencyData,
): string => {
	let winningParty = "";
	let maxVotes = 0;

	for (const [party, votes] of Object.entries(data.partyVotes)) {
		if (votes !== undefined && votes > maxVotes) {
			maxVotes = votes;
			winningParty = party;
		}
	}

	return winningParty;
};

export const calculateTurnout = (
	validVotes: number,
	invalidVotes: number,
	electorate: number,
) => {
	if (!electorate || electorate === 0) {
		return null;
	}

	const totalVotes = validVotes + invalidVotes;
	return (totalVotes / electorate) * 100;
};

export const processPartyVotes = (
	rawPartyVotes: PartyVotes,
	partyInfo: Party[],
): ProcessedPartyData[] => {
	const totalVotes = Object.values(rawPartyVotes).reduce<number>(
		(a, b) => a + (b ?? 0),
		0,
	);
	if (totalVotes === 0) return [];

	return partyInfo
		.flatMap((party) => {
			const votes = rawPartyVotes[party.key as PartyCode] || 0;
			const percentage = (votes / totalVotes) * 100;
			if (percentage <= 0) return [];
			return [
				{
					key: party.key,
					name: party.name,
					color: PARTIES[party.key as PartyCode]?.color || "#999",
					votes,
					percentage,
				},
			];
		})
		.sort((a, b) => b.votes - a.votes);
};

export interface ProcessedGeneralElectionYearData {
	year: number;
	dataset: GeneralElectionDataset | null;
	partyData: ProcessedPartyData[];
	totalVotes: number;
	turnout: number | null;
	isAggregated: boolean;
	seatsSummary: { party: string; count: number; color: string }[] | null;
	totalSeats: number | null;
	hasData: boolean;
}

export function computeGeneralElectionYearData(
	year: number,
	dataset: GeneralElectionDataset | undefined,
	aggregatedData: Record<number, AggregatedGeneralElectionData> | null,
	selectedArea: SelectedArea | null,
	getCodeForYear:
		| ((
				type: "constituency",
				code: string,
				targetYear: number,
		  ) => string | undefined)
		| undefined,
	excluded: Set<string> | undefined,
	selectedParty: string | undefined,
): ProcessedGeneralElectionYearData {
	if (!dataset) {
		return {
			year,
			dataset: null,
			partyData: [],
			totalVotes: 0,
			turnout: null,
			isAggregated: false,
			seatsSummary: null,
			totalSeats: null,
			hasData: false,
		};
	}

	let rawPartyVotes: PartyVotes | null = null;
	let turnout: number | null = null;
	let isAggregated = false;
	let seatsSummary: { party: string; count: number; color: string }[] | null =
		null;
	let totalSeats: number | null = null;

	if (selectedArea && selectedArea.type === "constituency") {
		const constituencyCode = selectedArea.code;
		let data = dataset.data?.[constituencyCode];

		if (!data && getCodeForYear) {
			const mappedCode = getCodeForYear(
				"constituency",
				constituencyCode,
				year,
			);
			if (mappedCode) {
				data = dataset.data?.[mappedCode];
			}
		}

		if (data) {
			rawPartyVotes = data.partyVotes;
			turnout = calculateTurnout(
				data.validVotes,
				data.invalidVotes,
				data.electorate,
			);
		}
	} else if (selectedArea === null && aggregatedData?.[year]) {
		const agg = aggregatedData[year];
		if (agg.partyVotes) {
			rawPartyVotes = agg.partyVotes as PartyVotes;
			turnout = calculateTurnout(
				agg.validVotes,
				agg.invalidVotes,
				agg.electorate,
			);
			isAggregated = true;
			totalSeats = agg.totalSeats;

			seatsSummary = Object.entries(agg.partySeats)
				.sort(([, a], [, b]) => (b as number) - (a as number))
				.map(([key, count]) => ({
					party: key as PartyCode,
					count: count as number,
					color: PARTIES[key as PartyCode]?.color || "#ccc",
				}));
		}
	}

	if (!rawPartyVotes) {
		return {
			year,
			dataset,
			partyData: [],
			totalVotes: 0,
			turnout: null,
			isAggregated: false,
			seatsSummary: null,
			totalSeats: null,
			hasData: false,
		};
	}

	const filteredVotes =
		excluded?.size || selectedParty
			? Object.fromEntries(
					Object.entries(rawPartyVotes).filter(
						([party]) =>
							!excluded?.has(party) &&
							(!selectedParty || party === selectedParty),
					),
				)
			: rawPartyVotes;
	const partyData = processPartyVotes(filteredVotes, dataset.partyInfo);
	const totalVotes = partyData.reduce((a, p) => a + p.votes, 0);

	return {
		year,
		dataset,
		partyData,
		totalVotes,
		turnout,
		isAggregated,
		seatsSummary,
		totalSeats,
		hasData: partyData.length > 0,
	};
}
