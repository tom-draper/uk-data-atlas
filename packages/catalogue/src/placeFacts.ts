type DataRecord = Record<string, unknown>;
type Editions = Record<
	string,
	{ year?: number; data: Record<string, DataRecord> }
>;
const num = (value: unknown) =>
	typeof value === "number" && Number.isFinite(value) ? value : null;
const share = (part: number | null, total: number | null) =>
	part === null || !total ? null : (part / total) * 100;
/** The age half of residents are under, interpolated within the year of age. */
export function medianAge(ages: unknown): number | null {
	if (!ages || typeof ages !== "object") return null;
	const counts = Object.entries(ages as DataRecord)
		.map(([age, count]) => [Number(age), num(count) ?? 0] as const)
		.sort((a, b) => a[0] - b[0]);
	const total = counts.reduce((sum, [, count]) => sum + count, 0);
	if (total <= 0) return null;
	let below = 0;
	for (const [age, count] of counts) {
		if (below + count >= total / 2)
			return count === 0 ? age : age + (total / 2 - below) / count;
		below += count;
	}
	return null;
}

/** The share of residents within an age range, the last age being "90+". */
export function ageShare(ages: unknown, from: number, to = Infinity) {
	if (!ages || typeof ages !== "object") return null;
	let total = 0;
	let within = 0;
	for (const [age, count] of Object.entries(ages as DataRecord)) {
		const people = num(count) ?? 0;
		total += people;
		if (Number(age) >= from && Number(age) <= to) within += people;
	}
	return share(within, total);
}

// Ethnicity ------------------------------------------------------------------

const ETHNIC_GROUPS = {
	asian: "Asian, Asian British or Asian Welsh",
	black: "Black, Black British, Black Welsh, Caribbean or African",
	mixed: "Mixed or Multiple ethnic groups",
	white: "White",
	other: "Other ethnic group",
} as const;

const WHITE_BRITISH = "English, Welsh, Scottish, Northern Irish or British";

/** The people in each of the census's broad ethnic groups, and White British. */
export function ethnicGroups(record: DataRecord) {
	const people = (group: unknown) =>
		Object.values((group ?? {}) as DataRecord).reduce<number>(
			(sum, entry) =>
				sum + (num((entry as DataRecord | null)?.population) ?? 0),
			0,
		);
	const groups = Object.fromEntries(
		Object.entries(ETHNIC_GROUPS).map(([key, name]) => [
			key,
			people(record[name]),
		]),
	) as Record<keyof typeof ETHNIC_GROUPS, number>;
	const white = record[ETHNIC_GROUPS.white] as DataRecord | undefined;
	const whiteBritish =
		num((white?.[WHITE_BRITISH] as DataRecord | undefined)?.population) ??
		0;
	const total = Object.values(groups).reduce((sum, count) => sum + count, 0);
	return { ...groups, whiteBritish, total };
}

/** Population age and ethnicity figures compiled by the API. */
export type PlaceFacts = {
	/** Median age, the share aged 65 and over, and the estimate's year. */
	age?: [median: number, over65: number, year: number];
	/** Percentages of residents who were White, and White British, in 2021. */
	ethnicity?: [white: number, whiteBritish: number];
};

/** The datasets holding residents by single year of age, by geography. */
export const AGE_DATASETS = ["population", "population-uk"] as const;

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Every place's facts, keyed by area code, from the compiled datasets. */
export function compilePlaceFacts(
	ages: readonly Editions[],
	ethnicity: Editions,
): Record<string, PlaceFacts> {
	const facts: Record<string, PlaceFacts> = {};
	for (const editions of ages)
		for (const edition of Object.values(editions)) {
			const year = edition.year ?? 0;
			for (const [code, record] of Object.entries(edition.data)) {
				const known = facts[code]?.age;
				if (known && known[2] >= year) continue;
				const median = medianAge(record.total);
				const over65 = ageShare(record.total, 65);
				if (median === null || over65 === null) continue;
				facts[code] = {
					...facts[code],
					age: [round1(median), round1(over65), year],
				};
			}
		}
	const census = Object.values(ethnicity).at(-1);
	for (const [code, record] of Object.entries(census?.data ?? {})) {
		const groups = ethnicGroups(record);
		if (groups.total <= 0) continue;
		const share = (count: number) => round1((count / groups.total) * 100);
		facts[code] = {
			...facts[code],
			ethnicity: [share(groups.white), share(groups.whiteBritish)],
		};
	}
	return Object.fromEntries(
		Object.entries(facts).sort(([a], [b]) => a.localeCompare(b)),
	);
}
