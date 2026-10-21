import {
	medianAge,
	ageShare,
	ethnicGroups,
} from "@uk-data-atlas/catalogue/place-facts";
export {
	medianAge,
	ageShare,
	ethnicGroups,
} from "@uk-data-atlas/catalogue/place-facts";
import { gazetteer } from "@/lib/data/gazetteer/static";

/**
 * How a ranking page reads a map's data, where the map's own colouring is not
 * enough: a value of its own, areas rolled up into councils, or columns that
 * add context such as a change over time or a rate per resident. Compiled by
 * `pnpm seo:build`; a page renders only the stored numbers.
 */

export type RankingLevel =
	"localAuthority" | "ward" | "constituency" | "itl3" | "icb";

export type DataRecord = Record<string, unknown>;

export type Edition = {
	id?: string;
	year?: number;
	data: Record<string, DataRecord>;
};

export type Editions = Record<string, Edition>;

/** A dated edition, as the context hands them out. */
export type DatedEdition = Edition & { year: number };

export type RankingRow = {
	code: string;
	name: string;
	/**
	 * The local authority a ward or constituency sits in, or most of it does;
	 * the authority itself otherwise.
	 */
	district: string;
	value: number;
	record: DataRecord;
	/** The councils an area covers, for areas made of several. */
	within?: string[];
};

export type RankingContext = {
	year: number;
	edition: DatedEdition;
	/** The newest edition before this one, when the file holds one. */
	previous?: DatedEdition;
	/** The oldest edition the file holds, when it is not this one. */
	first?: DatedEdition;
	/** Other compiled datasets the recipe reads, by name. */
	inputs: Readonly<Record<string, unknown>>;
	/** A code's ranked value in another edition, worked out as for this one. */
	valueIn(edition: Edition, code: string): number | null;
};

/** How a column's numbers read. The page holds the functions; the file the name. */
export type ColumnFormat =
	| "percent"
	| "signedPercent"
	| "signedPoints"
	| "count"
	| "years"
	| "micrograms"
	| "squareKm"
	/** A name, such as the winning party. */
	| "text";

export type RankingColumn = {
	/** Null when the data cannot fill the column, which then is left off. */
	label: string | ((context: RankingContext) => string | null);
	value: (row: RankingRow, context: RankingContext) => number | string | null;
	format: ColumnFormat;
};

export type RankingRecipe = {
	/** Defaults to the map's own boundary type. */
	level?: RankingLevel;
	/** Compiled datasets read alongside the map's own, by file name. */
	inputs?: readonly string[];
	/** The ranked value, where it is not the map's colour. */
	value?: (
		record: DataRecord,
		code: string,
		edition: Edition,
	) => number | null;
	/** Areas built some other way, such as neighbourhoods rolled up. */
	rows?: (context: RankingContext) => RankingRow[];
	columns?: readonly RankingColumn[];
};

const num = (value: unknown) =>
	typeof value === "number" && Number.isFinite(value) ? value : null;

const share = (part: number | null, total: number | null) =>
	part === null || !total ? null : (part / total) * 100;

const sumValues = (values: unknown) =>
	values && typeof values === "object"
		? Object.values(values).reduce<number>(
				(sum, value) => sum + (num(value) ?? 0),
				0,
			)
		: 0;

const field =
	(...path: string[]) =>
	(record: DataRecord) => {
		let value: unknown = record;
		for (const key of path)
			value =
				value && typeof value === "object"
					? (value as DataRecord)[key]
					: undefined;
		return num(value);
	};

/** "Bristol, City of" reads as "Bristol", as the council's place does. */
export const councilName = (name: string) =>
	name.replace(/, (City|County) of$/, "");

// Columns ------------------------------------------------------------------

/** The change in the ranked value since an earlier edition of the file. */
const changeSince = (
	kind: "percent" | "points",
	from: "previous" | "first" = "previous",
): RankingColumn => ({
	label: (context) => {
		const base = from === "previous" ? context.previous : context.first;
		return base ? `Change since ${base.year}` : null;
	},
	value: (row, context) => {
		const base = from === "previous" ? context.previous : context.first;
		const before = base ? context.valueIn(base, row.code) : null;
		return change(kind, row.value, before);
	},
	format: kind === "points" ? "signedPoints" : "signedPercent",
});

/** The change since the year before, read from a series inside each record. */
const changeOnYearBefore = (
	kind: "percent" | "points",
	read: (record: DataRecord, year: number) => number | null,
): RankingColumn => ({
	label: (context) => `Change since ${context.year - 1}`,
	value: (row, context) =>
		change(
			kind,
			read(row.record, context.year),
			read(row.record, context.year - 1),
		),
	format: kind === "points" ? "signedPoints" : "signedPercent",
});

