/**
 * English local authorities created in April 2023, with the abolished
 * districts whose values must be combined when a source predates the change.
 */
export const APRIL_2023_LAD_MERGERS = {
	E06000063: {
		name: "Cumberland",
		predecessors: ["E07000026", "E07000028", "E07000029"],
	},
	E06000064: {
		name: "Westmorland and Furness",
		predecessors: ["E07000027", "E07000030", "E07000031"],
	},
	E06000065: {
		name: "North Yorkshire",
		predecessors: [
			"E07000163",
			"E07000164",
			"E07000165",
			"E07000166",
			"E07000167",
			"E07000168",
			"E07000169",
		],
	},
	E06000066: {
		name: "Somerset",
		predecessors: ["E07000187", "E07000188", "E07000189", "E07000246"],
	},
} as const;
