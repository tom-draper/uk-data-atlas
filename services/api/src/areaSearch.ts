import { createHash } from "node:crypto";
import type { AreaLookup, AreaRecord } from "./areaInventory";
import { releaseKey } from "./geographyKeys";
import {
	NAME_NORMALISATION,
	normalisePlaceName,
	withoutTitle,
} from "./nameNormalisation";
import {
	compareCodeUnits,
	findNumber,
	findSorted,
	lowerBound,
} from "./sortedIndex";

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

export type AreaSearchResult = AreaRecord & {
	id: string;
	geography: string;
	boundaryRelease: string;
};

export type AreaSearchFilters = {
	geography?: string | null;
	boundaryRelease?: string | null;
};

const sha256 = (content: string) =>
	`sha256:${createHash("sha256").update(content).digest("hex")}`;

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

/**
 * Whether an artifact can serve searches over this area inventory, under the
 * normalisation this API applies to a query. Undefined when it can.
 */
export const areaSearchIndexMismatch = (
	artifact: AreaSearchIndexArtifact,
	areaInventoryHash: string,
): string | undefined => {
	if (
		artifact.schemaVersion !== 1 ||
		!Array.isArray(artifact.releases) ||
		!Array.isArray(artifact.terms) ||
		!Array.isArray(artifact.termAreas) ||
		!Array.isArray(artifact.titleTerms) ||
		!Array.isArray(artifact.titleTermAreas) ||
		artifact.terms.length !== artifact.termAreas.length ||
		artifact.titleTerms.length !== artifact.titleTermAreas.length
	)
		return "is malformed";
	if (artifact.nameNormalisation !== NAME_NORMALISATION)
		return "was normalised under different name rules than this API applies";
	if (artifact.areaInventoryHash !== areaInventoryHash)
		return "was not built from the current area inventory";
	return undefined;
};

/**
 * The identities a search matched, in id order, read only as far as a page
 * needs.
 */
export type AreaMatches = {
	length: number;
	/** Where the identity with this id falls among the matches, or -1. */
	positionOf(id: string): number;
	slice(start: number, end: number): AreaSearchResult[];
};

/** Searches over a compiled index, reading area records from the inventory. */
export class AreaSearch {
	/** Where each release's identities begin, and one past the last. */
	private readonly offsets: number[];
	private readonly prefixes: string[];

	constructor(
		private readonly index: AreaSearchIndexArtifact,
		private readonly areaLookup: AreaLookup,
	) {
		this.offsets = [0];
		for (const release of index.releases)
			this.offsets.push(this.offsets.at(-1)! + release.codes.length);
		this.prefixes = index.releases.map((release) =>
			releasePrefix(release.geography, release.boundaryRelease),
		);
	}

	private releaseAt(position: number) {
		let low = 0;
		let high = this.index.releases.length - 1;
		while (low < high) {
			const middle = (low + high + 1) >> 1;
			if (this.offsets[middle]! <= position) low = middle;
			else high = middle - 1;
		}
		return low;
	}

	private result(position: number): AreaSearchResult {
		const at = this.releaseAt(position);
		const { geography, boundaryRelease, codes } = this.index.releases[at]!;
		const code = codes[position - this.offsets[at]!]!;
		const area = this.areaLookup
			.get(releaseKey(geography, boundaryRelease))!
			.get(code)!;
		return {
			id: `${geography}/${boundaryRelease}/${code}`,
			geography,
			boundaryRelease,
			...area,
		};
	}

	/** The position of the identity with this id, or -1. */
	private positionOfId(id: string) {
		const slash = id.lastIndexOf("/");
		if (slash === -1) return -1;
		const at = findSorted(this.prefixes, id.slice(0, slash + 1));
		if (at === -1) return -1;
		const within = findSorted(
			this.index.releases[at]!.codes,
			id.slice(slash + 1),
		);
		return within === -1 ? -1 : this.offsets[at]! + within;
	}

	/** The positions in `releases` of those the filters admit. */
	private admitted({ geography, boundaryRelease }: AreaSearchFilters) {
		return this.index.releases.flatMap((release, at) =>
			(geography == null || release.geography === geography) &&
			(boundaryRelease == null ||
				release.boundaryRelease === boundaryRelease)
				? [at]
				: [],
		);
	}

	private matches(positions: number[]): AreaMatches {
		return {
			length: positions.length,
			positionOf: (id) => {
				const position = this.positionOfId(id);
				return position === -1 ? -1 : findNumber(positions, position);
			},
			slice: (start, end) =>
				positions
					.slice(start, end)
					.map((position) => this.result(position)),
		};
	}

	private filtered(positions: Iterable<number>, filters: AreaSearchFilters) {
		const releases = new Set(this.admitted(filters));
		const kept: number[] = [];
		for (const position of positions) {
			if (releases.has(this.releaseAt(position))) kept.push(position);
		}
		return kept.sort((left, right) => left - right);
	}

	/**
	 * Every identity the filters admit or, given a query, an exact code match
	 * or else every identity with a code, name or alias beginning with it.
	 */
	search(filters: AreaSearchFilters & { query?: string }): AreaMatches {
		if (!filters.query) {
			const positions: number[] = [];
			for (const at of this.admitted(filters)) {
				for (
					let p = this.offsets[at]!;
					p < this.offsets[at + 1]!;
					p += 1
				)
					positions.push(p);
			}
			return this.matches(positions);
		}
		const codeQuery = filters.query.toLocaleLowerCase();
		const nameQuery = normalisePlaceName(filters.query);
		if (!nameQuery) return this.matches([]);
		// An exact code is always a term, since codes are indexed as terms.
		const term = findSorted(this.index.terms, nameQuery);
		if (term !== -1) {
			const exact = this.filtered(
				this.index.termAreas[term]!.filter(
					(position) =>
						this.codeAt(position).toLocaleLowerCase() === codeQuery,
				),
				filters,
			);
			if (exact.length > 0) return this.matches(exact);
		}
		const found = new Set<number>();
		for (
			let position = lowerBound(this.index.terms, nameQuery);
			position < this.index.terms.length &&
			this.index.terms[position]!.startsWith(nameQuery);
			position += 1
		) {
			for (const area of this.index.termAreas[position]!) found.add(area);
		}
		return this.matches(this.filtered(found, filters));
	}

	/**
	 * Every identity whose code, name or alias could equal the query exactly,
	 * including once an administrative title is set aside. The caller decides
	 * which kind of match each one is.
	 */
	exactCandidates(
		filters: AreaSearchFilters & { query: string },
	): AreaSearchResult[] {
		const nameQuery = normalisePlaceName(filters.query);
		if (!nameQuery) return [];
		const term = findSorted(this.index.terms, nameQuery);
		const titleTerm = findSorted(this.index.titleTerms, nameQuery);
		return this.filtered(
			[
				...(term === -1 ? [] : this.index.termAreas[term]!),
				...(titleTerm === -1
					? []
					: this.index.titleTermAreas[titleTerm]!),
			],
			filters,
		)
			.filter((position, index, all) => position !== all[index - 1])
			.map((position) => this.result(position));
	}

	private codeAt(position: number) {
		const at = this.releaseAt(position);
		return this.index.releases[at]!.codes[position - this.offsets[at]!]!;
	}
}