function change(
	kind: "percent" | "points",
	now: number | null,
	before: number | null,
) {
	if (now === null || before === null) return null;
	if (kind === "points") return now - before;
	return before === 0 ? null : ((now - before) / before) * 100;
}

const column = (
	label: string,
	format: ColumnFormat,
	value: (record: DataRecord, row: RankingRow) => number | string | null,
): RankingColumn => ({ label, format, value: (row) => value(row.record, row) });

const per100k = column("Per 100,000 residents", "count", (record) =>
	field("metrics", "per100kPopulation")(record),
);

/** Residents of each council in the newest population year up to `year`. */
function residents(context: RankingContext, code: string) {
	const editions = context.inputs["population-uk"] as Editions;
	let best: { year: number; total: number } | null = null;
	for (const edition of Object.values(editions)) {
		const year = edition.year ?? 0;
		if (year > context.year || (best && year <= best.year)) continue;
		const record = edition.data[code];
		if (record) best = { year, total: sumValues(record.total) };
	}
	return best?.total || null;
}

const perThousandResidents: RankingColumn = {
	label: "Per 1,000 residents",
	format: "count",
	value: (row, context) => {
		const people = residents(context, row.district);
		return people ? (row.value / people) * 1000 : null;
	},
};

const breakdownShare = (label: string, ...keys: string[]) =>
	column(label, "percent", (record) => {
		const breakdown = record.breakdown as DataRecord | undefined;
		if (!breakdown) return null;
		return share(
			keys.reduce((sum, key) => sum + (num(breakdown[key]) ?? 0), 0),
			num(breakdown.total),
		);
	});

// Councils from older boundaries ------------------------------------------

let councilsNow: Set<string> | undefined;

/**
 * The current council a council now lies in: itself, or for a former council,
 * its successor, so a ranking on older codes still files each area under a
 * place's current members. Every English merger
 * since 2009 joined whole councils, and Scotland's 2018 recodes kept their
 * boundaries, so the successor is the smallest current council whose extent
 * holds the old one's.
 */
export function successorCouncil(code: string): string | null {
	councilsNow ??= new Set(gazetteer.currentCouncilCodes());
	if (councilsNow.has(code)) return code;
	const old = gazetteer.get(code)?.bbox;
	if (!old) return null;
	const slack = 0.01;
	let best: { code: string; size: number } | null = null;
	for (const candidate of councilsNow) {
		if (candidate[0] !== code[0]) continue;
		const box = gazetteer.get(candidate)?.bbox;
		if (
			!box ||
			box[0] > old[0] + slack ||
			box[1] > old[1] + slack ||
			box[2] < old[2] - slack ||
			box[3] < old[3] - slack
		)
			continue;
		const size = (box[2] - box[0]) * (box[3] - box[1]);
		if (!best || size < best.size) best = { code: candidate, size };
	}
	return best?.code ?? null;
}

// Rolled-up neighbourhoods -------------------------------------------------

/**
 * Neighbourhoods rolled up into councils: the share of each council's
 * neighbourhoods in the most deprived tenth, nationally. It is the summary
 * the publishers give for councils themselves.
 */
const deprivationRecipe = (
	councilKey: string,
	decileOf: (record: DataRecord, count: number) => number | null,
	nameKey?: string,
): RankingRecipe => ({
	level: "localAuthority",
	rows: (context) => {
		const records = Object.values(context.edition.data);
		const councils = new Map<
			string,
			{ name: string; total: number; first: number; second: number }
		>();
		for (const record of records) {
			const code =
				String(record[councilKey] ?? "") ||
				(nameKey ? councilNamed(String(record[nameKey] ?? "")) : "");
			const decile = decileOf(record, records.length);
			if (!code || decile === null) continue;
			const council = councils.get(code) ?? {
				name: councilName(gazetteer.get(code)?.name ?? code),
				total: 0,
				first: 0,
				second: 0,
			};
			council.total += 1;
			if (decile <= 1) council.first += 1;
			if (decile <= 2) council.second += 1;
			councils.set(code, council);
		}
		return [...councils].map(([code, council]) => ({
			code,
			name: council.name,
			district: successorCouncil(code) ?? code,
			value: (council.first / council.total) * 100,
			record: { ...council },
		}));
	},
	columns: [
		column("In the most deprived 20%", "percent", (record) =>
			share(num(record.second), num(record.total)),
		),
		column("Neighbourhoods", "count", (record) => num(record.total)),
	],
});

