import type { MeasureDimensionsConfig } from "./measureDimensions.ts";
import { MEASURE_DEFAULT_MEMBERS } from "./measurePreferences.ts";

/**
 * What the API serves that the statistics tables do not hold: three measures
 * computed at request time. The members chosen when a request names none and
 * a measure's series have no one total in common, such as households counted
 * by tenure and by car availability, are declared in `measurePreferences.ts`.
 */
export const MEASURE_DIMENSIONS_CONFIG: MeasureDimensionsConfig = {
	measures: {
		"winning-party": {
			label: "Winning party",
			description:
				"The party whose candidate won the contest, or won most seats in a multi-member ward.",
			reason: "The statistics tables hold the winner as text on each contest, not as a series.",
		},
		"effective-votes": {
			label: "Effective votes",
			description:
				"Votes counted towards party totals in a local election, as the publisher defines them.",
			reason: "The statistics tables hold the party votes it sums, not the sum, so it is read as their total.",
		},
		"population-density": {
			label: "Population density",
			description:
				"Residents per square kilometre, computed from the population estimate and the area's land area.",
			reason: "Computed from the population and land area series of two datasets, so it has no series of its own.",
		},
	},
	dimensions: {},
	members: {},
	defaults: MEASURE_DEFAULT_MEMBERS,
};
