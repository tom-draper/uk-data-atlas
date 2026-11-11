import type { AggregatedCrimeData, CrimeLADData } from "../../types/crime.ts";

/**
 * With no area selected the card shows the mean authority total; an authority
 * the table did not attribute has no record and is left out.
 */
export const aggregateCrime = (
	records: CrimeLADData[],
): AggregatedCrimeData | null =>
	records.length === 0
		? null
		: {
				totalRecordedCrime:
					records.reduce(
						(total, record) => total + record.totalRecordedCrime,
						0,
					) / records.length,
			};
