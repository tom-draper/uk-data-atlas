import type { AreaLookup } from "@uk-data-atlas/areas";
import { NAME_NORMALISATION } from "@uk-data-atlas/search-index/node";
import { normalisePlaceName, withoutTitle } from "@uk-data-atlas/geography";
import { compareCodeUnits } from "@uk-data-atlas/search-index";
import { sha256 } from "@uk-data-atlas/artifacts";
import { packPositions } from "@uk-data-atlas/search-index";
import type { SqliteTable } from "@uk-data-atlas/artifacts";

/**
 * The compiled area search index: every area identity, one per release and
 * code, and the codes, names and aliases it can be found by.
 *
 * An identity's position is its place in id order, counting through
 * `releases` and then each release's `codes`. Ids sort by code unit, so each
 * release's identities are contiguous and a position is found by two binary
 * searches. Postings hold positions in ascending order, which is id order, so
 * results merged from several terms need only a numeric sort.
 */
export type AreaSearchIndexArtifact = {
	schemaVersion: 1;
	contentHash: string;
	/** The `NAME_NORMALISATION` fingerprint every term was normalised under. */
	nameNormalisation: string;
	areaInventoryHash: string;
	/** Sorted by `geography/boundaryRelease/`, the prefix of their ids. */
	releases: Array<{
		geography: string;
		boundaryRelease: string;
		/** Sorted by code unit. */
		codes: string[];
	}>;
	/** Every normalised code, name and alias, sorted, for prefix search. */
	terms: string[];
	/** The identities behind each of `terms`, position for position. */
	termAreas: number[][];
	/**
	 * Every normalised name and alias with its administrative title set aside,
	 * for exact resolution only: "bristol" for "Bristol, City of".
	 */
	titleTerms: string[];
	titleTermAreas: number[][];
};

const releasePrefix = (geography: string, boundaryRelease: string) =>
	`${geography}/${boundaryRelease}/`;

const postings = (byTerm: Map<string, Set<number>>) => {
	const terms = [...byTerm.keys()].sort(compareCodeUnits);
	return {
		terms,
		areas: terms.map((term) =>
			[...byTerm.get(term)!].sort((left, right) => left - right),
		),
	};
};

export const compileAreaSearchIndex = (
	areaLookup: AreaLookup,
	areaInventoryHash: string,
): AreaSearchIndexArtifact => {
	const releases = [...areaLookup.entries()]
		.map(([key, areas]) => {
			const slash = key.indexOf("/");
			return {
				geography: key.slice(0, slash),
				boundaryRelease: key.slice(slash + 1),
				codes: [...areas.keys()].sort(compareCodeUnits),
				areas,
			};
		})
		.sort((left, right) =>
			compareCodeUnits(
				releasePrefix(left.geography, left.boundaryRelease),
				releasePrefix(right.geography, right.boundaryRelease),
			),
		);
	const byTerm = new Map<string, Set<number>>();
	const byTitleTerm = new Map<string, Set<number>>();
	const post = (
		index: Map<string, Set<number>>,
		term: string,
		at: number,
	) => {
		const list = index.get(term);
		if (list) list.add(at);
		else index.set(term, new Set([at]));
	};
	let position = 0;
	for (const release of releases) {
		for (const code of release.codes) {
			const area = release.areas.get(code)!;
			const term = normalisePlaceName(code);
			if (term) post(byTerm, term, position);
			for (const label of [area.name, ...(area.aliases ?? [])]) {
				const normalised = normalisePlaceName(label);
				if (!normalised) continue;
				post(byTerm, normalised, position);
				const stripped = withoutTitle(normalised);
				if (stripped) post(byTitleTerm, stripped, position);
			}
			position += 1;
		}
	}
	const named = postings(byTerm);
	const titled = postings(byTitleTerm);
	const body = {
		schemaVersion: 1 as const,
		nameNormalisation: NAME_NORMALISATION,
		areaInventoryHash,
		releases: releases.map(({ geography, boundaryRelease, codes }) => ({
			geography,
			boundaryRelease,
			codes,
		})),
		terms: named.terms,
		termAreas: named.areas,
		titleTerms: titled.terms,
		titleTermAreas: titled.areas,
	};
	return { ...body, contentHash: sha256(JSON.stringify(body)) };
};

/** Codes in position order and term postings packed as u32s. */
export const areaSearchIndexTables = (
	index: AreaSearchIndexArtifact,
): Record<string, SqliteTable> => ({
	area_search_meta: {
		columns: ["key TEXT NOT NULL", "value TEXT NOT NULL"],
		key: ["key"],
		rows: Object.entries({
			schemaVersion: String(index.schemaVersion),
			contentHash: index.contentHash,
			nameNormalisation: index.nameNormalisation,
			areaInventoryHash: index.areaInventoryHash,
			releases: JSON.stringify(
				index.releases.map(({ geography, boundaryRelease, codes }) => ({
					geography,
					boundaryRelease,
					length: codes.length,
				})),
			),
		}),
	},
	area_search_codes: {
		columns: ["code TEXT"],
		rows: index.releases.flatMap((release) =>
			release.codes.map((code) => [code]),
		),
	},
	area_search_terms: {
		columns: ["term TEXT", "areas BLOB"],
		rows: index.terms.map((term, at) => [
			term,
			packPositions(index.termAreas[at]!),
		]),
	},
	area_search_title_terms: {
		columns: ["term TEXT", "areas BLOB"],
		rows: index.titleTerms.map((term, at) => [
			term,
			packPositions(index.titleTermAreas[at]!),
		]),
	},
});
