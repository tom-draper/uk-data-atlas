import type { PopulationObservation } from "./dataCatalog";

type RecordLookup = (areaCode: string) => PopulationObservation | undefined;
const lookups = new WeakMap<object, RecordLookup>();
export const periodRecordLookup = (period: object): RecordLookup | undefined =>
	lookups.get(period);
export const registerPeriodRecordLookup = (
	period: object,
	lookup: RecordLookup,
): void => {
	lookups.set(period, lookup);
};
