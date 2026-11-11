import { denominator } from "../../helpers/rates.ts";
import type {
	AggregatedHomelessnessData,
	HomelessnessLADData,
} from "../../types/homelessness.ts";

export function aggregateHomelessness(
	records: HomelessnessLADData[],
): AggregatedHomelessnessData | null {
	if (records.length === 0) return null;
	let householdsInTemporaryAccommodation = 0;
	let householdsWithChildren = 0;
	let childrenInTemporaryAccommodation = 0;
	// The rate is per thousand of all households in the authority, so the
	// combined rate pools those households, recovered from the count and rate.
	let households = 0;
	let ratedInTemporaryAccommodation = 0;
	for (const record of records) {
		householdsInTemporaryAccommodation +=
			record.householdsInTemporaryAccommodation;
		householdsWithChildren += record.householdsWithChildren;
		childrenInTemporaryAccommodation +=
			record.childrenInTemporaryAccommodation;
		const all = denominator(
			record.householdsInTemporaryAccommodation,
			1000,
			record.householdsPerThousand,
		);
		if (all === null) continue;
		households += all;
		ratedInTemporaryAccommodation +=
			record.householdsInTemporaryAccommodation;
	}
	return {
		householdsInTemporaryAccommodation,
		householdsPerThousand:
			households > 0
				? (ratedInTemporaryAccommodation / households) * 1000
				: 0,
		householdsWithChildren,
		childrenInTemporaryAccommodation,
	};
}