/** Council names a source spells differently from the ONS. */
const COUNCIL_ALIASES: Readonly<Record<string, string>> = {
	// The Scottish Government's name for the Western Isles, used by SIMD.
	"Na h-Eileanan an Iar": "Na h-Eileanan Siar",
};

/** A current council's code from its name, for rows that leave the code out. */
function councilNamed(name: string) {
	const matches = gazetteer
		.resolveName(COUNCIL_ALIASES[name] ?? name, "localAuthority")
		.filter((entry) => successorCouncil(entry.code) === entry.code);
	return matches.length === 1 ? matches[0]!.code : "";
}

const decileField = (key: string) => (record: DataRecord) => num(record[key]);

// Population -----------------------------------------------------------------

const ethnicShare = (
	label: string,
	count: (groups: ReturnType<typeof ethnicGroups>) => number,
) =>
	column(label, "percent", (record) => {
		const groups = ethnicGroups(record);
		return share(count(groups), groups.total);
	});

// Areas other than councils -----------------------------------------------

type Overlaps = {
	releases: Record<
		string,
		Record<string, { code: string; weight: number }[]>
	>;
};

/**
 * The council holding most of a constituency, from the newest boundary
 * release that has the code: a constituency is listed under that council's
 * places.
 */
function constituencyCouncil(context: RankingContext, code: string) {
	const { releases } = context.inputs[
		"constituency-lad-overlaps"
	] as Overlaps;
	for (const release of Object.keys(releases).sort().reverse()) {
		const overlaps = releases[release]![code];
		if (!overlaps?.length) continue;
		const main = overlaps.reduce((best, overlap) =>
			overlap.weight > best.weight ? overlap : best,
		);
		return successorCouncil(main.code) ?? main.code;
	}
	return null;
}

const constituencyRecipe = (
	value: (record: DataRecord) => number | null,
	columns: readonly RankingColumn[] = [],
): RankingRecipe => ({
	level: "constituency",
	inputs: ["constituency-lad-overlaps"],
	rows: (context) =>
		Object.entries(context.edition.data).flatMap(([code, record]) => {
			const ranked = value(record);
			const district = constituencyCouncil(context, code);
			if (ranked === null || !district) return [];
			return [
				{
					code,
					name: String(record.constituencyName ?? code),
					district,
					value: ranked,
					record,
				},
			];
		}),
	columns,
});

/** The parties as the election results abbreviate them. */
const PARTY_NAMES: Readonly<Record<string, string>> = {
	Lab: "Labour",
	Con: "Conservative",
	LD: "Liberal Democrat",
	SNP: "SNP",
	Green: "Green",
	RUK: "Reform UK",
	PC: "Plaid Cymru",
	SF: "Sinn Féin",
	DUP: "DUP",
	SDLP: "SDLP",
	APNI: "Alliance",
	UUP: "UUP",
	TUV: "TUV",
	Ind: "Independent",
	Spk: "Speaker",
};

/**
 * ITL1 regions are England's regions and the other three nations, so an ITL3
 * region, named for its ITL1 region by its code's third letter, covers that
 * region's councils.
 */
const ITL1_REGIONS: Readonly<Record<string, string>> = {
	C: "E12000001",
	D: "E12000002",
	E: "E12000003",
	F: "E12000004",
	G: "E12000005",
	H: "E12000006",
	I: "E12000007",
	J: "E12000008",
	K: "E12000009",
};
const ITL1_NATIONS: Readonly<Record<string, string>> = {
	L: "W",
	M: "S",
	N: "N",
};

function itlCouncils(code: string): string[] {
	const letter = code[2] ?? "";
	const region = ITL1_REGIONS[letter];
	const nation = ITL1_NATIONS[letter];
	return gazetteer
		.currentCouncilCodes()
		.filter((council) =>
			region
				? (gazetteer.get(council)?.parents ?? []).includes(region)
				: nation !== undefined && council.startsWith(nation),
		)
		.sort();
}

/** "NHS LANCASHIRE AND SOUTH CUMBRIA INTEGRATED CARE BOARD" reads "Lancashire and South Cumbria". */
export function boardName(name: string) {
	return name
		.replace(/^NHS\s+/i, "")
		.replace(/\s+INTEGRATED CARE BOARD$/i, "")
		.toLowerCase()
		.replace(
			/(^|[\s-])([a-z])/g,
			(_match, gap: string, letter: string) => gap + letter.toUpperCase(),
		)
		.replace(/\b(And|Of|The|Upon|On)\b/g, (word) => word.toLowerCase());
}

// Recipes ------------------------------------------------------------------

