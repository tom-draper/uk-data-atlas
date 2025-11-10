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