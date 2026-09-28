import type { AreaLookup, AreaRecord } from "./areaInventory";
import {
	explainCodeInRelease,
	type MemberCodeStatus,
} from "./memberReconciliation";
import { normalisePlaceName, withoutTitle } from "./nameNormalisation";
import { areaKey, releaseKey } from "./geographyKeys";

/**
 * Checking a column of codes or names against one exact boundary release,
 * before a caller joins their data to it.
 *
 * Nothing is guessed. A code is valid or says why not; a name matches only
 * exactly, through an alias, or with an administrative title set aside, and
 * a name meaning several areas is returned with all of them. Whatever was
 * trimmed or re-cased to read a value is reported, so a cleaned join can be
 * told from a clean one.
 */

export const MAX_BATCH_VALUES = 500;

type AreaRef = { id: string; code: string; name: string };

export type ValidatedValue = {
	index: number;
	value: string;
	/** What was done to the value before it was read. */
	normalised?: Array<"trimmed" | "uppercased">;
	/** The position of the first identical value, when this repeats one. */
	duplicateOf?: number;
} & (
	| { kind: "empty"; status: "empty" }
	| { kind: "code"; status: "malformed-code"; detail: string }
	| { kind: "code"; status: "valid"; area: AreaRef }
	| {
			kind: "code";
			status: Exclude<MemberCodeStatus, "unknown">;
			presentIn: Array<{ boundaryRelease: string; name: string }>;
	  }
	| {
			kind: "code";
			status: "other-geography";
			heldBy: Array<{ geography: string; boundaryReleases: string[] }>;
	  }
	| { kind: "code"; status: "unknown" }
	| {
			kind: "name";
			status: "matched";
			match: "exact" | "alias" | "exact-without-title";
			area: AreaRef;
	  }
	| {
			kind: "name";
			status: "ambiguous";
			candidates: Array<
				AreaRef & { match: "exact" | "alias" | "exact-without-title" }
			>;
	  }
	| {
			kind: "name";
			status: "unmatched";
			/** Other releases of the geography where the name does match. */
			matchesIn: string[];
	  }
);

type NameEntry = {
	area: AreaRecord;
	match: "exact" | "alias" | "exact-without-title";
};

const MATCH_RANK = { exact: 0, alias: 1, "exact-without-title": 2 } as const;

const nameIndexes = new WeakMap<
	Map<string, AreaRecord>,
	Map<string, NameEntry[]>
>();

/** Every name and alias in one release, normalised, to the areas carrying it. */
const nameIndexFor = (areas: Map<string, AreaRecord>) => {
	const cached = nameIndexes.get(areas);
	if (cached) return cached;
	const index = new Map<string, NameEntry[]>();
	const add = (key: string, entry: NameEntry) => {
		const list = index.get(key) ?? [];
		const existing = list.find(
			(candidate) => candidate.area.code === entry.area.code,
		);
		if (!existing) list.push(entry);
		else if (MATCH_RANK[entry.match] < MATCH_RANK[existing.match])
			existing.match = entry.match;
		index.set(key, list);
	};
	for (const area of areas.values()) {
		for (const [label, match] of [
			[area.name, "exact"],
			...(area.aliases ?? []).map((alias) => [alias, "alias"]),
		] as Array<[string, "exact" | "alias"]>) {
			const normalised = normalisePlaceName(label);
			if (!normalised) continue;
			add(normalised, { area, match });
			const stripped = withoutTitle(normalised);
			if (stripped) add(stripped, { area, match: "exact-without-title" });
		}
	}
	nameIndexes.set(areas, index);
	return index;
};

const codeIndexes = new WeakMap<
	AreaLookup,
	Map<string, Map<string, string[]>>
>();

/** Every code to the geographies, and their releases, that hold it. */
const codeIndexFor = (areaLookup: AreaLookup) => {
	const cached = codeIndexes.get(areaLookup);
	if (cached) return cached;
	const index = new Map<string, Map<string, string[]>>();
	for (const [key, areas] of areaLookup) {
		const [geography, boundaryRelease] = key.split("/") as [string, string];
		for (const code of areas.keys()) {
			const byGeography = index.get(code) ?? new Map<string, string[]>();
			byGeography.set(geography, [
				...(byGeography.get(geography) ?? []),
				boundaryRelease,
			]);
			index.set(code, byGeography);
		}
	}
	codeIndexes.set(areaLookup, index);
	return index;
};

