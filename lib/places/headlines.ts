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
import { formatDisplay } from "@/lib/datasets/declared";
import type { PlaceGeography } from "@uk-data-atlas/catalogue/place-profile";
import {
	DATASET_DECLARATIONS,
	type PlaceHeadlineDeclaration,
} from "@uk-data-atlas/datasets";

/**
 * A place page's key figures: a few of the atlas's ranked maps, each with the
 * area's value and where it ranks. Read from the compiled map rankings, so a
 * page shows the same numbers as the ranking pages it links to.
 */

type HeadlineSpec = PlaceHeadlineDeclaration & { map: string };

/**
 * The headlines of each kind of place, in page order. A dataset declares its
 * own, so a place page needs no list kept here.
 */
const HEADLINES: Readonly<Record<PlaceGeography, readonly HeadlineSpec[]>> =
	(() => {
		const byPlace: Record<PlaceGeography, HeadlineSpec[]> = {
			localAuthority: [],
			ward: [],
			constituency: [],
			// No ranked map is drawn by parish or by town.
			parish: [],
			majorTownAndCity: [],
		};
		for (const declaration of DATASET_DECLARATIONS) {
			const { placeHeadline } = declaration;
			if (!placeHeadline) continue;
			for (const place of placeHeadline.places)
				byPlace[place].push({ ...placeHeadline, map: declaration.id });
		}
		for (const specs of Object.values(byPlace))
			specs.sort((a, b) => a.order - b.order);
		return byPlace;
	})();

/** The datasets a kind of place shows headlines for, in page order. */
export const headlineMapsFor = (geography: PlaceGeography) =>
	HEADLINES[geography].map((spec) => spec.map);

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
				? formatDisplay(spec.format, value)
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
