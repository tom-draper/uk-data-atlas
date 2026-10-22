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
