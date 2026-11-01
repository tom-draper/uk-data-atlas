import { findAtlasMap, type AtlasMap } from "@/lib/atlas/pages";
import { hasRankingFor, loadRanking } from "@/lib/atlas/rankingPages";
import {
	COUNCIL_PLACES,
	formatColumnValue,
	formatRankedValue,
	LEVEL_NOUNS,
	type MapRanking,
	type RankedArea,
} from "@/lib/atlas/rankings";
import type { PlaceGeography } from "@uk-data-atlas/catalogue/place-profile";

/**
 * A place page's key figures: a few of the atlas's ranked maps, each with the
 * area's value and where it ranks. Read from the compiled map rankings, so a
 * page shows the same numbers as the ranking pages it links to.
 */

type HeadlineSpec = {
	map: string;
	/** A short name for the measure. */
	label: string;
	/** What exactly the value counts, in a line. */
	about: string;
	/** Rank by this extra column rather than the map's own value. */
	column?: number;
	/** Where the map's own format reads oddly out of context. */
	format?: (value: number) => string;
	/** How the two ends of the ranking read, "highest" and "lowest" by default. */
	ends?: readonly [string, string];
};

const oneDecimal = (unit: string) => (value: number) =>
	`${value.toFixed(1)}${unit}`;

const deprivation = (map: string, nation: string, areas: string) => ({
	map,
	label: "Deprivation",
	about: `Share of its ${areas} in ${nation}'s most deprived 10%`,
});

const HEADLINES: Readonly<Record<PlaceGeography, readonly HeadlineSpec[]>> = {
	localAuthority: [
		{
			map: "income",
			label: "Median pay",
			about: "Annual pay of residents in full-time work",
		},
		{
			map: "housing-affordability",
			label: "Housing affordability",
			about: "Median house price as a multiple of median earnings",
			format: oneDecimal("×"),
		},
		{
			map: "life-expectancy",
			label: "Life expectancy",
			about: "At birth, the average of men and women",
			format: oneDecimal(" years"),
		},
		deprivation("imd", "England", "neighbourhoods"),
		deprivation("wimd", "Wales", "neighbourhoods"),
		deprivation("simd", "Scotland", "data zones"),
		deprivation("nimdm", "Northern Ireland", "neighbourhoods"),
		{
			map: "child-poverty",
			label: "Child poverty",
			about: "Children under 16 in relative low-income families",
		},
		{
			map: "claimant-count",
			label: "Claimant rate",
			about: "Residents aged 16 to 64 claiming out-of-work benefits",
		},
		{
			map: "council-tax",
			label: "Council tax",
			about: "Average Band D bill for the year",
		},
		{
			map: "crime",
			column: 0,
			label: "Crime",
			about: "Police-recorded crimes per 1,000 residents",
		},
		{
			map: "broadband",
			label: "Full fibre",
			about: "Premises that can get full-fibre broadband",
			format: (value) => `${Math.round(value)}%`,
		},
		{
			map: "qualification",
			label: "Degree-educated",
			about: "Residents with a degree-level qualification or above",
		},
		{
			map: "ghg-emissions",
			label: "Emissions",
			about: "Greenhouse gases per resident, in CO2e",
		},
		{
			map: "brexit",
			label: "EU referendum",
			about: "Share voting Leave",
		},
	],
	ward: [
		{
			map: "house-price",
			label: "House prices",
			about: "Median price paid for homes sold",
		},
	],
	constituency: [
		{
			map: "general-election",
			label: "General election",
			about: "The winning party",
			ends: ["largest majority", "smallest majority"],
		},
		{
			map: "brexit-constituency",
			label: "EU referendum",
			about: "Estimated share voting Leave",
		},
	],
	// No ranked map is drawn by parish or by town.
	parish: [],
	majorTownAndCity: [],
};

export type Rank = { rank: number; of: number; href?: string };

const DEFAULT_ENDS = ["highest", "lowest"] as const;

export type PlaceHeadline = {
	map: string;
	label: string;
	about: string;
	/** How the ranking's two ends read, as `rankPhrase` takes them. */
	ends: readonly [string, string];
	year: number;
	dataset: string;
	value: string;
	/** Among every area the map ranks. */
	national: Rank & { noun: string; scope: string };
	/** Among the wards of the council a ward sits in. */
	local?: Rank & { noun: string; name: string };
};

const NATIONS = [
	["E", "England", "england"],
	["W", "Wales", "wales"],
	["S", "Scotland", "scotland"],
	["N", "Northern Ireland", "northern-ireland"],
] as const;

/**
 * "England", "England and Wales", "Great Britain" or "the UK", from the
 * nations the ranked area codes belong to.
 */