export const RANKING_RECIPES: Readonly<Record<string, RankingRecipe>> = {
	"air-quality": {
		columns: [column("PM2.5", "micrograms", field("pm25Mean"))],
	},
	brexit: {
		value: field("pctLeave"),
		columns: [column("Turnout", "percent", field("pctTurnout"))],
	},
	"brexit-constituency": constituencyRecipe(field("pctLeave")),
	broadband: {
		columns: [
			column("Superfast", "percent", field("pctSuperfast")),
			column("Gigabit", "percent", field("pctGigabit")),
		],
	},
	"business-activity": { columns: [per100k] },
	"car-availability": {
		columns: [
			breakdownShare("Two or more cars", "twoCars", "threeOrMoreCars"),
		],
	},
	"child-poverty": {
		columns: [
			changeSince("points"),
			column("Children", "count", field("childCount")),
		],
	},
	"claimant-count": {
		columns: [column("Claimants", "count", field("totalCount"))],
	},
	crime: {
		inputs: ["population-uk"],
		columns: [perThousandResidents],
	},
	"electric-vehicle-chargers": { columns: [per100k] },
	"electricity-consumption": { columns: [changeSince("percent")] },
	ethnicity: {
		value: (record) => {
			const groups = ethnicGroups(record);
			return share(groups.whiteBritish, groups.total);
		},
		columns: [
			ethnicShare("Asian", (groups) => groups.asian),
			ethnicShare("Black", (groups) => groups.black),
			ethnicShare("Mixed", (groups) => groups.mixed),
			ethnicShare(
				"Other White",
				(groups) => groups.white - groups.whiteBritish,
			),
			ethnicShare("Other", (groups) => groups.other),
		],
	},
	"fuel-poverty": {
		level: "localAuthority",
		inputs: ["imd"],
		rows: (context) => {
			const imd = Object.values(context.inputs.imd as Editions)[0]!;
			const councils = new Map<
				string,
				{ households: number; fuelPoor: number }
			>();
			for (const [lsoa, record] of Object.entries(context.edition.data)) {
				const code = imd.data[lsoa]?.ladCode;
				const households = num(record.householdCount);
				const fuelPoor = num(record.fuelPoorHouseholdCount);
				if (
					typeof code !== "string" ||
					!households ||
					fuelPoor === null
				)
					continue;
				const council = councils.get(code) ?? {
					households: 0,
					fuelPoor: 0,
				};
				council.households += households;
				council.fuelPoor += fuelPoor;
				councils.set(code, council);
			}
			return [...councils].map(([code, council]) => ({
				code,
				name: councilName(gazetteer.get(code)?.name ?? code),
				district: successorCouncil(code) ?? code,
				value: (council.fuelPoor / council.households) * 100,
				record: council,
			}));
		},
		columns: [column("Fuel-poor households", "count", field("fuelPoor"))],
	},
	"gas-consumption": { columns: [changeSince("percent")] },
	"general-election": constituencyRecipe(
		(record) => share(num(record.majority), num(record.validVotes)),
		[
			column("Winner", "text", (record) => {
				const party = String(record.firstParty ?? "");
				return party ? (PARTY_NAMES[party] ?? party) : null;
			}),
			column("Majority", "count", field("majority")),
			column("Turnout", "percent", field("turnoutPercent")),
		],
	),
	"ghg-emissions": {
		columns: [changeSince("percent"), changeSince("percent", "first")],
	},
	"healthy-life-expectancy": {
		columns: [
			column("Male", "years", field("maleBirthLE")),
			column("Female", "years", field("femaleBirthLE")),
		],
	},
	homelessness: {
		columns: [
			column(
				"Households",
				"count",
				field("householdsInTemporaryAccommodation"),
			),
			column(
				"Children",
				"count",
				field("childrenInTemporaryAccommodation"),
			),
		],
	},
	"house-price": {
		columns: [
			changeOnYearBefore("percent", (record, year) =>
				field("prices", String(year))(record),
			),
		],
	},
	imd: deprivationRecipe("ladCode", decileField("imdDecile")),
	income: {
		columns: [
			{
				label: (context) => `Change since ${context.year - 1}`,
				format: "signedPercent",
				value: (row) =>
					field("annual", "medianPercentageChange")(row.record),
			},
		],
	},
	jobs: {
		columns: [
			column("Per 100 residents", "count", (record) => {
				const per100kPeople = field(
					"metrics",
					"per100kPopulation",
				)(record);
				return per100kPeople === null ? null : per100kPeople / 1000;
			}),
			changeSince("percent"),
		],
	},
	"life-expectancy": {
		columns: [
			column("Male", "years", field("maleBirthLE")),
			column("Female", "years", field("femaleBirthLE")),
		],
	},
	"nhs-waiting": {
		level: "icb",
		rows: (context) => {
			const ladToIcb = (context.edition as DataRecord).ladToIcb as Record<
				string,
				string
			>;
			const councils = new Map<string, string[]>();
			for (const [council, board] of Object.entries(ladToIcb ?? {})) {
				const list = councils.get(board) ?? [];
				list.push(successorCouncil(council) ?? council);
				councils.set(board, list);
			}
			return Object.entries(context.edition.data).flatMap(
				([code, record]) => {
					const value = num(record.pctOver18Weeks);
					const within = [
						...new Set(councils.get(code) ?? []),
					].sort();
					if (value === null || within.length === 0) return [];
					return [
						{
							code,
							name: boardName(String(record.icbName ?? code)),
							district: within[0]!,
							within,
							value,
							record,
						},
					];
				},
			);
		},
		columns: [
			column("Waiting", "count", field("total")),
			column("Over 18 weeks", "count", field("over18Weeks")),
		],
	},
	"mobile-coverage": {
		columns: [
			column(
				"4G indoors, all operators",
				"percent",
				field("pct4GIndoorAll"),
			),
		],
	},
	"net-additional-dwellings": {
		inputs: ["population-uk"],
		columns: [perThousandResidents],
	},
	nimdm: deprivationRecipe("lgdCode", (record, count) => {
		const rank = num(record.nimdmRank);
		return rank === null ? null : Math.ceil((rank / count) * 10);
	}),
	"population-age": {
		level: "ward",
		value: (record) => medianAge(record.total),
		columns: [
			column("Under 18", "percent", (record) =>
				ageShare(record.total, 0, 17),
			),
			column("65 and over", "percent", (record) =>
				ageShare(record.total, 65),
			),
		],
	},
	"population-density": {
		level: "ward",
		inputs: ["ward-areas"],
		rows: (context) => {
			const areas = context.inputs["ward-areas"] as Record<
				string,
				number
			>;
			return Object.entries(context.edition.data).flatMap(
				([code, record]) => {
					const area = areas[code];
					const people = sumValues(record.total);
					if (!area || !people || typeof record.wardName !== "string")
						return [];
					return [
						{
							code,
							name: record.wardName,
							district: String(record.ladCode ?? ""),
							value: people / area,
							record: { people, area },
						},
					];
				},
			);
		},
		columns: [
			column("Residents", "count", field("people")),
			column("Area", "squareKm", field("area")),
		],
	},
	qualification: {
		columns: [breakdownShare("No qualifications", "noQualifications")],
	},
	"regional-gdp-itl3": {
		level: "itl3",
		rows: (context) =>
			Object.entries(context.edition.data).flatMap(([code, record]) => {
				const value = num(record.gdpMillionGbp);
				const within = itlCouncils(code);
				if (value === null || within.length === 0) return [];
				return [
					{
						code,
						name: String(record.itlName ?? code),
						district: within[0]!,
						within,
						value,
						record,
					},
				];
			}),
		columns: [
			{
				label: (context) =>
					context.previous
						? `Change since ${context.previous.year}`
						: null,
				format: "signedPercent",
				value: (row, context) =>
					change(
						"percent",
						row.value,
						num(context.previous?.data[row.code]?.gdpMillionGbp),
					),
			},
		],
	},

	"school-performance": {
		columns: [
			changeOnYearBefore("points", (record, year) =>
				field("series", String(year), "ptL2basics94")(record),
			),
			column("Grade 5 or above", "percent", field("ptL2basics95")),
		],
	},
	"school-performance-gap": {
		columns: [
			changeOnYearBefore("points", (record, year) =>
				field("series", String(year), "att8Gap")(record),
			),
		],
	},
	simd: deprivationRecipe(
		"councilAreaCode",
		decileField("simdDecile"),
		"councilAreaName",
	),
	"travel-to-work": {
		columns: [
			breakdownShare("Work from home", "workFromHome"),
			breakdownShare("Public transport", "publicTransport"),
			breakdownShare("Walk or cycle", "onFoot", "bicycle"),
		],
	},
	unemployment: {
		columns: [
			changeOnYearBefore("points", (record, year) =>
				field("rates", String(year))(record),
			),
		],
	},
	waste: {
		columns: [
			column("Recycled", "percent", (record) =>
				share(
					field("metrics", "recycledTonnes")(record),
					num(record.value),
				),
			),
		],
	},
	wimd: deprivationRecipe("ladCode", decileField("wimdDecile")),
};
