/**
 * Population by single year of age is written to disk as an array indexed by
 * age, rather than as an object keyed "0", "1", "2"..., which spells out every
 * age for every area three times over. The browser and the code that reads a
 * compiled file see the object again, so nothing downstream of loading has to
 * know the file is compact.
 */

/** Dataset types whose records hold age maps. */
const AGE_DATASET_TYPES: ReadonlySet<unknown> = new Set([
	"population",
	"populationUk",
]);

/** The fields of a record that map an age to a count. */
const AGE_FIELDS = ["total", "males", "females"] as const;

type JsonObject = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonObject =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isAgeDataset = (
	period: unknown,
): period is JsonObject & { data: JsonObject } =>
	isRecord(period) &&
	AGE_DATASET_TYPES.has(period.type) &&
	isRecord(period.data);

/** Whether `ages` has exactly the keys "0" to "n-1", so an array can hold it. */
const isDense = (ages: JsonObject) => {
	const keys = Object.keys(ages);
	return keys.every((key, index) => key === String(index));
};

const mapRecords = (
	payload: unknown,
	convert: (value: unknown) => unknown,
): unknown => {
	if (!isRecord(payload)) return payload;
	return Object.fromEntries(
		Object.entries(payload).map(([id, period]) => {
			if (!isAgeDataset(period)) return [id, period];
			const data = Object.fromEntries(
				Object.entries(period.data).map(([code, area]) => {
					if (!isRecord(area)) return [code, area];
					const converted = { ...area };
					for (const field of AGE_FIELDS)
						converted[field] = convert(area[field]);
					return [code, converted];
				}),
			);
			return [id, { ...period, data }];
		}),
	);
};

const toArray = (ages: unknown) =>
	isRecord(ages) && isDense(ages) ? Object.values(ages) : ages;

const toObject = (ages: unknown) =>
	Array.isArray(ages)
		? Object.fromEntries(ages.map((count, age) => [age, count]))
		: ages;

/**
 * The payload with each age map of a population dataset as an array. A map
 * with a gap in its ages stays an object, so nothing is ever renumbered.
 */
export const encodeAgeArrays = (payload: unknown) =>
	mapRecords(payload, toArray);

/** The payload with every age array expanded back to an object keyed by age. */
export const decodeAgeArrays = (payload: unknown) =>
	mapRecords(payload, toObject);
