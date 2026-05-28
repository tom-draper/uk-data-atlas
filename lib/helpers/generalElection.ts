import {
	GeneralElectionConstituencyData,
	PartyVotes,
	PartyCode,
	ProcessedPartyData,
} from "../types";
import { Party } from "../types/common";
import { PARTIES } from "../data/election/parties";

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
			return [{
				key: party.key,
				name: party.name,
				color: PARTIES[party.key as PartyCode]?.color || "#999",
				votes,
				percentage,
			}];
		})
		.sort((a, b) => b.votes - a.votes);
};
