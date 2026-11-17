import type {
	AggregatedLifeExpectancyData,
	LifeExpectancyLADData,
} from "../../../types/lifeExpectancy.ts";

/** The mean of the authorities' male and female life expectancy, each counted once. */
export function aggregateLifeExpectancy(
	records: LifeExpectancyLADData[],
): AggregatedLifeExpectancyData {
	let male = 0;
	let female = 0;
	for (const record of records) {
		male += record.maleBirthLE;
		female += record.femaleBirthLE;
	}
	const count = records.length;
	return {
		averageMaleLE: count > 0 ? male / count : 0,
		averageFemaleLE: count > 0 ? female / count : 0,
	};
}
