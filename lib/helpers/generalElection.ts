import { ConstituencyData, PartyVotes, PartyCode, ProcessedPartyData } from "../types";
import { Party } from "../types/common";
import { PARTIES } from "../data/election/parties";

export const getWinningParty = (data: ConstituencyData): string => {
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
	const totalVotes = Object.values(rawPartyVotes).reduce<number>((a, b) => a + (b ?? 0), 0);
	if (totalVotes === 0) return [];

	return partyInfo
		.map((party) => {
			const votes = rawPartyVotes[party.key as PartyCode] || 0;
			return {
				key: party.key,
				name: party.name,
				color: PARTIES[party.key as PartyCode]?.color || "#999",
				votes,
				percentage: (votes / totalVotes) * 100,
			};
		})
		.filter((p) => p.percentage > 0)
		.sort((a, b) => b.votes - a.votes);
};
