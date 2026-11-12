import {
	ELECTORATE,
	REJECTED_BALLOTS,
	TURNOUT,
	VALID_VOTES,
	measure,
} from "../../declaration/measures.ts";
import {
	periods,
	type DeclaredDimension,
} from "../../declaration/statistics.ts";

/** What the two EU referendum datasets share: measures, answers and the day. */

export const REFERENDUM = [
	ELECTORATE,
	VALID_VOTES,
	REJECTED_BALLOTS,
	measure(
		"referendum-votes",
		"Referendum votes",
		"votes",
		"count",
		"sum",
		"Valid votes cast for an answer.",
	),
	measure(
		"referendum-vote-share",
		"Referendum vote share",
		"percent",
		"share",
		"ratio",
		"Votes for an answer as a percentage of valid votes.",
		{ numerator: "referendum-votes", denominator: "valid-votes" },
	),
	TURNOUT,
];

export const ANSWER: DeclaredDimension = {
	slug: "referendum-answer",
	label: "Referendum answer",
	members: [
		{ key: "remain", label: "Remain a member of the European Union" },
		{ key: "leave", label: "Leave the European Union" },
	],
};

export const referendumDay = () => periods.date("2016-06-23");