/** Codes are a letter and eight digits; a letter and other digits is a typo. */
const CODE = /^[A-Z]\d{8}$/;
const CODE_LIKE = /^[A-Z]\d+$/;

export const validateBatch = (
	areaLookup: AreaLookup,
	geography: string,
	boundaryRelease: string,
	values: string[],
): ValidatedValue[] => {
	const areas = areaLookup.get(releaseKey(geography, boundaryRelease));
	if (!areas)
		throw new Error(`${geography}/${boundaryRelease} is not compiled.`);
	const ref = (area: AreaRecord): AreaRef => ({
		id: areaKey(geography, boundaryRelease, area.code),
		code: area.code,
		name: area.name,
	});
	const firstSeen = new Map<string, number>();

	return values.map((value, index) => {
		const trimmed = value.trim();
		const upper = trimmed.toUpperCase();
		const looksLikeCode = CODE_LIKE.test(upper);
		const normalised = [
			...(trimmed !== value ? (["trimmed"] as const) : []),
			...(looksLikeCode && upper !== trimmed
				? (["uppercased"] as const)
				: []),
		];
		const key = looksLikeCode ? upper : normalisePlaceName(trimmed);
		const duplicateOf = firstSeen.get(key);
		if (duplicateOf === undefined) firstSeen.set(key, index);
		const base = {
			index,
			value,
			...(normalised.length > 0 ? { normalised } : {}),
			...(duplicateOf !== undefined ? { duplicateOf } : {}),
		};

		if (!trimmed) return { ...base, kind: "empty", status: "empty" };

		if (looksLikeCode) {
			if (!CODE.test(upper))
				return {
					...base,
					kind: "code",
					status: "malformed-code",
					detail: `An area code is a letter and eight digits; ${trimmed} has ${upper.length - 1}.`,
				};
			const area = areas.get(upper);
			if (area)
				return {
					...base,
					kind: "code",
					status: "valid",
					area: ref(area),
				};
			const heldBy = codeIndexFor(areaLookup).get(upper);
			if (heldBy?.has(geography)) {
				const { status, presentIn } = explainCodeInRelease(
					areaLookup,
					geography,
					boundaryRelease,
					upper,
				);
				return {
					...base,
					kind: "code",
					status: status as Exclude<MemberCodeStatus, "unknown">,
					presentIn,
				};
			}
			if (heldBy)
				return {
					...base,
					kind: "code",
					status: "other-geography",
					heldBy: [...heldBy]
						.map(([other, releases]) => ({
							geography: other,
							boundaryReleases: [...releases].sort(),
						}))
						.sort((left, right) =>
							left.geography.localeCompare(right.geography),
						),
				};
			return { ...base, kind: "code", status: "unknown" };
		}

		const name = normalisePlaceName(trimmed);
		const entries = nameIndexFor(areas).get(name) ?? [];
		if (entries.length === 1)
			return {
				...base,
				kind: "name",
				status: "matched",
				match: entries[0]!.match,
				area: ref(entries[0]!.area),
			};
		if (entries.length > 1)
			return {
				...base,
				kind: "name",
				status: "ambiguous",
				candidates: entries
					.map((entry) => ({
						...ref(entry.area),
						match: entry.match,
					}))
					.sort(
						(left, right) =>
							MATCH_RANK[left.match] - MATCH_RANK[right.match] ||
							left.code.localeCompare(right.code),
					),
			};
		const prefix = `${geography}/`;
		return {
			...base,
			kind: "name",
			status: "unmatched",
			matchesIn: [...areaLookup]
				.filter(
					([key, other]) =>
						key.startsWith(prefix) &&
						other !== areas &&
						nameIndexFor(other).has(name),
				)
				.map(([key]) => key.slice(prefix.length))
				.sort(),
		};
	});
};

/** Counts by status, and whether every value names exactly one area. */
export const summariseBatch = (results: ValidatedValue[]) => {
	const byStatus: Record<string, number> = {};
	for (const result of results)
		byStatus[result.status] = (byStatus[result.status] ?? 0) + 1;
	return {
		valueCount: results.length,
		byStatus,
		duplicateCount: results.filter(
			(result) => result.duplicateOf !== undefined,
		).length,
		normalisedCount: results.filter((result) => result.normalised).length,
		joinable: results.every(
			(result) =>
				result.status === "valid" || result.status === "matched",
		),
	};
};
