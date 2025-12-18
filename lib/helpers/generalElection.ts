import { ConstituencyData } from "../types";

export const getWinningParty = (data: ConstituencyData): string => {
    let winningParty = '';
    let maxVotes = 0;

    for (const [party, votes] of Object.entries(data.partyVotes)) {
        if (votes > maxVotes) {
            maxVotes = votes;
            winningParty = party;
        }
    }

    return winningParty;
}

export const calculateTurnout = (validVotes: number, invalidVotes: number, electorate: number) => {
	if (!electorate || electorate === 0) {
        return null;
    }

	const totalVotes = validVotes + invalidVotes;
	return (totalVotes / electorate) * 100;
};