export function scopeName(codes: readonly string[]) {
	const letters = new Set(codes.map((code) => code[0]));
	const names = NATIONS.filter(([letter]) => letters.has(letter)).map(
		([, name]) => name,
	);
	if (names.length === 4) return "the UK";
	if (names.length === 3 && !letters.has("N")) return "Great Britain";
	if (names.length <= 1) return names[0] ?? "the UK";
	return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

const ordinal = (n: number) => {
	const tens = n % 100;
	const suffix =
		tens >= 11 && tens <= 13
			? "th"
			: (({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[
					n % 10
				] ?? "th");
	return `${n.toLocaleString("en-GB")}${suffix}`;
};

/** "Highest", "12th highest" or "3rd lowest", counting from the nearer end. */
export function rankPhrase(
	rank: number,
	of: number,
	[high, low]: readonly [string, string] = ["highest", "lowest"],
) {
	const capital = (text: string) => text[0]!.toUpperCase() + text.slice(1);
	if (rank === 1) return capital(high);
	if (rank === of) return capital(low);
	return rank <= (of + 1) / 2
		? `${ordinal(rank)} ${high}`
		: `${ordinal(of - rank + 1)} ${low}`;
}

/** One-based rank, highest first; tied areas share the better rank. */
export function rankOf(values: readonly number[], value: number) {
	return 1 + values.filter((other) => other > value).length;
}

const rankings = new Map<string, Promise<MapRanking | null>>();
function rankingFor(slug: string) {
	let ranking = rankings.get(slug);
	if (!ranking) {
		// A map has a ranking file only when some place has a page for it.
		ranking = loadRanking(slug).catch(() => null);
		rankings.set(slug, ranking);
	}
	return ranking;
}

const numeric = (value: unknown): value is number =>
	typeof value === "number" && Number.isFinite(value);

/** The ranking page for the whole ranked scope, else the area's nation. */
function nationalHref(map: AtlasMap, code: string, scope: string) {
	const nation = NATIONS.find(([letter]) => letter === code[0]);
	const candidates = [
		...(scope === "the UK" ? ["united-kingdom"] : []),
		...(nation ? [nation[2]] : []),
	];
	const slug = candidates.find((candidate) =>
		hasRankingFor(candidate, map.slug),
	);
	return slug ? `/maps/${slug}/${map.slug}` : undefined;
}

/** An election's winner, majority and turnout, from the ranking's columns. */
function electionDetail(ranking: MapRanking, area: RankedArea) {
	const column = (label: string) => {
		const index =
			ranking.columns?.findIndex((c) => c.label === label) ?? -1;
		return index < 0
			? undefined
			: { index, column: ranking.columns![index]! };
	};
	const winner = column("Winner");
	const majority = column("Majority");
	const turnout = column("Turnout");
	const cell = (found: ReturnType<typeof column>) =>
		found ? area.extra?.[found.index] : undefined;
	const parts = [
		numeric(cell(majority))
			? `Majority of ${formatColumnValue(majority!.column, cell(majority))} (${area.value.toFixed(1)}%)`
			: undefined,
		numeric(cell(turnout))
			? `turnout ${formatColumnValue(turnout!.column, cell(turnout))}`
			: undefined,
	].filter(Boolean);
	return {
		value:
			typeof cell(winner) === "string" ? String(cell(winner)) : undefined,
		detail: parts.length > 0 ? parts.join(", ") : undefined,
	};
}

async function headline(
	spec: HeadlineSpec,
	code: string,
): Promise<PlaceHeadline | null> {
	const map = findAtlasMap(spec.map);
	const ranking = map ? await rankingFor(spec.map) : null;
	if (!map || !ranking) return null;
	const valueOf = (area: RankedArea) => {
		const value =
			spec.column === undefined ? area.value : area.extra?.[spec.column];
		return numeric(value) ? value : null;
	};
	const area = ranking.areas.find((candidate) => candidate.code === code);
	const value = area ? valueOf(area) : null;
	if (!area || value === null) return null;

	const ranked = (areas: RankedArea[]) =>
		areas.map(valueOf).filter((v): v is number => v !== null);
	const rankedAreas = ranking.areas.filter(
		(other) => valueOf(other) !== null,
	);
	const all = ranked(rankedAreas);
	const scope = scopeName(rankedAreas.map((other) => other.code));
	const noun = LEVEL_NOUNS[ranking.level];
	const column =
		spec.column === undefined ? undefined : ranking.columns?.[spec.column];
	const election =
		spec.map === "general-election"
			? electionDetail(ranking, area)
			: undefined;

	const result: PlaceHeadline = {
		map: map.slug,
		label: spec.label,
		about: election?.detail ?? spec.about,
		ends: spec.ends ?? DEFAULT_ENDS,
		year: map.periods[0]!,
		dataset: map.dataset,
		value:
			election?.value ??
			(spec.format
				? spec.format(value)
				: column
					? formatColumnValue(column, value)
					: formatRankedValue(map, value)),
		national: {
			rank: rankOf(all, value),
			of: all.length,
			noun: noun.many,
			scope,
			href: nationalHref(map, code, scope),
		},
	};

	if (ranking.level === "ward") {
		const local = ranked(
			ranking.areas.filter((other) => other.district === area.district),
		);
		const council = COUNCIL_PLACES.get(area.district);
		if (council && local.length > 1)
			result.local = {
				rank: rankOf(local, value),
				of: local.length,
				noun: noun.many,
				name: council.name,
				href: hasRankingFor(council.slug, map.slug)
					? `/maps/${council.slug}/${map.slug}`
					: undefined,
			};
	}
	return result;
}

/** The area's key figures, in the order the page lists them. */
export async function placeHeadlines(
	code: string,
	geography: PlaceGeography,
): Promise<PlaceHeadline[]> {
	const found = await Promise.all(
		HEADLINES[geography].map((spec) => headline(spec, code)),
	);
	return found.filter((item): item is PlaceHeadline => item !== null);
}
