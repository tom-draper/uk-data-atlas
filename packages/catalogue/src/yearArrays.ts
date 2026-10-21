/**
 * House prices are written to disk as an array indexed by year, rather than as
 * an object keyed "1995", "1996", ..., which spells out every year for every
 * ward twice over. The edition records the first year once, a year without a
 * price is a null, and trailing nulls are dropped. The browser and the code
 * that reads a compiled file see the objects again, so nothing downstream of
 * loading has to know the file is compact.
 */

/** Dataset types whose records hold year maps. */
const YEAR_DATASET_TYPES: ReadonlySet<unknown> = new Set(["housePrice"]);

/** The fields of a record that map a year to a price. */
const YEAR_FIELDS = ["prices", "meanPrices"] as const;

/** Set on an edition whose year maps are arrays, naming the year at index 0. */
export const YEARS_FROM_KEY = "priceYearsFrom";

/** Years further apart than this are not a series, and stay as objects. */
const MAX_SPAN = 200;

type JsonObject = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonObject =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isYearDataset = (
	edition: unknown,
): edition is JsonObject & { data: JsonObject } =>
	isRecord(edition) &&
	YEAR_DATASET_TYPES.has(edition.type) &&
	isRecord(edition.data);

const isYearKey = (key: string) => /^\d{4}$/.test(key);

/**
 * The first year of every map in an edition, if each can be held as an array
 * without changing: keys that are plain years, values that are numbers (a null
 * stands for a missing year, so it cannot also be a value), and a span short
 * enough to be a series. Otherwise undefined, and the edition stays as it is.
 */
const firstYear = (data: JsonObject): number | undefined => {
	let first = Infinity;
	let last = -Infinity;
	for (const area of Object.values(data)) {
		if (!isRecord(area)) continue;
		for (const field of YEAR_FIELDS) {
			const years = area[field];
			if (years === undefined) continue;
			if (!isRecord(years)) return undefined;
			for (const [key, value] of Object.entries(years)) {
				if (!isYearKey(key) || typeof value !== "number")
					return undefined;
				first = Math.min(first, Number(key));
				last = Math.max(last, Number(key));
			}
		}
	}
	return first !== Infinity && last - first < MAX_SPAN ? first : undefined;
};

const toArray = (years: unknown, from: number) => {
	if (!isRecord(years)) return years;
	const values: (number | null)[] = [];
	for (const [key, value] of Object.entries(years))
		values[Number(key) - from] = value as number;
	// An index left unset is a hole, which JSON writes as null.
	return Array.from(values, (value) => value ?? null);
};

const toObject = (years: unknown, from: number) =>
	Array.isArray(years)
		? Object.fromEntries(
				years.flatMap((value, index) =>
					value === null ? [] : [[from + index, value]],
				),
			)
		: years;

const mapEditions = (
	payload: unknown,
	convert: (edition: JsonObject & { data: JsonObject }) => JsonObject,
): unknown =>
	isRecord(payload)
		? Object.fromEntries(
				Object.entries(payload).map(([id, edition]) => [
					id,
					isYearDataset(edition) ? convert(edition) : edition,
				]),
			)
		: payload;

/** The edition with `convert` applied to each year map of each area. */
const mapYears = (
	edition: JsonObject & { data: JsonObject },
	convert: (years: unknown) => unknown,
): JsonObject & { data: JsonObject } => ({
	...edition,
	data: Object.fromEntries(
		Object.entries(edition.data).map(([code, area]) => {
			if (!isRecord(area)) return [code, area];
			const converted = { ...area };
			for (const field of YEAR_FIELDS)
				if (field in area) converted[field] = convert(area[field]);
			return [code, converted];
		}),
	),
});

/**
 * The payload with each year map of a house price edition as an array. An
 * edition with a map that an array could not hold exactly stays as it is.
 */
export const encodeYearArrays = (payload: unknown) =>
	mapEditions(payload, (edition) => {
		if (YEARS_FROM_KEY in edition) return edition;
		const first = firstYear(edition.data);
		if (first === undefined) return edition;
		return {
			...mapYears(edition, (years) => toArray(years, first)),
			[YEARS_FROM_KEY]: first,
		};
	});

/** The payload with every year array expanded back to an object keyed by year. */
export const decodeYearArrays = (payload: unknown) =>
	mapEditions(payload, (edition) => {
		const first = edition[YEARS_FROM_KEY];
		if (typeof first !== "number") return edition;
		const { [YEARS_FROM_KEY]: _first, ...decoded } = mapYears(
			edition,
			(years) => toObject(years, first),
		);
		return decoded;
	});
